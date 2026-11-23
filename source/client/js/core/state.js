export const S = {
  base: '', room: '', name: '', password: '',
  sig: null, media: null, state: 'join',  
  myId: null, hostId: null,
  peers: new Map(),                         
  requests: new Map(),                      
  micOn: false, camOn: false,
  mic: null, cam: null,
  audioCtx: null, workletReady: false,
  hdr: { 1: null, 2: null },
  timers: [], joinedAt: 0,
  sideTab: null, unreadChat: 0,
};
