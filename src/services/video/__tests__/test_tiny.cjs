const fs = require('fs');

class TinyDemuxer {
  constructor() {
    this.buffer = new Uint8Array(0);
    this.count = 0;
  }
  
  push(chunk) {
    const newBuf = new Uint8Array(this.buffer.length + chunk.length);
    newBuf.set(this.buffer, 0);
    newBuf.set(chunk, this.buffer.length);
    this.buffer = newBuf;
  }
  
  readVint(offset) {
    if (offset >= this.buffer.length) return null;
    let b = this.buffer[offset];
    if (b === 0) return null; // Invalid
    let length = 1;
    let mask = 0x80;
    while (!(b & mask)) {
      length++;
      mask >>= 1;
    }
    if (offset + length > this.buffer.length) return null;
    
    let value = b & ~mask;
    for (let i = 1; i < length; i++) {
      value = value * 256 + this.buffer[offset + i];
    }
    
    // Check if unknown
    let isUnknown = true;
    for (let i = 0; i < length; i++) {
      let bVal = this.buffer[offset + i];
      if (i === 0) bVal = bVal | mask;
      if (bVal !== 0xFF) isUnknown = false;
    }
    if (isUnknown) value = -1;
    
    return { length, value };
  }
  
  readId(offset) {
     if (offset >= this.buffer.length) return null;
     let b = this.buffer[offset];
     let length = 1;
     let mask = 0x80;
     while (!(b & mask)) {
       length++;
       mask >>= 1;
     }
     if (offset + length > this.buffer.length) return null;
     let id = 0;
     for (let i = 0; i < length; i++) {
       id = id * 256 + this.buffer[offset + i];
     }
     return { length, id };
  }
  
  demux() {
    let frames = [];
    let offset = 0;
    
    while (offset < this.buffer.length) {
      const idRes = this.readId(offset);
      if (!idRes) break;
      
      const sizeRes = this.readVint(offset + idRes.length);
      if (!sizeRes) break;
      
      const elementSize = sizeRes.value;
      const headerLength = idRes.length + sizeRes.length;
      const id = idRes.id;
      
      if (elementSize === -1) {
        offset += headerLength;
        continue;
      }
      
      if (offset + headerLength + elementSize > this.buffer.length) {
        break; // Need more data
      }
      
      if (id === 0xA3 || id === 0xA1) { // SimpleBlock or Block
         const payloadOffset = offset + headerLength;
         let trackNoVint = this.readVint(payloadOffset);
         if (trackNoVint) {
             const trackNo = trackNoVint.value;
             const trackHeaderLen = trackNoVint.length + 3; // +2 timestamp, +1 flags
             const frameData = this.buffer.slice(payloadOffset + trackHeaderLen, payloadOffset + elementSize);
             frames.push(frameData);
             this.count++;
         }
      }
      
      if (id === 0x18538067 || id === 0x1F43B675 || id === 0xA0) { // Segment, Cluster, BlockGroup
         offset += headerLength;
      } else {
         offset += headerLength + elementSize;
      }
    }
    
    if (offset > 0) {
      this.buffer = this.buffer.slice(offset);
    }
    
    return frames;
  }
}

const demuxer = new TinyDemuxer();
const stream = fs.createReadStream('test1.mkv', { highWaterMark: 8186 });
stream.on('data', chunk => {
   demuxer.push(chunk);
   const frames = demuxer.demux();
   if (frames.length > 0) {
      // console.log("Extracted frames:", frames.length);
   }
});
stream.on('end', () => {
   console.log("Done parsing with TinyDemuxer. Total frames:", demuxer.count);
});
