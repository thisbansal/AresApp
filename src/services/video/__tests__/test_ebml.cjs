const { Decoder } = require('ebml');
const fs = require('fs');

const decoder = new Decoder();
const stream = fs.createReadStream('test1.mkv', { highWaterMark: 8186 });

decoder.on('data', chunk => {
    // console.log(chunk[0] + " " + chunk[1].name);
    if (chunk[1].name === 'SimpleBlock' || chunk[1].name === 'Block') {
        const data = chunk[1].data;
        const trackNo = data[0]; // Wait, track no is a VINT in SimpleBlock
        // This is just a test to see if it parses without crashing!
    }
});

stream.pipe(decoder);

stream.on('end', () => {
    console.log("Done parsing stream");
});
