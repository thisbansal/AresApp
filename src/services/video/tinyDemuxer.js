export class TinyDemuxer {
  constructor() {
    this.buffer = new Uint8Array(0);
    this.count = 0;
    this.clusterTimecode = 0;
    this.hasLoggedFirstFrame = false;
    this.firstFrameTs = null;
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
  
  readSignedVint(offset) {
    let res = this.readVint(offset);
    if (!res) return null;
    let shift = Math.pow(2, 7 * res.length - 1) - 1;
    return { length: res.length, value: res.value - shift };
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
      
      if (id === 0x18538067 || id === 0x1F43B675 || id === 0xA0) { // Segment, Cluster, BlockGroup
         offset += headerLength;
         continue;
      }
      
      if (offset + headerLength + elementSize > this.buffer.length) {
        break; // Need more data
      }
      
      if (id === 0xE7) { // Cluster Timecode
          let tc = 0;
          for (let i = 0; i < elementSize; i++) {
              tc = tc * 256 + this.buffer[offset + headerLength + i];
          }
          this.clusterTimecode = tc;
      }
      
      if (id === 0xA3 || id === 0xA1) { // SimpleBlock or Block
         const payloadOffset = offset + headerLength;
         let trackNoVint = this.readVint(payloadOffset);
         if (trackNoVint) {
             const trackNoLen = trackNoVint.length;
             // Timestamp is Int16
             let blockTs = (this.buffer[payloadOffset + trackNoLen] << 8) | this.buffer[payloadOffset + trackNoLen + 1];
             if (blockTs & 0x8000) blockTs -= 0x10000; // Sign extend
             
             const absoluteTsMs = this.clusterTimecode + blockTs;
             
             if (!this.hasLoggedFirstFrame) {
                 console.log(`[TinyDemuxer] FIRST FRAME EXTRACTED! ts=${absoluteTsMs}ms`);
                 this.firstFrameTs = absoluteTsMs;
                 this.hasLoggedFirstFrame = true;
             }
             
             // Check if lacing is used
             const flags = this.buffer[payloadOffset + trackNoLen + 2];
             const lacing = (flags & 0x06) >> 1;
             const trackHeaderLen = trackNoLen + 3;
             
             if (lacing === 0) { // No lacing
                 const frameData = this.buffer.slice(payloadOffset + trackHeaderLen, payloadOffset + elementSize);
                 frames.push({ ts: absoluteTsMs, data: frameData });
                 this.count++;
             } else {
                 let lacingOffset = payloadOffset + trackHeaderLen;
                 const numFrames = this.buffer[lacingOffset] + 1;
                 lacingOffset++;
                 
                 const frameSizes = [];
                 let totalLacedSize = 0;
                 
                 if (lacing === 1) { // Xiph lacing
                     for (let i = 0; i < numFrames - 1; i++) {
                         let size = 0;
                         while (this.buffer[lacingOffset] === 0xFF) {
                             size += 255;
                             lacingOffset++;
                         }
                         size += this.buffer[lacingOffset];
                         lacingOffset++;
                         frameSizes.push(size);
                         totalLacedSize += size;
                     }
                 } else if (lacing === 3) { // EBML lacing
                     let firstRes = this.readVint(lacingOffset);
                     let size = firstRes.value;
                     lacingOffset += firstRes.length;
                     frameSizes.push(size);
                     totalLacedSize += size;
                     
                     for (let i = 1; i < numFrames - 1; i++) {
                         let res = this.readSignedVint(lacingOffset);
                         let diff = res.value;
                         size += diff;
                         lacingOffset += res.length;
                         frameSizes.push(size);
                         totalLacedSize += size;
                     }
                 } else if (lacing === 2) { // Fixed-size lacing
                     let size = (elementSize - (lacingOffset - payloadOffset)) / numFrames;
                     for (let i = 0; i < numFrames - 1; i++) {
                         frameSizes.push(size);
                         totalLacedSize += size;
                     }
                 }
                 
                 // Last frame size is the remainder
                 frameSizes.push(elementSize - (lacingOffset - payloadOffset) - totalLacedSize);
                 
                 for (let i = 0; i < numFrames; i++) {
                     const size = frameSizes[i];
                     const frameData = this.buffer.slice(lacingOffset, lacingOffset + size);
                     frames.push({ ts: absoluteTsMs, data: frameData });
                     lacingOffset += size;
                 }
                 this.count += numFrames;
             }
         }
      }
      
      offset += headerLength + elementSize;
    }
    
    if (offset > 0) {
      this.buffer = this.buffer.slice(offset);
    }
    
    return frames;
  }
}
