import { WebSocketServer } from "ws";
import { logD } from "../common/MessageUtil.js";

export function createWebSocketService({ server, fileWatcher, publicUrl = '' }) {
  const wsPath = publicUrl ? `${publicUrl}/ws` : '/ws';
  const wss = new WebSocketServer({
    server,
    path: wsPath,
    // Verify client connection
    verifyClient: (info, callback) => {
      // Log the upgrade request
      console.log(`[WS] WebSocket upgrade request from: ${info.req.socket.remoteAddress}`);
      console.log(`[WS] Request path: ${info.req.url}`);
      console.log(`[WS] Request headers:`, {
        'sec-websocket-key': info.req.headers['sec-websocket-key'],
        'sec-websocket-version': info.req.headers['sec-websocket-version'],
        'upgrade': info.req.headers['upgrade'],
        'connection': info.req.headers['connection']
      });

      // Check if required headers are present
      if (!info.req.headers['sec-websocket-key']) {
        console.error('[WS] Missing Sec-WebSocket-Key header');
        callback(false, 400, 'Missing Sec-WebSocket-Key header');
        return;
      }

      // Accept the connection
      callback(true);
    }
  });

  logD(`[WS] WebSocket server listening on path: ${wsPath}`);

  const clients = new Set();

  wss.on('connection', (ws, req) => {
    const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
    logD(`[WS] Client connected: ${clientId}`);
    clients.add(ws);

    // Send initial connection success message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket connection established',
      timestamp: Date.now()
    }));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        logD(`[WS] Received message from ${clientId}:`, message);

        // Handle ping/pong for keep-alive
        if (message.type === 'ping') {
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.error('[WS] Error parsing message:', err);
      }
    });

    ws.on('close', () => {
      logD(`[WS] Client disconnected: ${clientId}`);
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error(`[WS] Error with client ${clientId}:`, error);
      clients.delete(ws);
    });
  });

  // Listen for file system changes and broadcast to all clients
  const removeListener = fileWatcher.addListener((event) => {
    logD(`[WS] Broadcasting file change event to ${clients.size} clients`);

    const message = JSON.stringify({
      type: 'file-change',
      data: {
        category: event.category,
        changeType: event.type,
        filename: event.filename,
        username: event.username, // Include username for multi-user filtering
        timestamp: event.timestamp
      }
    });

    clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message);
        } catch (err) {
          console.error('[WS] Error sending message to client:', err);
        }
      }
    });
  });

  function close() {
    logD(`[WS] Closing WebSocket server and disconnecting ${clients.size} clients`);

    // Remove file watcher listener
    removeListener();

    // Close all client connections
    clients.forEach((client) => {
      try {
        client.close();
      } catch (err) {
        console.error('[WS] Error closing client:', err);
      }
    });

    // Close the WebSocket server
    wss.close(() => {
      logD('[WS] WebSocket server closed');
    });
  }

  return {
    wss,
    close,
    getClientCount: () => clients.size
  };
}
