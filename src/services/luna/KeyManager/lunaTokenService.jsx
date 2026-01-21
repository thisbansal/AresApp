const Service = require('webos-service');
const { PLEX_CONFIG } = require('../../../config/app');
const service = new Service(PLEX_CONFIG.appId);

const KEY_ID = 'plex-token';

service.register('saveToken', (msg) => {
  service.call(
    'luna://com.webos.service.keymanager3',
    {
      method: 'store',
      parameters: {
        key: KEY_ID,
        data: msg.payload.token,
        appId: service.serviceId
      }
    },
    (res) => {
      if (!res.returnValue) {
        msg.respond({ returnValue: false, errorText: res.errorText });
        return;
      }
      msg.respond({ returnValue: true });
    }
  );
});

service.register('getToken', (msg) => {
  service.call(
    'luna://com.webos.service.keymanager3',
    {
      method: 'retrieve',
      parameters: {
        key: KEY_ID,
        appId: service.serviceId
      }
    },
    (res) => {
      if (!res.returnValue) {
        msg.respond({ returnValue: false });
        return;
      }
      msg.respond({ returnValue: true, token: res.data });
    }
  );
});

service.register('clearToken', (msg) => {
  service.call(
    'luna://com.webos.service.keymanager3',
    {
      method: 'remove',
      parameters: {
        key: KEY_ID,
        appId: service.serviceId
      }
    },
    (res) => {
      msg.respond({ returnValue: !!res.returnValue });
    }
  );
});