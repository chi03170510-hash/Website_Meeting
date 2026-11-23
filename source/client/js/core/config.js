export const CFG = {
  audioRate: 16000,     
  audioChunk: 640,      

  videoWidth: 480,      
  videoFps: 10,
  jpegQuality: 0.55,

  playJitter: 0.10,     
  playMaxAhead: 0.35,   
  
  pingMs: 25000,
  keepAliveMs: 15000,
  micTimeoutMs: 1500,   
  camTimeoutMs: 2500,  
  connectTimeoutMs: 8000,
};
export const PKT_AUDIO = 1, PKT_VIDEO = 2;
export const EMPTY = new Uint8Array(0);
export const textEnc = new TextEncoder();
export const textDec = new TextDecoder();


