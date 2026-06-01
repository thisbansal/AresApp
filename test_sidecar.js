const { plexStreamBuilder } = require('./src/services/plex/plexStreamBuilder.js');
const serverInfo = { uri: 'http://192.168.68.54:32400', token: 'BzxRTXNUxyJxrUbAPxj8' };
const ratingKey = '/library/metadata/77074';
const playbackSessionId = 'testsession123';
const url = plexStreamBuilder.buildOfficialSidecarUrl(serverInfo, ratingKey, playbackSessionId, 300000, false);
console.log(url);
