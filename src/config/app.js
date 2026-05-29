export const PLEX_CONFIG = {
  clientId: '877f312d-6d9b-4877-8698-6894470023fc',
  product: 'Ares App',
  device: 'webOS TV',
  apiUrl: 'https://plex.tv/api/v2',
  appID: 'com.nookbyte.aresapp',
  version: '1.0.0',
  features: {
    enableSmartTranscoding: true // Set to false to disable smart transcode fallback
  }
};

export const KINDS = {
  server: 'plexServerAddress',
  preferences: 'appPreferences'
}