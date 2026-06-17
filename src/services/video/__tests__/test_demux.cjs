const mkvdemuxjs = require('mkvdemuxjs');
const fs = require('fs');
const demuxer = new mkvdemuxjs.MkvDemux();

const stream = fs.createReadStream('test1.mkv', { highWaterMark: 8186 });

let chunksRead = 0;
stream.on('data', (chunk) => {
    chunksRead++;
    // console.log(`Received chunk #${chunksRead} of size ${chunk.byteLength}`);
    demuxer.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
    let part = null;
    while ((part = demuxer.demux()) !== null) {
        if (part.track) {
            console.log("Track:", part.track);
        } else if (part.frames) {
            // console.log("Frames:", part.frames.length);
        }
    }
});

stream.on('end', () => {
    console.log("Done");
});
