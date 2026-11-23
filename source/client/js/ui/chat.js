import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { fmtTime } from '../core/utils.js';

export function addChat(m) {
  const own = m.client_id === S.myId;
  const wrap = document.createElement('div');
  wrap.className = 'msg' + (own ? ' own' : '');
  const meta = document.createElement('div'); meta.className = 'meta';
  const who = document.createElement('span'); who.className = 'who'; who.textContent = own ? 'Bạn' : (m.username || '?');
  const time = document.createElement('time');
  const d = m.timestamp ? new Date(m.timestamp) : new Date();
  time.textContent = fmtTime(isNaN(d) ? new Date() : d);
  meta.append(who, time);
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = m.text;
  wrap.append(meta, bubble);
  pushLog(wrap);

  if (!own && S.sideTab !== 'chat') {
    S.unreadChat++;
    el.chatDot.hidden = false;
  }
}

export function addSystem(text) {
  const d = document.createElement('div');
  d.className = 'sys'; d.textContent = text;
  pushLog(d);
}

export function pushLog(node) {
  const log = el.chatLog;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.appendChild(node);
  if (nearBottom || node.classList.contains('own')) log.scrollTop = log.scrollHeight;
}
