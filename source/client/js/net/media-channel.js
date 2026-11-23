import { EMPTY, PKT_AUDIO, PKT_VIDEO, textDec, textEnc } from '../core/config.js';
import { S } from '../core/state.js';
import { toast } from '../core/utils.js';
import { onRemoteAudio, onRemoteVideo } from '../media/playback.js';

export function buildHeader(type) {
  const id = textEnc.encode(S.myId), room = textEnc.encode(S.room);
  const h = new Uint8Array(3 + id.length + room.length);
  let o = 0;
  h[o++] = type; h[o++] = id.length; h.set(id, o); o += id.length;
  h[o++] = room.length; h.set(room, o);
  return h;
}

export function connectMedia() {
  const ws = new WebSocket(S.base + '/media');
  ws.binaryType = 'arraybuffer';
  S.media = ws;
  ws.onopen = () => {
    sendMedia(PKT_AUDIO, EMPTY, true);
    sendMedia(PKT_VIDEO, EMPTY, true);
    if (S.micOn) sendMedia(PKT_AUDIO, EMPTY, true);
  };
  ws.onmessage = (ev) => { try { onMediaPacket(ev.data); } catch (err) { console.error(err); } };
  ws.onclose = () => {
    if (S.media !== ws) return;
    S.media = null;
    if (S.state === 'room') toast('Mất kết nối kênh hình/tiếng. Hãy rời phòng và vào lại.', 'error', 7000);
  };
}

export function sendMedia(type, payload, force = false) {
  const ws = S.media;
  if (!ws || ws.readyState !== WebSocket.OPEN || !S.hdr[type]) return false;
  if (!force && ws.bufferedAmount > (type === PKT_VIDEO ? 600000 : 200000)) return false; 
  const h = S.hdr[type];
  const out = new Uint8Array(h.length + payload.length);
  out.set(h, 0); out.set(payload, h.length);
  ws.send(out);
  return true;
}

export function onMediaPacket(buf) {
  const u = new Uint8Array(buf);
  if (u.length < 2) return;
  const type = u[0], idLen = u[1];
  if (u.length < 2 + idLen) return;
  const peer = S.peers.get(textDec.decode(u.subarray(2, 2 + idLen)));
  if (!peer || peer.self) return;
  const payload = u.subarray(2 + idLen);
  if (type === PKT_AUDIO) onRemoteAudio(peer, payload);
  else if (type === PKT_VIDEO) onRemoteVideo(peer, payload);
}
