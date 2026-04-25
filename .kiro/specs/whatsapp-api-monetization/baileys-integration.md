# Baileys Integration Guide

## Overview

Baileys - это TypeScript/JavaScript библиотека для взаимодействия с WhatsApp Web Multi-Device API. В отличие от официального WhatsApp Business API, Baileys использует протокол WhatsApp Web, что позволяет избежать необходимости регистрации в Meta Business и оплаты официального API.

## Key Features

- **Multi-Device Support**: Поддержка WhatsApp Multi-Device протокола
- **QR Code Authentication**: Простая аутентификация через QR код
- **Session Persistence**: Сохранение сессий для автоматического переподключения
- **Media Support**: Отправка изображений, видео, документов, аудио
- **Group Support**: Работа с группами (опционально)
- **Message Types**: Текст, медиа, локация, контакты, интерактивные кнопки

## Installation

```bash
npm install @whiskeysockets/baileys
```

## Connection Flow

### 1. Initial Connection

```typescript
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';

async function connectBot(botId: string) {
  // Load auth state from database
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${botId}`);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // We'll handle QR ourselves
  });
  
  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      // Store QR code for user to scan
      await storeBotQRCode(botId, qr);
    }
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        connectBot(botId); // Reconnect
      }
    } else if (connection === 'open') {
      console.log('Bot connected:', botId);
      await updateBotStatus(botId, 'connected');
    }
  });
  
  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);
  
  return sock;
}
```

### 2. QR Code Generation

```typescript
import QRCode from 'qrcode';

async function generateQRCodeImage(qrData: string): Promise<string> {
  // Generate QR code as base64 image
  const qrImage = await QRCode.toDataURL(qrData);
  return qrImage;
}
```

### 3. Session Persistence

```typescript
interface BaileysAuthState {
  creds: any;
  keys: any;
}

async function saveAuthState(botId: string, state: BaileysAuthState) {
  await db.query(
    `INSERT INTO baileys_sessions (bot_id, creds, keys, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (bot_id) 
     DO UPDATE SET creds = $2, keys = $3, updated_at = NOW()`,
    [botId, JSON.stringify(state.creds), JSON.stringify(state.keys)]
  );
}

async function loadAuthState(botId: string): Promise<BaileysAuthState | null> {
  const result = await db.query(
    'SELECT creds, keys FROM baileys_sessions WHERE bot_id = $1',
    [botId]
  );
  
  if (result.rows.length === 0) return null;
  
  return {
    creds: JSON.parse(result.rows[0].creds),
    keys: JSON.parse(result.rows[0].keys)
  };
}
```

## Sending Messages

### Text Message

```typescript
async function sendTextMessage(sock: WASocket, to: string, text: string) {
  const jid = `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}
```

### Image Message

```typescript
async function sendImageMessage(sock: WASocket, to: string, imageUrl: string, caption?: string) {
  const jid = `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, {
    image: { url: imageUrl },
    caption: caption
  });
}
```

### Document Message

```typescript
async function sendDocumentMessage(sock: WASocket, to: string, documentUrl: string, filename: string) {
  const jid = `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, {
    document: { url: documentUrl },
    fileName: filename,
    mimetype: 'application/pdf'
  });
}
```

### Button Message

```typescript
async function sendButtonMessage(sock: WASocket, to: string, text: string, buttons: any[]) {
  const jid = `${to}@s.whatsapp.net`;
  
  const buttonMessage = {
    text: text,
    footer: 'Powered by Platform',
    buttons: buttons.map((btn, idx) => ({
      buttonId: btn.id || `btn_${idx}`,
      buttonText: { displayText: btn.title },
      type: 1
    })),
    headerType: 1
  };
  
  await sock.sendMessage(jid, buttonMessage);
}
```

## Receiving Messages

```typescript
sock.ev.on('messages.upsert', async (m) => {
  const messages = m.messages;
  
  for (const msg of messages) {
    if (!msg.message) continue;
    
    const messageType = Object.keys(msg.message)[0];
    const from = msg.key.remoteJid;
    const messageId = msg.key.id;
    
    // Extract message content based on type
    let content: any = {};
    
    if (messageType === 'conversation') {
      content.text = msg.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
      content.text = msg.message.extendedTextMessage?.text;
    } else if (messageType === 'imageMessage') {
      content.type = 'image';
      content.caption = msg.message.imageMessage?.caption;
      // Download image if needed
    } else if (messageType === 'documentMessage') {
      content.type = 'document';
      content.filename = msg.message.documentMessage?.fileName;
    }
    
    // Process incoming message
    await processIncomingMessage(botId, {
      messageId,
      from: from?.replace('@s.whatsapp.net', ''),
      content,
      timestamp: new Date(msg.messageTimestamp * 1000)
    });
  }
});
```

## Connection Management

### Connection Pool

```typescript
class BaileysConnectionPool {
  private connections: Map<string, WASocket> = new Map();
  
  async getConnection(botId: string): Promise<WASocket> {
    if (this.connections.has(botId)) {
      return this.connections.get(botId)!;
    }
    
    const sock = await this.createConnection(botId);
    this.connections.set(botId, sock);
    return sock;
  }
  
  async createConnection(botId: string): Promise<WASocket> {
    const authState = await loadAuthState(botId);
    
    const sock = makeWASocket({
      auth: authState || undefined,
      printQRInTerminal: false
    });
    
    // Setup event handlers
    this.setupEventHandlers(botId, sock);
    
    return sock;
  }
  
  async disconnectBot(botId: string) {
    const sock = this.connections.get(botId);
    if (sock) {
      await sock.logout();
      this.connections.delete(botId);
    }
  }
  
  private setupEventHandlers(botId: string, sock: WASocket) {
    // Connection updates
    sock.ev.on('connection.update', (update) => {
      this.handleConnectionUpdate(botId, update);
    });
    
    // Incoming messages
    sock.ev.on('messages.upsert', (m) => {
      this.handleIncomingMessages(botId, m);
    });
    
    // Message status updates
    sock.ev.on('messages.update', (updates) => {
      this.handleMessageUpdates(botId, updates);
    });
    
    // Credentials update
    sock.ev.on('creds.update', () => {
      this.saveCredentials(botId, sock);
    });
  }
}
```

## Error Handling

### Common Errors

```typescript
enum BaileysErrorCode {
  CONNECTION_CLOSED = 'connection_closed',
  LOGGED_OUT = 'logged_out',
  RATE_LIMIT = 'rate_limit',
  INVALID_JID = 'invalid_jid',
  MESSAGE_SEND_FAILED = 'message_send_failed'
}

function handleBaileysError(error: any): ErrorResponse {
  if (error.output?.statusCode === DisconnectReason.loggedOut) {
    return {
      code: BaileysErrorCode.LOGGED_OUT,
      message: 'Bot has been logged out. Please reconnect with QR code.'
    };
  }
  
  if (error.output?.statusCode === DisconnectReason.connectionClosed) {
    return {
      code: BaileysErrorCode.CONNECTION_CLOSED,
      message: 'Connection closed. Attempting to reconnect...'
    };
  }
  
  return {
    code: BaileysErrorCode.MESSAGE_SEND_FAILED,
    message: error.message || 'Unknown error occurred'
  };
}
```

## Best Practices

### 1. Rate Limiting

WhatsApp может заблокировать номер при слишком частой отправке сообщений:

```typescript
const RATE_LIMITS = {
  messagesPerMinute: 20,
  messagesPerHour: 1000
};

class RateLimiter {
  private messageCount: Map<string, number[]> = new Map();
  
  canSendMessage(botId: string): boolean {
    const now = Date.now();
    const timestamps = this.messageCount.get(botId) || [];
    
    // Remove timestamps older than 1 hour
    const recentTimestamps = timestamps.filter(t => now - t < 3600000);
    
    // Check limits
    const lastMinute = recentTimestamps.filter(t => now - t < 60000);
    
    if (lastMinute.length >= RATE_LIMITS.messagesPerMinute) {
      return false;
    }
    
    if (recentTimestamps.length >= RATE_LIMITS.messagesPerHour) {
      return false;
    }
    
    // Add current timestamp
    recentTimestamps.push(now);
    this.messageCount.set(botId, recentTimestamps);
    
    return true;
  }
}
```

### 2. Connection Health Monitoring

```typescript
class ConnectionHealthMonitor {
  private lastActivity: Map<string, number> = new Map();
  
  updateActivity(botId: string) {
    this.lastActivity.set(botId, Date.now());
  }
  
  async checkHealth() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    
    for (const [botId, lastActive] of this.lastActivity.entries()) {
      if (now - lastActive > timeout) {
        console.warn(`Bot ${botId} appears inactive, reconnecting...`);
        await this.reconnectBot(botId);
      }
    }
  }
}
```

### 3. Message Queue

Используйте очередь для надежной доставки:

```typescript
interface QueuedMessage {
  id: string;
  botId: string;
  to: string;
  content: any;
  attempts: number;
  maxAttempts: number;
}

async function processMessageQueue() {
  const messages = await getQueuedMessages();
  
  for (const msg of messages) {
    try {
      const sock = await connectionPool.getConnection(msg.botId);
      await sendMessage(sock, msg.to, msg.content);
      await markMessageSent(msg.id);
    } catch (error) {
      if (msg.attempts < msg.maxAttempts) {
        await retryMessage(msg.id);
      } else {
        await markMessageFailed(msg.id);
      }
    }
  }
}
```

## Security Considerations

### 1. Session Security

- Храните auth state в зашифрованном виде
- Используйте отдельные сессии для каждого бота
- Регулярно ротируйте сессии

### 2. Phone Number Validation

```typescript
function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a valid international format
  return /^\d{10,15}$/.test(cleaned);
}

function formatToJID(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return `${cleaned}@s.whatsapp.net`;
}
```

### 3. Content Filtering

Фильтруйте контент для предотвращения спама и нарушений:

```typescript
function isSpamContent(text: string): boolean {
  const spamPatterns = [
    /viagra/i,
    /casino/i,
    /free money/i
  ];
  
  return spamPatterns.some(pattern => pattern.test(text));
}
```

## Limitations

1. **Account Bans**: WhatsApp может заблокировать номер при подозрительной активности
2. **Rate Limits**: Ограничения на количество сообщений в минуту/час
3. **No Official Support**: Baileys не поддерживается официально WhatsApp
4. **Breaking Changes**: Протокол WhatsApp может измениться без предупреждения
5. **Business Features**: Некоторые функции WhatsApp Business API недоступны

## Monitoring

```typescript
interface BaileysMetrics {
  botId: string;
  connectionStatus: string;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  lastActivity: Date;
}

async function collectMetrics(botId: string): Promise<BaileysMetrics> {
  return {
    botId,
    connectionStatus: await getConnectionStatus(botId),
    messagesSent: await getMessageCount(botId, 'sent'),
    messagesReceived: await getMessageCount(botId, 'received'),
    errors: await getErrorCount(botId),
    lastActivity: await getLastActivity(botId)
  };
}
```
