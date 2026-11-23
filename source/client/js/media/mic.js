import { CFG, EMPTY, PKT_AUDIO } from '../core/config.js';
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { hasMediaDevices, mediaError, toast } from '../core/utils.js';
import { initAudioContext } from './playback.js';
import { Downsampler } from './resample.js';
import { sendMedia } from '../net/media-channel.js';
import { setPeerMic } from '../room/peers.js';

export const WORKLET_SRC = `
  class PitCapture extends AudioWorkletProcessor {
    constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; }
    process(inputs) {
      const ch = inputs[0] && inputs[0][0];
      if (ch) {
        for (let i = 0; i < ch.length; i++) {
          this.buf[this.n++] = ch[i];
          if (this.n === this.buf.length) {
            const out = this.buf.slice(0);
            this.port.postMessage(out, [out.buffer]);
            this.n = 0;
          }
        }
      }
      return true;
    }
  }
  registerProcessor('pit-capture', PitCapture);`;

export async function createCaptureNode(ctx, onSamples) {
  if (ctx.audioWorklet && window.AudioWorkletNode) {
    try {
      if (!S.workletReady) {
        const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        S.workletReady = true;
      }
      const node = new AudioWorkletNode(ctx, 'pit-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
      node.port.onmessage = (e) => onSamples(e.data);
      return node;
    } catch (err) { console.warn('AudioWorklet lỗi, dùng ScriptProcessor', err); }
  }
  const node = ctx.createScriptProcessor(2048, 1, 1);
  node.onaudioprocess = (e) => onSamples(new Float32Array(e.inputBuffer.getChannelData(0)));
  return node;
}

export async function startMic() {
  if (!hasMediaDevices()) { mediaError(null, 'mic'); return false; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      video: false,
    });
  } catch (e) { mediaError(e, 'mic'); return false; }

  if (S.state !== 'room') { stream.getTracks().forEach((t) => t.stop()); return false; }
  initAudioContext();
  const ctx = S.audioCtx;
  if (!ctx) { stream.getTracks().forEach((t) => t.stop()); toast('Trình duyệt không hỗ trợ Web Audio.', 'error'); return false; }
  await ctx.resume().catch(() => {});

  const down = new Downsampler(ctx.sampleRate, CFG.audioRate);
  const q = new Float32Array(CFG.audioChunk * 8);
  let qlen = 0;
  const self = S.peers.get(S.myId);

  const onSamples = (f32) => {
    const d = down.process(f32);
    if (qlen + d.length > q.length) qlen = 0;                     
    q.set(d, qlen); qlen += d.length;
    while (qlen >= CFG.audioChunk) {
      const pkt = new Uint8Array(CFG.audioChunk * 2);
      const dv = new DataView(pkt.buffer);
      let sum = 0;
      for (let i = 0; i < CFG.audioChunk; i++) {
        const s = Math.max(-1, Math.min(1, q[i]));
        sum += s * s;
        dv.setInt16(i * 2, s < 0 ? s * 32768 : s * 32767, true);
      }
      q.copyWithin(0, CFG.audioChunk, qlen); qlen -= CFG.audioChunk;
      sendMedia(PKT_AUDIO, pkt);
      if (self && Math.sqrt(sum / CFG.audioChunk) > 0.015) self.speakingUntil = performance.now() + 350;
    }
  };

  const src = ctx.createMediaStreamSource(stream);
  const node = await createCaptureNode(ctx, onSamples);
  const mute = ctx.createGain(); mute.gain.value = 0;       
  src.connect(node); node.connect(mute); mute.connect(ctx.destination);

  S.mic = { stream, src, node, mute };
  return true;
}

export function stopMic(notify = true) {
  const m = S.mic;
  S.mic = null;
  if (m) {
    try { if (m.node.port) m.node.port.onmessage = null; else m.node.onaudioprocess = null; } catch (_) {}
    try { m.src.disconnect(); m.node.disconnect(); m.mute.disconnect(); } catch (_) {}
    m.stream.getTracks().forEach((t) => t.stop());
  }
  S.micOn = false;
  const self = S.peers.get(S.myId);
  if (self) setPeerMic(self, false);
  if (notify) sendMedia(PKT_AUDIO, EMPTY, true);
}

export async function toggleMic() {
  if (S.audioCtx && S.audioCtx.state === 'suspended') S.audioCtx.resume().catch(() => {});
  if (S.micOn) { stopMic(); setMicButton(); return; }
  el.btnMic.disabled = true;
  const ok = await startMic();
  el.btnMic.disabled = false;
  if (ok) {
    S.micOn = true;
    const self = S.peers.get(S.myId);
    if (self) setPeerMic(self, true);
  }
  setMicButton();
}

export function setMicButton() {
  el.btnMic.classList.toggle('off', !S.micOn);
  el.btnMic.title = S.micOn ? 'Tắt mic' : 'Bật mic';
  el.btnMic.querySelector('use').setAttribute('href', S.micOn ? '#i-mic' : '#i-mic-off');
}
