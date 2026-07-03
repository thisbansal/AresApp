import { PLEX_CONFIG } from '../../config/app';

export class PlexWebSocketService {
  constructor(uri, token, clientIdentifier, onEvent, onStatusChange) {
    this.uri = uri;
    this.token = token;
    this.clientIdentifier = clientIdentifier;
    this.onEvent = onEvent;
    this.onStatusChange = onStatusChange; // (isOnline, error)
    
    this.ws = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseBackoff = 1000;
    this.isIntentionallyClosed = false;
  }

  getWebSocketUrl() {
    try {
      const urlObj = new URL(this.uri);
      // Map http to ws, https to wss
      const protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = new URL(`${protocol}//${urlObj.host}/:/websockets/notifications`);
      
      wsUrl.searchParams.append('X-Plex-Token', this.token);
      wsUrl.searchParams.append('X-Plex-Client-Identifier', PLEX_CONFIG.clientId);
      
      return wsUrl.toString();
    } catch (e) {
      console.error('[WebSocket] Invalid URI:', this.uri);
      return null;
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = this.getWebSocketUrl();
    if (!wsUrl) return;

    this.isIntentionallyClosed = false;
    console.log(`[WebSocket] Connecting to ${this.clientIdentifier} at ${wsUrl.split('?')[0]}...`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[WebSocket] Connected to ${this.clientIdentifier}`);
        this.reconnectAttempts = 0;
        if (this.onStatusChange) this.onStatusChange(true, null);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.NotificationContainer) {
            const containerType = data.NotificationContainer.type;
            
            // Plex uses different keys for the array of events based on the type
            // e.g., ActivityNotification, PlaySessionStateNotification, TimelineEntry
            let notifications = [];
            for (const key of Object.keys(data.NotificationContainer)) {
              if (Array.isArray(data.NotificationContainer[key])) {
                notifications = data.NotificationContainer[key];
                break;
              }
            }

            if (notifications.length > 0) {
              notifications.forEach(notif => {
                // Ensure the individual notification has a type for the switch statement
                notif.type = containerType;
                if (this.onEvent) this.onEvent(notif);
              });
            }
          }
        } catch (e) {
          console.error('[WebSocket] Error parsing message:', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`[WebSocket] Closed for ${this.clientIdentifier}. Code: ${event.code}`);
        this.ws = null;
        if (this.onStatusChange) this.onStatusChange(false, null);
        
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error(`[WebSocket] Error for ${this.clientIdentifier}`);
        if (this.onStatusChange) this.onStatusChange(false, error);
      };

    } catch (error) {
      console.error(`[WebSocket] Failed to initialize for ${this.clientIdentifier}:`, error);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.isIntentionallyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[WebSocket] Max reconnect attempts reached for ${this.clientIdentifier}`);
      return;
    }

    const backoff = Math.min(this.baseBackoff * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[WebSocket] Scheduling reconnect to ${this.clientIdentifier} in ${backoff}ms...`);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, backoff);
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
