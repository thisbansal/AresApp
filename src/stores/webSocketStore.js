import { create } from 'zustand';
import { PlexWebSocketService } from '../services/plex/plexWebSocketService';
import { useServerStore } from './serverStore';
import { useServerManagerStore } from './serverManagerStore';
import { deleteImage } from '../services/luna/mediaDBService';

export const useWebSocketStore = create((set, get) => ({
  connections: {}, // Map of clientIdentifier -> PlexWebSocketService instance

  connectToServer: (clientIdentifier, uri, token) => {
    const { connections } = get();

    // If already connected/connecting to this specific URI, ignore
    const existing = connections[clientIdentifier];
    if (existing && existing.uri === uri) {
      existing.connect(); // Ensure it's connecting
      return;
    }

    // Disconnect old if exists
    if (existing) {
      existing.disconnect();
    }

    console.log(`[WebSocket Store] Initializing connection for ${clientIdentifier} at ${uri}`);

    const wsService = new PlexWebSocketService(
      uri,
      token,
      clientIdentifier,
      // onEvent Callback
      (notification) => {
        get().handleNotification(clientIdentifier, notification);
      },
      // onStatusChange Callback
      (isOnline, error) => {
        get().handleStatusChange(clientIdentifier, isOnline, error);
      }
    );

    wsService.connect();

    set(state => ({
      connections: {
        ...state.connections,
        [clientIdentifier]: wsService
      }
    }));
  },

  disconnectFromServer: (clientIdentifier) => {
    const { connections } = get();
    const ws = connections[clientIdentifier];
    if (ws) {
      ws.disconnect();
      const newConnections = { ...connections };
      delete newConnections[clientIdentifier];
      set({ connections: newConnections });
    }
  },

  disconnectAll: () => {
    const { connections } = get();
    Object.values(connections).forEach(ws => ws.disconnect());
    set({ connections: {} });
  },

  reconnectAll: () => {
    console.log('[WebSocket Store] Reconnecting all sockets (e.g. App Resume)');
    const { connections } = get();
    Object.values(connections).forEach(ws => {
      // Tear down the zombie socket, but wait before recreating 
      // to avoid overlapping multiple connections in the browser
      ws.disconnect();
      setTimeout(() => {
        ws.connect();
      }, 500);
    });
  },

  handleStatusChange: (clientIdentifier, isOnline, error) => {
    // If this is the currently active server, update the global serverStore
    const activeServer = useServerStore.getState().activeServer;
    // We don't have activeServer clientId easily accessible, but we can check if URI matches
    // Or better, just dispatch it if it matches activeServer's URI
    const ws = get().connections[clientIdentifier];
    if (ws && activeServer && ws.uri === activeServer.uri) {
      useServerStore.getState().setServerState(isOnline, error);
    }

    // Update serverManagerStore.servers
    const smStore = useServerManagerStore.getState();
    const server = smStore.servers[clientIdentifier];
    if (server) {
      useServerManagerStore.setState(state => ({
        servers: {
          ...state.servers,
          [clientIdentifier]: {
            ...state.servers[clientIdentifier],
            isOnline: isOnline
          }
        }
      }));
    }
  },

  handleNotification: (clientIdentifier, notification) => {
    // Dispatch based on notification type
    const { type } = notification;
    
    switch (type) {
      case 'playing':
      case 'timeline':
        // State 9 indicates the media was deleted on the server
        if (notification.state === 9 && notification.itemID) {
          console.log(`[WebSocket Store] Media deleted on server (itemID: ${notification.itemID}). Clearing cached images...`);
          deleteImage(notification.itemID).catch(err => console.error('[WebSocket Store] Error clearing cached image for deleted media:', err));
        }

        // Dispatch custom DOM event so hooks like useToggleWatched or useEpisodes can listen
        window.dispatchEvent(new CustomEvent('plex-ws-playback-update', { 
          detail: { clientIdentifier, notification } 
        }));
        break;

      case 'activity':
        // Library scan finished, etc.
        if (notification.Activity) {
          const type = notification.Activity.type || '';
          const isLibraryScan = type.startsWith('library.');
          // It can be library.refresh.items, library.update.section, etc.
          // Trigger the update when progress is 100 or state is 'finished'
          if (isLibraryScan && (notification.Activity.progress === 100 || notification.Activity.state === 'finished')) {
            window.dispatchEvent(new CustomEvent('plex-ws-library-updated', {
              detail: { clientIdentifier }
            }));
          }
        }
        break;

      case 'reachability':
        // Handled via onStatusChange generally, but can process reachability packets too
        break;

      case 'update.statechange':
        // Direct state change (e.g., item added/removed/metadata refreshed)
        window.dispatchEvent(new CustomEvent('plex-ws-library-updated', {
          detail: { clientIdentifier }
        }));
        break;

      case 'transcode.session.update':
      case 'transcode.session.end':
      case 'transcode.session.start':
        window.dispatchEvent(new CustomEvent('plex-ws-transcode-update', {
          detail: { clientIdentifier, notification }
        }));
        break;

      default:
        // Ignoring other notifications for now (e.g., status, preference)
        break;
    }
  }
}));
