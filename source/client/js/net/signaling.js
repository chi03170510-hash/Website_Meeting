import { CFG } from '../core/config.js';
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { showScreen, toast } from '../core/utils.js';
import { addPeer, refreshHostUI, removePeer } from '../room/peers.js';
import { addRequest, removeRequest } from '../room/requests.js';
import { enterRoom, resetToJoin } from '../room/room.js';
import { addChat, addSystem } from '../ui/chat.js';

export function sendSig(obj) {
  if (S.sig && S.sig.readyState === WebSocket.OPEN) S.sig.send(JSON.stringify(obj));
}

export function connectSignaling() {
  const ws = new WebSocket(S.base + '/signaling');
  S.sig = ws;
  let opened = false;
  const timer = setTimeout(() => { if (!opened) ws.close(); }, CFG.connectTimeoutMs);

  ws.onopen = () => { opened = true; clearTimeout(timer); };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }
    try { onSignal(msg); } catch (err) { console.error('signal error', err, msg); }
  };
  ws.onclose = () => {
    clearTimeout(timer);
    if (S.sig !== ws) return;              
    if (!opened) resetToJoin(`Không kết nối được tới server ${S.base.replace(/^wss?:\/\//, '')}.`);
    else resetToJoin('Mất kết nối với server.');
  };
  ws.onerror = () => { };
}

export function onSignal(msg) {
  switch (msg.type) {
    case 'connected':
      S.myId = msg.client_id;
      sendSig({ type: 'join', room: S.room, username: S.name, password: S.password });
      break;

    case 'join_error':
      resetToJoin('Sai mật khẩu phòng.');
      break;

    case 'waiting':
      el.waitRoom.textContent = S.room;
      showScreen('wait');
      break;

    case 'rejected':
      resetToJoin(msg.reason === 'room_closed'
        ? 'Phòng đã đóng vì chủ phòng đã rời đi.'
        : 'Chủ phòng đã từ chối yêu cầu vào phòng của bạn.');
      break;

    case 'kicked':
      resetToJoin('Bạn đã bị chủ phòng mời ra khỏi phòng.');
      break;

    case 'room_users':
      enterRoom(msg);
      break;

    case 'user_joined':
      if (S.state !== 'room' || msg.client_id === S.myId) break;
      addPeer(msg.client_id, msg.username);
      addSystem(`${msg.username} đã vào phòng`);
      break;

    case 'user_left': {
      if (S.state !== 'room') break;
      const p = S.peers.get(msg.client_id);
      removePeer(msg.client_id);
      const who = msg.username || (p && p.name) || 'Một người';
      addSystem(msg.reason === 'kicked' ? `${who} đã bị mời ra khỏi phòng` : `${who} đã rời phòng`);
      break;
    }

    case 'host_changed':
      S.hostId = msg.host_id || null;
      refreshHostUI();
      if (S.hostId === S.myId) toast('Bạn đã trở thành chủ phòng.');
      break;

    case 'join_request':
      if (S.state === 'room' && S.hostId === S.myId) addRequest(msg.client_id, msg.username);
      break;

    case 'join_cancelled':
      removeRequest(msg.client_id);
      break;

    case 'chat':
      if (S.state === 'room') addChat(msg);
      break;
  }
}
