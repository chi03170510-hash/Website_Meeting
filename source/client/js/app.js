import { el } from './core/dom.js';
import { S } from './core/state.js';
import { load } from './core/utils.js';
import { setCamButton, toggleCam } from './media/camera.js';
import { setMicButton, toggleMic } from './media/mic.js';
import { sendSig } from './net/signaling.js';
import { leaveRoom, startJoin } from './room/room.js';
import { closeSidebar, openSidebar, toggleSidebar } from './ui/sidebar.js';

el.joinForm.addEventListener('submit', (e) => { e.preventDefault(); startJoin(); });
el.btnWaitCancel.addEventListener('click', leaveRoom);
el.btnLeave.addEventListener('click', leaveRoom);
el.btnMic.addEventListener('click', toggleMic);
el.btnCam.addEventListener('click', toggleCam);
el.btnChat.addEventListener('click', () => toggleSidebar('chat'));
el.btnPeople.addEventListener('click', () => toggleSidebar('people'));
el.btnSideClose.addEventListener('click', closeSidebar);
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => openSidebar(t.dataset.tab)));

el.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = el.chatInput.value.trim();
  if (!text) return;
  sendSig({ type: 'chat', text });
  el.chatInput.value = '';
});

window.addEventListener('beforeunload', () => { try { sendSig({ type: 'leave' }); } catch (_) {} });
document.addEventListener('click', () => {
  if (S.audioCtx && S.audioCtx.state === 'suspended') S.audioCtx.resume().catch(() => {});
});

(function init() {
  const q = new URLSearchParams(location.search);
  const defServer = location.protocol.startsWith('http') && location.host ? location.host : 'localhost';
  el.inpName.value = q.get('name') || load('name') || 'User';
  el.inpRoom.value = q.get('room') || load('room') || 'room1';
  el.inpServer.value = q.get('server') || load('server') || defServer;
  if (!window.isSecureContext) el.joinWarn.hidden = false;
  setMicButton(); setCamButton();
})();
