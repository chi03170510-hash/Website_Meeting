import { CFG } from '../core/config.js';
import { S } from '../core/state.js';
import { Upsampler } from './resample.js';
import { setPeerCam, setPeerMic } from '../room/peers.js';

export function onRemoteVideo(peer, payload) {
  if (payload.length === 0) { setPeerCam(peer, false); return; }
  peer.lastVideo = performance.now();
  peer.frames++;
  const url = URL.createObjectURL(new Blob([payload], { type: 'image/jpeg' }));
  const old = peer.imgUrl;
  peer.imgUrl = url;
  peer.media.onload = () => { if (!peer.camOn) setPeerCam(peer, true); };
  peer.media.src = url;
  if (old) setTimeout(() => URL.revokeObjectURL(old), 500);
}

export function initAudioContext() {
  if (S.audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  S.audioCtx = new AC({ latencyHint: 'interactive' });
  S.workletReady = false;
  if (S.audioCtx.state === 'suspended') S.audioCtx.resume().catch(() => {});
}

export function onRemoteAudio(peer, payload) {
  if (payload.length === 0) { setPeerMic(peer, false); return; }
  if (!peer.micOn) setPeerMic(peer, true);
  peer.lastAudio = performance.now();

  const n = payload.length >> 1;
  if (!n) return;
  const dv = new DataView(payload.buffer, payload.byteOffset, n * 2);
  const f32 = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { const v = dv.getInt16(i * 2, true) / 32768; f32[i] = v; sum += v * v; }
  if (Math.sqrt(sum / n) > 0.015) peer.speakingUntil = performance.now() + 350;

  playPcm(peer, f32);
}

export function playPcm(peer, f32) {
  const ctx = S.audioCtx;
  if (!ctx || ctx.state === 'closed') return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!peer.up) peer.up = new Upsampler(CFG.audioRate, ctx.sampleRate);
  const data = peer.up.process(f32);
  if (!data.length) return;

  const now = ctx.currentTime;
  if (peer.nextTime > now + CFG.playMaxAhead) return;       
  if (peer.nextTime < now + 0.01) peer.nextTime = now + CFG.playJitter;

  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.copyToChannel(data, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(peer.nextTime);
  peer.nextTime += buf.duration;
}
