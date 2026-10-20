// Peer-to-peer co-op over WebRTC with copy-paste signalling (no server).
// Host: createOffer() -> share code; guest: acceptOffer(code) -> share reply;
// host: acceptAnswer(reply). A public STUN server helps across NATs.

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

async function deflate(text: string) {
  const data = new TextEncoder().encode(text);
  if (typeof (window as any).CompressionStream === 'undefined') return 'R' + btoa(String.fromCharCode(...data));
  const cs = new (window as any).CompressionStream('deflate-raw');
  const out = await new Response(new Blob([data]).stream().pipeThrough(cs)).arrayBuffer();
  let bin = ''; new Uint8Array(out).forEach(b => { bin += String.fromCharCode(b); });
  return 'Z' + btoa(bin);
}
async function inflate(code: string) {
  const kind = code[0], b64 = code.slice(1).replace(/\s+/g, '');
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (kind === 'R') return new TextDecoder().decode(bytes);
  const ds = new (window as any).DecompressionStream('deflate-raw');
  return await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
}

function waitIce(pc: RTCPeerConnection) {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const done = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', done); resolve(); } };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(resolve, 4000); // good enough: use whatever candidates we have
  });
}

export class Peer {
  [key: string]: any;
  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: ICE });
    this.channel = null;
    this.handlers = new Set();
    this.onOpen = () => {};
    this.onClose = () => {};
    this.pc.addEventListener('connectionstatechange', () => {
      if (['failed', 'closed', 'disconnected'].includes(this.pc.connectionState)) this.onClose();
    });
  }

  private wire(ch: RTCDataChannel) {
    this.channel = ch;
    ch.onopen = () => this.onOpen();
    ch.onclose = () => this.onClose();
    ch.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } this.handlers.forEach((h: any) => h(m)); };
  }

  async createOffer() {
    this.role = 'host';
    this.wire(this.pc.createDataChannel('room', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await waitIce(this.pc);
    return deflate(JSON.stringify(this.pc.localDescription));
  }

  async acceptOffer(code: string) {
    this.role = 'guest';
    this.pc.addEventListener('datachannel', (e) => this.wire(e.channel));
    await this.pc.setRemoteDescription(JSON.parse(await inflate(code.trim())));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await waitIce(this.pc);
    return deflate(JSON.stringify(this.pc.localDescription));
  }

  async acceptAnswer(code: string) {
    await this.pc.setRemoteDescription(JSON.parse(await inflate(code.trim())));
  }

  get open() { return !!this.channel && this.channel.readyState === 'open'; }
  send(msg) { if (this.open) this.channel.send(JSON.stringify(msg)); }
  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  close() { try { this.channel && this.channel.close(); this.pc.close(); } catch (e) { /* ignore */ } }
}
