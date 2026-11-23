import { $, el } from '../core/dom.js';
import { S } from '../core/state.js';
import { layoutGrid } from '../room/peers.js';

export function openSidebar(tab) {
  S.sideTab = tab;
  el.sidebar.hidden = false;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('pane-chat').classList.toggle('active', tab === 'chat');
  $('pane-people').classList.toggle('active', tab === 'people');
  el.btnChat.classList.toggle('active', tab === 'chat');
  el.btnPeople.classList.toggle('active', tab === 'people');
  if (tab === 'chat') {
    S.unreadChat = 0; el.chatDot.hidden = true;
    el.chatLog.scrollTop = el.chatLog.scrollHeight;
    el.chatInput.focus();
  }
  layoutGrid();
}

export function closeSidebar() {
  S.sideTab = null;
  el.sidebar.hidden = true;
  el.btnChat.classList.remove('active');
  el.btnPeople.classList.remove('active');
  layoutGrid();
}

export function toggleSidebar(tab) { if (S.sideTab === tab) closeSidebar(); else openSidebar(tab); }
