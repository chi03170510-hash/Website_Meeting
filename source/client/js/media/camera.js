import { CFG, EMPTY, PKT_VIDEO } from '../core/config.js';
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { hasMediaDevices, mediaError } from '../core/utils.js';
import { sendMedia } from '../net/media-channel.js';
import { setPeerCam } from '../room/peers.js';

export const frameCanvas = document.createElement('canvas');
export const frameCtx = frameCanvas.getContext('2d');
export let encoding = false;

export async function startCam() {
  if (!hasMediaDevices()) { mediaError(null, 'cam'); return false; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15 }, facingMode: 'user' },
      audio: false,
    });
  } catch (e) { mediaError(e, 'cam'); return false; }

  if (S.state !== 'room') { stream.getTracks().forEach((t) => t.stop()); return false; }
  const self = S.peers.get(S.myId);
  self.media.srcObject = stream;
  await self.media.play().catch(() => {});
  S.cam = { stream, timer: setInterval(sendFrame, 1000 / CFG.videoFps) };
  return true;
}

export function sendFrame() {
  if (encoding || !S.camOn) return;
  const self = S.peers.get(S.myId);
  const v = self && self.media;
  if (!v || !v.videoWidth) return;
  const ws = S.media;
  if (!ws || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 600000) return;

  const w = Math.min(CFG.videoWidth, v.videoWidth);
  const h = Math.round((w * v.videoHeight) / v.videoWidth);
  if (frameCanvas.width !== w) frameCanvas.width = w;
  if (frameCanvas.height !== h) frameCanvas.height = h;
  frameCtx.drawImage(v, 0, 0, w, h);

  encoding = true;
  frameCanvas.toBlob(async (blob) => {
    try {
      if (blob && S.camOn) sendMedia(PKT_VIDEO, new Uint8Array(await blob.arrayBuffer()));
      self.frames++;
    } finally { encoding = false; }
  }, 'image/jpeg', CFG.jpegQuality);
}

export function stopCam(notify = true) {
  const c = S.cam;
  S.cam = null;
  S.camOn = false;
  if (c) {
    clearInterval(c.timer);
    c.stream.getTracks().forEach((t) => t.stop());
  }
  const self = S.peers.get(S.myId);
  if (self) { self.media.srcObject = null; setPeerCam(self, false); }
  if (notify) sendMedia(PKT_VIDEO, EMPTY, true);
}

export async function toggleCam() {
  if (S.camOn) { stopCam(); setCamButton(); return; }
  el.btnCam.disabled = true;
  const ok = await startCam();
  el.btnCam.disabled = false;
  if (ok) {
    S.camOn = true;
    const self = S.peers.get(S.myId);
    if (self) setPeerCam(self, true);
  }
  setCamButton();
}

export function setCamButton() {
  el.btnCam.classList.toggle('off', !S.camOn);
  el.btnCam.title = S.camOn ? 'Tắt camera' : 'Bật camera';
  el.btnCam.querySelector('use').setAttribute('href', S.camOn ? '#i-video' : '#i-video-off');
}
