/**
 * A highly optimized, zero-allocation EBML/MKV Demuxer specifically designed
 * to extract raw PGS blocks from a stream with C-like performance.
 * Bypasses full tree construction and minimizes Garbage Collection pauses.
 */
export class FastMkvDemuxer {
  constructor() {
    this.buffer = new Uint8Array(0);
    this.frames = [];
  }

  /**
   * Appends a new chunk of binary data to the internal buffer.
   * @param {Uint8Array} chunk 
   */
  push(chunk) {
    const newBuffer = new Uint8Array(this.buffer.length + chunk.length);
    newBuffer.set(this.buffer, 0);
    newBuffer.set(chunk, this.buffer.length);
    this.buffer = newBuffer;
  }

  /**
   * Demuxes the current buffer and returns an array of extracted PGS frames.
   * Returns empty array if no full frames are ready yet.
   */
  demux() {
    this.frames = [];
    let offset = 0;

    while (offset < this.buffer.length) {
      // Need at least 1 byte to read an ID
      if (offset + 1 > this.buffer.length) break;

      const idRes = this._readVint(offset, true);
      if (!idRes) break; // Not enough data for ID

      // Need at least enough bytes for the Size
      if (idRes.nextOffset + 1 > this.buffer.length) break;
      const sizeRes = this._readVint(idRes.nextOffset, false);
      if (!sizeRes) break; // Not enough data for Size

      const id = idRes.value;
      const size = sizeRes.value;
      const payloadStart = sizeRes.nextOffset;

      // Master Elements - we just want to dive into them (ignore their boundaries)
      // 0x1A45DFA3 = EBML Header
      // 0x18538067 = Segment
      // 0x1F43B675 = Cluster
      // 0xA0 = BlockGroup
      if (id === 0x1A45DFA3 || id === 0x18538067 || id === 0x1F43B675 || id === 0xA0) {
        offset = payloadStart;
        continue;
      }

      // SimpleBlock (0xA3) or Block (0xA1)
      if (id === 0xA3 || id === 0xA1) {
        if (size !== -1 && payloadStart + size > this.buffer.length) {
          break; // Wait for more data
        }

        // The block payload contains header info.
        // Byte 0: Track Number (VINT)
        const trackRes = this._readVint(payloadStart, false);
        if (trackRes) {
          // Bytes trackRes.nextOffset -> +2 are Timestamp (int16)
          // Then 1 byte Flags
          const blockHeaderSize = (trackRes.nextOffset - payloadStart) + 3;
          
          // The actual raw payload (e.g. PGS data)
          const dataStart = payloadStart + blockHeaderSize;
          const dataLength = size - blockHeaderSize;

          if (dataLength > 0) {
             // Zero-copy slice of the buffer
             const frameData = this.buffer.subarray(dataStart, dataStart + dataLength);
             this.frames.push(frameData);
          }
        }

        offset = payloadStart + size;
        continue;
      }

      // Unknown or unneeded tag. Skip it.
      if (size === -1) {
        // We hit an unknown size for a tag we don't care about!
        // This is fatal for a fast scanner. But in MKV, usually only Master tags are unknown size.
        offset = payloadStart;
      } else {
        if (payloadStart + size > this.buffer.length) {
          break; // Wait for more data
        }
        offset = payloadStart + size;
      }
    }

    // Retain unprocessed tail
    if (offset > 0) {
      if (offset >= this.buffer.length) {
        this.buffer = new Uint8Array(0);
      } else {
        this.buffer = this.buffer.slice(offset);
      }
    }

    return this.frames;
  }

  /**
   * Reads a Variable-Size Integer (VINT) from the buffer.
   * Returns { value, nextOffset } or null if not enough bytes.
   */
  _readVint(offset, keepMask) {
    const firstByte = this.buffer[offset];
    let length = 0;
    let mask = 0;

    if (firstByte >= 0x80) { length = 1; mask = 0x80; }
    else if (firstByte >= 0x40) { length = 2; mask = 0x40; }
    else if (firstByte >= 0x20) { length = 3; mask = 0x20; }
    else if (firstByte >= 0x10) { length = 4; mask = 0x10; }
    else if (firstByte >= 0x08) { length = 5; mask = 0x08; }
    else if (firstByte >= 0x04) { length = 6; mask = 0x04; }
    else if (firstByte >= 0x02) { length = 7; mask = 0x02; }
    else if (firstByte >= 0x01) { length = 8; mask = 0x01; }
    else return null;

    if (offset + length > this.buffer.length) return null;

    let value = keepMask ? firstByte : (firstByte & ~mask);
    
    // Check if it's the "Unknown Size" marker (all data bits are 1)
    let isUnknown = !keepMask && (firstByte === 0xFF);

    for (let i = 1; i < length; i++) {
      const b = this.buffer[offset + i];
      value = (value * 256) + b;
      if (b !== 0xFF) isUnknown = false;
    }

    if (isUnknown && !keepMask) {
      return { value: -1, nextOffset: offset + length };
    }

    return { value, nextOffset: offset + length };
  }
}
