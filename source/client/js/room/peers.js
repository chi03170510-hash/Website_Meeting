import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { colorFor, initial } from '../core/utils.js';
import { sendSig } from '../net/signaling.js';
import { removeRequest } from './requests.js';

export function addPeer(id, name, self = false) {
  if (S.peers.has(id)) return;
  const tile = document.createElement('div');
  tile.className = 'tile' + (self ? ' self' : '');
  tile.innerHTML =
    '<div class="avatar"></div>' +
    (self ? '<video class="video" autoplay muted playsinline></video>' : '<img class="video" alt="">') +
    '<div class="tile-bar"><svg class="ic mic-state"><use href="#i-mic-off"/></svg>' +
    '<span class="tile-name"></span><span class="host-tag"></span><span class="fps"></span></div>';
  tile.querySelector('.avatar').textContent = initial(name);
  tile.querySelector('.avatar').style.background = colorFor(name);
  tile.querySelector('.tile-name').textContent = self ? `${name} (Bạn)` : name;

  const peer = {
    id, name, self, tile,
    media: tile.querySelector('.video'),
    micUse: tile.querySelector('.mic-state use'),
    hostTag: tile.querySelector('.host-tag'),
    micOn: false, camOn: false,
    lastAudio: 0, lastVideo: 0, speakingUntil: 0,
    nextTime: 0, up: null, imgUrl: null,
    fpsEl: tile.querySelector('.fps'), frames: 0,
  };
  S.peers.set(id, peer);
  if (self) el.grid.prepend(tile); else el.grid.appendChild(tile);
  layoutGrid();
  refreshPeopleUI();
}

export function removePeer(id) {
  const p = S.peers.get(id);
  if (!p) return;
  if (p.imgUrl) URL.revokeObjectURL(p.imgUrl);
  p.tile.remove();
  S.peers.delete(id);
  removeRequest(id);
  layoutGrid();
  refreshPeopleUI();
}

export function clearPeers() {
  for (const p of S.peers.values()) { if (p.imgUrl) URL.revokeObjectURL(p.imgUrl); }
  S.peers.clear();
  el.grid.textContent = '';
}

export function setPeerMic(p, on) {
  p.micOn = on;
  p.tile.classList.toggle('mic-on', on);
  p.micUse.setAttribute('href', on ? '#i-mic' : '#i-mic-off');
  if (!on) p.speakingUntil = 0;
}

export function setPeerCam(p, on) {
  p.camOn = on;
  p.tile.classList.toggle('cam-on', on);
  if (!on && !p.self) {
    if (p.imgUrl) { URL.revokeObjectURL(p.imgUrl); p.imgUrl = null; }
    p.media.removeAttribute('src');
  }
}

export function layoutGrid() {
  const n = el.grid.children.length || 1;
  const portrait = el.grid.clientHeight > el.grid.clientWidth;
  let cols;
  if (portrait) cols = n <= 2 ? 1 : n <= 6 ? 2 : 3;
  else cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  el.grid.style.setProperty('--cols', cols);
  el.grid.style.setProperty('--rows', Math.ceil(n / cols));
}
window.addEventListener('resize', layoutGrid);

export function refreshHostUI() {
  const iAmHost = S.hostId && S.hostId === S.myId;
  el.hostBadge.hidden = !iAmHost;
  for (const p of S.peers.values()) p.hostTag.textContent = p.id === S.hostId ? '· Chủ phòng' : '';
  refreshPeopleUI();
}

export function refreshPeopleUI() {
  const n = S.peers.size;
  el.count.textContent = `${n} người`;
  el.peopleCount.textContent = `(${n})`;

  const iAmHost = !!S.hostId && S.hostId === S.myId;
  el.peopleList.textContent = '';
  for (const p of S.peers.values()) {
    const li = document.createElement('li');
    const av = document.createElement('div');
    av.className = 'p-avatar'; av.textContent = initial(p.name); av.style.background = colorFor(p.name);
    const nm = document.createElement('div');
    nm.className = 'p-name'; nm.textContent = p.name;
    if (p.self) { const s = document.createElement('small'); s.textContent = '(Bạn)'; nm.appendChild(s); }
    if (p.id === S.hostId) { const h = document.createElement('span'); h.className = 'host-tag'; h.textContent = 'Chủ phòng'; nm.appendChild(h); }
    li.append(av, nm);
    if (iAmHost && !p.self) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-kick'; b.textContent = 'Mời ra';
      b.onclick = () => {
        if (confirm(`Mời "${p.name}" ra khỏi phòng?`)) sendSig({ type: 'kick', client_id: p.id });
      };
      li.appendChild(b);
    }
    el.peopleList.appendChild(li);
  }
}
