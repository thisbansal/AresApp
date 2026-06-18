const serverInfo = { uri: 'http://192.168.68.54:32400', token: 'BzxRTXNUxyJxrUbAPxj8' };
const ratingKey = '/library/metadata/76604';
const playbackSessionId = 'testsession456';
const offsetSeconds = 1000;

const paramsObj = {
  'directPlay': '1',
  'directStream': '1',
  'directStreamAudio': '1',
  'protocol': 'http',
  'fastSeek': '1',
  'path': ratingKey,
  'session': playbackSessionId,
  'mediaIndex': '0',
  'partIndex': '0',
  'mediaBufferSize': '50000',
  'hasMDE': '1',
  'subtitleSize': '100',
  'videoQuality': '100',
  'videoResolution': '3840x2160',
  'audioBoost': '100',
  'autoAdjustSubtitle': '1',
  'subtitles': 'sidecar',
  'location': 'lan',
  'copyts': '1',
  'offset': offsetSeconds.toString(),
  'X-Plex-Token': serverInfo.token,
  'X-Plex-Client-Identifier': 'ares-webos-client',
  'X-Plex-Session-Identifier': playbackSessionId,
  'X-Plex-Product': 'Runex',
  'X-Plex-Platform': 'webOS',
  'X-Plex-Client-Profile-Name': 'Generic',
  'X-Plex-Client-Profile-Extra': 'add-transcode-target(type=subtitleProfile&protocol=http&context=all&subtitleCodec=vtt&container=vtt)'
};

const decisionParams = new URLSearchParams({...paramsObj, protocol: 'dash'});
const startParams = new URLSearchParams(paramsObj);

const decisionUrl = `${serverInfo.uri}/video/:/transcode/universal/decision?${decisionParams.toString()}`;
const startUrl = `${serverInfo.uri}/subtitles/:/transcode/universal/start?${startParams.toString()}`;

const headers = {
  'Accept': 'application/json, */*',
  'X-Plex-Token': serverInfo.token,
  'X-Plex-Client-Identifier': 'ares-webos-client',
  'X-Plex-Product': 'Runex',
  'X-Plex-Platform': 'webOS',
  'X-Plex-Session-Id': playbackSessionId,
  'X-Plex-Client-Profile-Name': 'Generic',
  'X-Plex-Client-Profile-Extra': 'add-transcode-target(type=subtitleProfile&protocol=http&context=all&subtitleCodec=srt&container=srt)'
};

async function test() {
  console.log("Pinging decision endpoint...");
  const res1 = await fetch(decisionUrl, { headers });
  console.log("Decision status:", res1.status);
  
  console.log("Fetching start endpoint...");
  const res2 = await fetch(startUrl, { headers });
  console.log("Start status:", res2.status);
  
  const reader = res2.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while(true) {
    const {done, value} = await reader.read();
    if(value) {
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      if (lines.length > 15) {
         console.log(lines.slice(0, 15).join('\n'));
         break;
      }
    }
    if(done) break;
  }
}
test();
