class TinyDemuxer {
  constructor() { this.buffer = new Uint8Array(0); }
  push(chunk) {
    const newBuf = new Uint8Array(this.buffer.length + chunk.length);
    newBuf.set(this.buffer, 0);
    newBuf.set(chunk, this.buffer.length);
    this.buffer = newBuf;
  }
  readVint(offset) {
    let b = this.buffer[offset]; let length = 1; let mask = 0x80;
    while (!(b & mask)) { length++; mask >>= 1; }
    let value = b & ~mask;
    for (let i = 1; i < length; i++) value = value * 256 + this.buffer[offset + i];
    return { length, value };
  }
  readSignedVint(offset) {
    let res = this.readVint(offset);
    if (!res) return null;
    let shift = Math.pow(2, 7 * res.length - 1) - 1;
    return { length: res.length, value: res.value - shift };
  }
}
const d = new TinyDemuxer();
d.push(new Uint8Array([0x80 | 0x01])); // VINT 1 -> Signed: 1 - (2^6 - 1) = 1 - 63 = -62
console.log(d.readSignedVint(0).value);
