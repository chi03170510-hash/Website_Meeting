import { CFG, EMPTY, PKT_AUDIO, PKT_VIDEO, textEnc } from '../core/config.js';
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { hasMediaDevices, parseServer, showScreen, store, toast } from '../core/utils.js';
import { setCamButton, stopCam } from '../media/camera.js';
import { setMicButton, stopMic } from '../media/mic.js';
import { initAudioContext } from '../media/playback.js';
import { buildHeader, connectMedia, sendMedia } from '../net/media-channel.js';
import { connectSignaling, sendSig } from '../net/signaling.js';
import { addPeer, clearPeers, layoutGrid, refreshHostUI, setPeerCam, setPeerMic } from './peers.js';
import { removeRequest } from './requests.js';
import { addSystem } from '../ui/chat.js';
import { closeSidebar } from '../ui/sidebar.js';

export function startJoin() {
  const name = el.inpName.value.trim();
  const room = el.inpRoom.value.trim();
  if (!name) return showJoinError('Vui lòng nhập tên của bạn.');
  if (!room) return showJoinError('Vui lòng nhập mã phòng.');
  if (textEnc.encode(room).length > 255) return showJoinError('Mã phòng quá dài.');
  let base;
  try { base = parseServer(el.inpServer.value); } catch (e) { return showJoinError(e.message); }

  store('name', name); store('room', room); store('server', el.inpServer.value.trim());
  S.name = name; S.room = room; S.base = base;
  S.password = el.inpPassword.value;

  hideJoinError();
  el.btnJoin.disabled = true;
  el.btnJoin.textContent = 'Connecting…';
  initAudioContext();                           
  connectSignaling();
}

export function enterRoom(msg) {
  clearPeers();
  S.hostId = msg.host_id || null;
  addPeer(S.myId, S.name, true);
  for (const u of msg.users || []) if (u.client_id !== S.myId) addPeer(u.client_id, u.username);

  el.roomTitle.textContent = 'Phòng: ' + S.room;
  el.chatLog.textContent = '';
  showScreen('room');
  refreshHostUI();
  layoutGrid();
  addSystem('Bạn đã vào phòng');
  if (S.hostId === S.myId) addSystem('Bạn là chủ phòng. Người khác muốn vào phải được bạn chấp nhận.');

  S.hdr[PKT_AUDIO] = buildHeader(PKT_AUDIO);
  S.hdr[PKT_VIDEO] = buildHeader(PKT_VIDEO);
  connectMedia();

  S.joinedAt = Date.now();
  startTimers();
  if (!hasMediaDevices()) toast('Trang không chạy trên HTTPS/localhost nên mic/camera bị trình duyệt chặn.', 'warn', 6000);
}

export function leaveRoom() {
  sendSig({ type: 'leave' });
  resetToJoin('');
}

export function resetToJoin(message) {
  teardown();
  showScreen('join');
  el.btnJoin.disabled = false;
  el.btnJoin.textContent = 'Join Room';
  if (message) showJoinError(message); else hideJoinError();
}

export function teardown() {
  stopMic(false);
  stopCam(false);
  S.timers.forEach(clearInterval); S.timers = [];

  const sig = S.sig, media = S.media;
  S.sig = null; S.media = null;               
  if (sig) try { sig.close(); } catch (_) {}
  if (media) try { media.close(); } catch (_) {}

  clearPeers();
  for (const id of [...S.requests.keys()]) removeRequest(id);
  el.chatLog.textContent = '';
  closeSidebar();
  S.myId = null; S.hostId = null; S.unreadChat = 0;
  el.chatDot.hidden = true; el.peopleDot.hidden = true;
  setMicButton(); setCamButton();

  if (S.audioCtx) { try { S.audioCtx.close(); } catch (_) {} S.audioCtx = null; S.workletReady = false; }
}

export function showJoinError(t) { el.joinError.textContent = t; el.joinError.hidden = false; el.btnJoin.disabled = false; el.btnJoin.textContent = 'Join Room'; }
export function hideJoinError() { el.joinError.hidden = true; }

export function startTimers() {
  S.timers.push(setInterval(() => {
    const s = Math.floor((Date.now() - S.joinedAt) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    el.clock.textContent = s >= 3600 ? `${Math.floor(s / 3600)}:${mm}:${ss}` : `${mm}:${ss}`;
  }, 1000));

  S.timers.push(setInterval(() => sendSig({ type: 'ping' }), CFG.pingMs));

  S.timers.push(setInterval(() => {
    if (!S.micOn) sendMedia(PKT_AUDIO, EMPTY, true);
    if (!S.camOn) sendMedia(PKT_VIDEO, EMPTY, true);
  }, CFG.keepAliveMs));

  S.timers.push(setInterval(() => {
    const now = performance.now();
    for (const p of S.peers.values()) {
      if (p.self) continue;
      if (p.micOn && now - p.lastAudio > CFG.micTimeoutMs) setPeerMic(p, false);
      if (p.camOn && now - p.lastVideo > CFG.camTimeoutMs) setPeerCam(p, false);
    }
    for (const p of S.peers.values()) p.tile.classList.toggle('speaking', now < p.speakingUntil);
  }, 200));

  S.timers.push(setInterval(() => {
    for (const p of S.peers.values()) {
      p.fpsEl.textContent = p.camOn ? `${p.frames} fps` : '';
      p.frames = 0;
    }
  }, 1000));
}