import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { beep } from '../core/utils.js';
import { sendSig } from '../net/signaling.js';

export function addRequest(id, name) {
  if (S.requests.has(id)) return;
  const card = document.createElement('div');
  card.className = 'request';
  const text = document.createElement('div');
  text.className = 'req-text';
  const b = document.createElement('b'); b.textContent = name;
  text.append(b, ' muốn tham gia phòng');
  const ok = document.createElement('button'); ok.className = 'ok'; ok.type = 'button'; ok.textContent = 'Chấp nhận';
  const no = document.createElement('button'); no.className = 'no'; no.type = 'button'; no.textContent = 'Từ chối';
  ok.onclick = () => { sendSig({ type: 'approve', client_id: id }); removeRequest(id); };
  no.onclick = () => { sendSig({ type: 'reject', client_id: id }); removeRequest(id); };
  card.append(text, ok, no);
  el.requests.appendChild(card);
  S.requests.set(id, card);
  beep();
}

export function removeRequest(id) {
  const c = S.requests.get(id);
  if (c) { c.remove(); S.requests.delete(id); }
}
