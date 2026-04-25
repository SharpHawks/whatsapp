# WebSocket Events Documentation

## Overview

The WhatsApp API Platform uses Socket.IO for real-time communication between the server and clients. This document describes all available WebSocket events.

## Connection

### Authentication

WebSocket connections require JWT authentication:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});
```

### Connection Events

**Event:** `connected`
- **Direction:** Server → Client
- **Description:** Sent immediately after successful connection
- **Payload:**
  ```json
  {
    "message": "Connected to WhatsApp API"
  }
  ```

---

## Bot Events

### Bot Status Update

**Event:** `bot:status`
- **Direction:** Server → Client
- **Description:** Bot connection status changed
- **Payload:**
  ```json
  {
    "botId": "uuid",
    "status": "connected" | "connecting" | "disconnected" | "qr_required",
    "phoneNumber": "+1234567890",
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**Example:**
```javascript
socket.on('bot:status', (data) => {
  console.log(`Bot ${data.botId} status: ${data.status}`);
  if (data.status === 'connected') {
    console.log(`Phone: ${data.phoneNumber}`);
  }
});
```

---

### Bot QR Code

**Event:** `bot:qr`
- **Direction:** Server → Client
- **Description:** QR code generated for bot connection
- **Payload:**
  ```json
  {
    "botId": "uuid",
    "qrCode": "base64_encoded_qr_code_string",
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**Example:**
```javascript
socket.on('bot:qr', (data) => {
  console.log(`QR code for bot ${data.botId}`);
  // Display QR code in UI
  displayQRCode(data.qrCode);
});
```

---

### API Key Generated 🆕

**Event:** `bot:apikey:generated`
- **Direction:** Server → Client
- **Description:** API key automatically generated after bot connection
- **Payload:**
  ```json
  {
    "botId": "uuid",
    "key": "sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "expiresAt": "2024-01-15T10:35:00Z",
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**Important Notes:**
- This event is sent only once when the bot first connects
- The key is available for 5 minutes (until `expiresAt`)
- After expiration, use the API to regenerate the key
- Store the key securely immediately upon receipt

**Example:**
```javascript
socket.on('bot:apikey:generated', (data) => {
  console.log(`API key generated for bot ${data.botId}`);
  console.log(`Key: ${data.key}`);
  console.log(`Expires at: ${data.expiresAt}`);
  
  // Display in modal/notification
  showApiKeyModal({
    botId: data.botId,
    key: data.key,
    expiresAt: data.expiresAt
  });
});
```

---

## Message Events

### New Message

**Event:** `message:new`
- **Direction:** Server → Client
- **Description:** New message received by bot
- **Payload:**
  ```json
  {
    "botId": "uuid",
    "message": {
      "id": "uuid",
      "from": "+1234567890",
      "to": "+0987654321",
      "type": "text",
      "content": {
        "text": "Hello!"
      },
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**Example:**
```javascript
socket.on('message:new', (data) => {
  console.log(`New message for bot ${data.botId}`);
  console.log(`From: ${data.message.from}`);
  console.log(`Text: ${data.message.content.text}`);
  
  // Update UI with new message
  addMessageToChat(data.message);
});
```

---

### Message Status Update

**Event:** `message:status`
- **Direction:** Server → Client
- **Description:** Message delivery status changed
- **Payload:**
  ```json
  {
    "messageId": "uuid",
    "status": "sent" | "delivered" | "read" | "failed",
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**Example:**
```javascript
socket.on('message:status', (data) => {
  console.log(`Message ${data.messageId} status: ${data.status}`);
  
  // Update message status in UI
  updateMessageStatus(data.messageId, data.status);
});
```

---

## Balance Events

### Balance Updated

**Event:** `balance:updated`
- **Direction:** Server → Client
- **Description:** User balance changed
- **Payload:**
  ```json
  {
    "userId": "uuid",
    "balance": 100.50,
    "change": -0.05,
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**Example:**
```javascript
socket.on('balance:updated', (data) => {
  console.log(`Balance updated: ${data.balance}`);
  console.log(`Change: ${data.change}`);
  
  // Update balance display
  updateBalanceDisplay(data.balance);
});
```

---

### Low Balance Warning

**Event:** `balance:low`
- **Direction:** Server → Client
- **Description:** Balance below threshold
- **Payload:**
  ```json
  {
    "balance": 5.00,
    "threshold": 10.00,
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**Example:**
```javascript
socket.on('balance:low', (data) => {
  console.warn(`Low balance: ${data.balance}`);
  
  // Show warning notification
  showLowBalanceWarning(data.balance, data.threshold);
});
```

---

## Webhook Events

### Webhook Delivery Status

**Event:** `webhook:delivery`
- **Direction:** Server → Client
- **Description:** Webhook delivery attempt completed
- **Payload:**
  ```json
  {
    "botId": "uuid",
    "success": true,
    "url": "https://example.com/webhook",
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

**Example:**
```javascript
socket.on('webhook:delivery', (data) => {
  if (data.success) {
    console.log(`Webhook delivered to ${data.url}`);
  } else {
    console.error(`Webhook delivery failed to ${data.url}`);
  }
});
```

---

## Complete Example

### React Component with Socket.IO

```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

function useWebSocket(token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3000', {
      auth: { token }
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('connected', (data) => {
      console.log('Server message:', data.message);
    });

    // Bot events
    newSocket.on('bot:status', (data) => {
      console.log('Bot status:', data);
      // Update bot status in state
    });

    newSocket.on('bot:qr', (data) => {
      console.log('QR code received:', data);
      // Display QR code
    });

    newSocket.on('bot:apikey:generated', (data) => {
      console.log('API key generated:', data);
      // Show API key modal
      showApiKeyModal(data);
    });

    // Message events
    newSocket.on('message:new', (data) => {
      console.log('New message:', data);
      // Add to messages list
    });

    newSocket.on('message:status', (data) => {
      console.log('Message status:', data);
      // Update message status
    });

    // Balance events
    newSocket.on('balance:updated', (data) => {
      console.log('Balance updated:', data);
      // Update balance display
    });

    newSocket.on('balance:low', (data) => {
      console.warn('Low balance:', data);
      // Show warning
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, [token]);

  return { socket, connected };
}

export default useWebSocket;
```

---

## Event Summary Table

| Event | Direction | Description | Frequency |
|-------|-----------|-------------|-----------|
| `connected` | S→C | Connection established | Once per connection |
| `bot:status` | S→C | Bot status changed | On status change |
| `bot:qr` | S→C | QR code generated | When QR needed |
| `bot:apikey:generated` | S→C | API key auto-generated | Once per bot (first connection) |
| `message:new` | S→C | New message received | Per message |
| `message:status` | S→C | Message status updated | Per status change |
| `balance:updated` | S→C | Balance changed | Per transaction |
| `balance:low` | S→C | Low balance warning | When below threshold |
| `webhook:delivery` | S→C | Webhook delivery status | Per webhook attempt |

**Legend:** S→C = Server to Client

---

## Best Practices

1. **Reconnection Handling**
   ```javascript
   socket.on('disconnect', () => {
     // Handle disconnection
     console.log('Disconnected, will auto-reconnect');
   });

   socket.on('connect', () => {
     // Refresh data after reconnection
     fetchLatestData();
   });
   ```

2. **Error Handling**
   ```javascript
   socket.on('connect_error', (error) => {
     console.error('Connection error:', error);
     // Show error to user
   });
   ```

3. **Memory Management**
   ```javascript
   useEffect(() => {
     // Setup listeners
     socket.on('bot:status', handleBotStatus);

     // Cleanup
     return () => {
       socket.off('bot:status', handleBotStatus);
     };
   }, [socket]);
   ```

4. **Secure Token Storage**
   ```javascript
   // Store token securely
   const token = localStorage.getItem('jwt_token');
   
   // Don't expose token in logs
   console.log('Connecting with token: ***');
   ```

---

## Troubleshooting

### Connection Issues

**Problem:** `Authentication error: No token provided`
- **Solution:** Ensure JWT token is passed in `auth.token`

**Problem:** `Authentication error: Invalid token`
- **Solution:** Token expired or invalid, login again

**Problem:** Connection keeps disconnecting
- **Solution:** Check network stability, verify server is running

### Event Issues

**Problem:** Not receiving events
- **Solution:** Verify event listener is registered before event fires

**Problem:** Receiving duplicate events
- **Solution:** Remove old listeners before adding new ones

**Problem:** Events delayed
- **Solution:** Check network latency, verify server performance

---

## Testing WebSocket Events

### Using Browser Console

```javascript
// Connect
const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

// Listen to all events
socket.onAny((event, data) => {
  console.log(`Event: ${event}`, data);
});

// Test specific event
socket.on('bot:apikey:generated', (data) => {
  console.log('API Key:', data.key);
});
```

### Using Postman

1. Open Postman
2. Create new WebSocket request
3. URL: `ws://localhost:3000`
4. Add authentication header
5. Listen for events

---

## Security Notes

- Always use HTTPS/WSS in production
- Never log sensitive data (API keys, tokens)
- Implement rate limiting on client side
- Validate all received data before using
- Use secure token storage (not localStorage in production)

---

## Support

For issues or questions:
- Check server logs: `docker-compose logs api-server`
- Check worker logs: `docker-compose logs message-worker`
- Verify Redis connection: `redis-cli ping`
- Test WebSocket endpoint: Use browser console or Postman
