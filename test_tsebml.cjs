const { Decoder } = require('ts-ebml');
const fs = require('fs');

const decoder = new Decoder();
const stream = fs.createReadStream('test1.mkv', { highWaterMark: 8186 });

stream.on('data', chunk => {
    try {
        const elms = decoder.decode(chunk);
        for (const elm of elms) {
            // console.log(elm.name, elm.type);
            if (elm.name === 'SimpleBlock' && elm.type === 'b') {
                const data = elm.data;
                // console.log("Got SimpleBlock of length", data.length);
            }
        }
    } catch(e) {
        console.error("Crash", e);
    }
});

stream.on('end', () => {
    console.log("Done parsing stream with ts-ebml");
});
