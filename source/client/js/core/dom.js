export const $ = (id) => document.getElementById(id);
export const el = {
  screens: { join: $('screen-join'), wait: $('screen-wait'), room: $('screen-room') },
  joinForm: $('join-form'), inpName: $('inp-name'), inpRoom: $('inp-room'), inpPassword: $('inp-password'), inpServer: $('inp-server'),
  btnJoin: $('btn-join'), joinError: $('join-error'), joinWarn: $('join-warn'),
  waitRoom: $('wait-room'), btnWaitCancel: $('btn-wait-cancel'),
  roomTitle: $('room-title'), hostBadge: $('host-badge'), clock: $('clock'), count: $('count'),
  requests: $('requests'), grid: $('grid'),
  sidebar: $('sidebar'), btnSideClose: $('btn-side-close'),
  chatLog: $('chat-log'), chatForm: $('chat-form'), chatInput: $('chat-input'),
  peopleList: $('people-list'), peopleCount: $('people-count'),
  btnMic: $('btn-mic'), btnCam: $('btn-cam'), btnPeople: $('btn-people'), btnChat: $('btn-chat'), btnLeave: $('btn-leave'),
  chatDot: $('chat-dot'), peopleDot: $('people-dot'), toasts: $('toasts'),
};
