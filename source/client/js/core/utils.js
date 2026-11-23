import { el } from './dom.js';
import { S } from './state.js';

export function toast(text, kind = '', ms = 4200) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = text;
  el.toasts.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function showScreen(name) {
  S.state = name;
  for (const [k, s] of Object.entries(el.screens)) s.classList.toggle('active', k === name);
}

export function colorFor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 45% 42%)`;
}
export const initial = (name) => (Array.from(name.trim())[0] || '?').toUpperCase();
export const fmtTime = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export function store(key, val) { try { localStorage.setItem('pit.' + key, val); } catch (_) {} }
export function load(key) { try { return localStorage.getItem('pit.' + key); } catch (_) { return null; } }

export function beep() {
  const ctx = S.audioCtx;
  if (!ctx || ctx.state !== 'running') return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = 880; g.gain.value = 0.05;
  o.connect(g); g.connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + 0.12);
}

export function parseServer(raw) {
  let s = raw.trim();
  if (!s) throw new Error('Vui lòng nhập địa chỉ server.');
  let scheme = null;
  const m = s.match(/^(wss?|https?):\/\//i);
  if (m) { scheme = m[1].toLowerCase(); s = s.slice(m[0].length); }
  s = s.replace(/[\/?#].*$/, '');
  if (!s) throw new Error('Địa chỉ server không hợp lệ.');
  const hasPort = /:\d+$/.test(s);
  const host = s.replace(/:\d+$/, '');
  const isLocal = host === 'localhost' || host === '[::1]' || !host.includes('.') ||
                  /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  let secure;
  if (scheme) secure = scheme === 'wss' || scheme === 'https';
  else if (isLocal) secure = location.protocol === 'https:' && host !== 'localhost';
  else secure = !hasPort || location.protocol === 'https:';
  if (!hasPort && isLocal && !secure) s += ':8080';
  return (secure ? 'wss://' : 'ws://') + s;
}

export const hasMediaDevices = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

export function mediaError(e, what) {
  const label = what === 'mic' ? 'mic' : 'camera';
  if (!hasMediaDevices()) {
    toast(`Trình duyệt chặn ${label} vì trang không chạy trên HTTPS hoặc localhost. ` +
          'Hãy mở bằng http://localhost:8080 hoặc qua HTTPS (ví dụ ngrok).', 'error', 7000);
  } else if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
    toast(`Bạn chưa cho phép dùng ${label}. Hãy cấp quyền trong thanh địa chỉ của trình duyệt.`, 'error', 6000);
  } else if (e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError')) {
    toast(`Không tìm thấy thiết bị ${label}.`, 'error');
  } else if (e && e.name === 'NotReadableError') {
    toast(`Không mở được ${label} (có thể đang được ứng dụng khác sử dụng).`, 'error', 6000);
  } else {
    toast(`Không bật được ${label}: ${e && e.message ? e.message : e}`, 'error');
  }
}
