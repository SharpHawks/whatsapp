# Design Document

## Overview

This document describes the architectural refactoring to centralize all WhatsApp connection management in the worker process. The current problem is that both the main API process and worker process attempt to manage Baileys connections independently, leading to connection conflicts and message delivery failures.

The solution moves all Baileys connection lifecycle management to the worker process, while the main API process acts as a coordinator through Redis PubSub. This creates a clear separation of concerns:
- **Main API Process**: Handles HTTP/WebSocket requests, coordinates bot actions via Redis events
- **Worker Process**: Manages all WhatsApp connections, processes message queue, handles connection lifecycle

## Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Frontend      │◄───────►│  Main API    │◄───────►│   PostgreSQL    │
│   (React)       │  HTTP/  │   Process    │  SQL    │   Database      │
└─────────────────┘  WS     └──────────────┘         └─────────────────┘
                                    │
                                    │ Redis PubSub
                                    │ (Events)
                                    ▼
                            ┌──────────────┐
                            │    Redis     │
                            │   Server     │
                            └──────────────┘
                                    ▲
                                    │ Redis PubSub
                                    │ (Events + Data)
                                    ▼
                            ┌──────────────┐         ┌─────────────────┐
                            │   Worker     │◄───────►│   RabbitMQ      │
                            │   Process    │  AMQP   │   Queue         │
                            └──────────────┘         └─────────────────┘
                                    │
                                    │ Baileys Protocol
                                    ▼
                            ┌──────────────┐
                            │  WhatsApp    │
                            │   Servers    │
                            └──────────────┘
```

### Event Flow Diagrams

#### Bot Connection Flow

```
User clicks "Connect" → Main API → Redis PubSub (bot:connect) → Worker
                                                                    │
                                                                    ▼
                                                            Create Baileys Connection
                                                                    │
                                                                    ▼
                                                            Generate QR Code
                                                                    │
                                                                    ▼
                                                    Store QR in Redis (qr:{botId})
                                                                    │
                                                                    ▼
                                            Redis PubSub (qr:generated) → Main API
                                                                              │
                                                                              ▼
                                                                    WebSocket to Frontend
                                                                              │
                                                                              ▼
                                                                    User scans QR
                                                                              │
                                                                              ▼
                                                            Worker receives auth success
                                                                              │
                                                                              ▼
                                                            Update DB status: connected
                                                                              │
                                                                              ▼
                                            Redis PubSub (bot:connected) → Main API
                                                                              │
                                                                              ▼
                                                                    WebSocket to Frontend
```

#### Message Sending Flow

```
User sends message → Main API → RabbitMQ Queue → Worker
                                                    │
                                                    ▼
                                            Get Baileys Connection
                                                    │
                                                    ▼
                                            Send via WhatsApp
                                                    │
                                                    ▼
                                            Update DB status: sent
                                                    │
                                                    ▼
                                    Redis PubSub (message:sent) → Main API
                                                                      │
                                                                      ▼
                                                            WebSocket to Frontend
```

## Components and Interfaces

### 1. Redis PubSub Service

New service for inter-process communication using Redis publish/subscribe.

**File**: `src/services/redis-pubsub.service.ts`

**Interface**:
```typescript
interface RedisPubSubService {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Publishing events
  publishBotConnect(botId: string): Promise<void>;
  publishBotDisconnect(botId: string): Promise<void>;
  publishQRGenerated(botId: string): Promise<void>;
  publishBotConnected(botId: string, phoneNumber: string): Promise<void>;
  publishBotDisconnected(botId: string): Promise<void>;
  publishConnectionLost(botId: string, reason: string): Promise<void>;
  publishWorkerStarted(workerId: string): Promise<void>;
  publishWorkerReady(workerId: string, connectionCount: number): Promise<void>;
  
  // Subscribing to events
  subscribeBotEvents(handler: BotEventHandler): Promise<void>;
  subscribeWorkerEvents(handler: WorkerEventHandler): Promise<void>;
  
  // Unsubscribe
  unsubscribeAll(): Promise<void>;
}

interface BotEventHandler {
  onBotConnect?(botId: string): Promise<void>;
  onBotDisconnect?(botId: string): Promise<void>;
  onQRGenerated?(botId: string): Promise<void>;
  onBotConnected?(botId: string, phoneNumber: string): Promise<void>;
  onBotDisconnected?(botId: string): Promise<void>;
  onConnectionLost?(botId: string, reason: string): Promise<void>;
}

interface WorkerEventHandler {
  onWorkerStarted?(workerId: string): Promise<void>;
  onWorkerReady?(workerId: string, connectionCount: number): Promise<void>;
}
```

**Event Channels**:
- `bot:connect` - Request to connect a bot
- `bot:disconnect` - Request to disconnect a bot
- `qr:generated` - QR code has been generated
- `bot:connected` - Bot successfully connected
- `bot:disconnected` - Bot disconnected
- `bot:connection_lost` - Unexpected connection loss
- `worker:started` - Worker process started
- `worker:ready` - Worker finished initialization

### 2. Redis Data Storage

**QR Code Storage**:
- Key: `qr:{botId}`
- Value: QR code string (raw text for frontend to render)
- TTL: 60 seconds
- Purpose: Temporary storage for QR codes generated by worker

**Worker Heartbeat**:
- Key: `worker:{workerId}:heartbeat`
- Value: JSON `{ timestamp: number, connectionCount: number, hostname: string, pid: number }`
- TTL: 30 seconds
- Purpose: Track active workers and their health

**Worker Connection List**:
- Key: `worker:{workerId}:connections`
- Value: JSON array of bot IDs
- TTL: 30 seconds
- Purpose: Track which bots are managed by which worker

### 3. Modified Bot Service

**File**: `src/services/bot.service.ts`

**Changes**:
- Remove direct calls to `baileysManager.createConnection()`
- Remove direct calls to `baileysManager.disconnectBot()`
- Add Redis PubSub event publishing for connect/disconnect actions
- Add new endpoint handler for QR code retrieval

**New Methods**:
```typescript
async connectBot(botId: string, userId: string): Promise<void> {
  // Verify ownership
  await this.getBot(botId, userId);
  
  // Update status to connecting
  await db.query(
    'UPDATE bots SET connection_status = $1 WHERE id = $2',
    ['connecting', botId]
  );
  
  // Publish connect event
  await redisPubSubService.publishBotConnect(botId);
}

async disconnectBot(botId: string, userId: string): Promise<void> {
  // Verify ownership
  await this.getBot(botId, userId);
  
  // Publish disconnect event
  await redisPubSubService.publishBotDisconnect(botId);
}

async getQRCode(botId: string, userId: string): Promise<string | null> {
  // Verify ownership
  await this.getBot(botId, userId);
  
  // Get QR code from Redis
  const qrCode = await redisClient.get(`qr:${botId}`);
  return qrCode;
}
```

### 4. Modified Worker Baileys Manager

**File**: `src/services/worker-baileys.manager.ts`

**Changes**:
- Subscribe to Redis PubSub events on initialization
- Handle `bot:connect` events by creating connections
- Handle `bot:disconnect` events by closing connections
- Store QR codes in Redis instead of database
- Publish events for connection state changes
- Implement worker heartbeat mechanism

**New Methods**:
```typescript
async startEventListener(): Promise<void> {
  await redisPubSubService.subscribeBotEvents({
    onBotConnect: async (botId: string) => {
      await this.createConnection(botId);
    },
    onBotDisconnect: async (botId: string) => {
      await this.closeConnection(botId);
    }
  });
}

async startHeartbeat(): Promise<void> {
  const workerId = `${os.hostname()}-${process.pid}`;
  
  setInterval(async () => {
    const connectionCount = this.connections.size;
    const botIds = Array.from(this.connections.keys());
    
    // Update heartbeat
    await redisClient.setEx(
      `worker:${workerId}:heartbeat`,
      30,
      JSON.stringify({
        timestamp: Date.now(),
        connectionCount,
        hostname: os.hostname(),
        pid: process.pid
      })
    );
    
    // Update connection list
    await redisClient.setEx(
      `worker:${workerId}:connections`,
      30,
      JSON.stringify(botIds)
    );
  }, 10000); // Every 10 seconds
}

private async handleQRCode(botId: string, qrCode: string): Promise<void> {
  // Store in Redis with 60 second TTL
  await redisClient.setEx(`qr:${botId}`, 60, qrCode);
  
  // Publish event
  await redisPubSubService.publishQRGenerated(botId);
}

private async handleConnectionOpen(botId: string, phoneNumber: string): Promise<void> {
  // Update database
  await db.query(
    'UPDATE bots SET connection_status = $1, phone_number = $2 WHERE id = $3',
    ['connected', phoneNumber, botId]
  );
  
  // Publish event
  await redisPubSubService.publishBotConnected(botId, phoneNumber);
}

private async handleConnectionClose(botId: string, reason: string): Promise<void> {
  // Update database
  await db.query(
    'UPDATE bots SET connection_status = $1 WHERE id = $2',
    ['disconnected', botId]
  );
  
  // Publish event
  await redisPubSubService.publishConnectionLost(botId, reason);
}
```

### 5. Modified Main API Startup

**File**: `src/startup.ts` or `src/index.ts`

**Changes**:
- Initialize Redis PubSub service
- Subscribe to worker events
- Forward events to WebSocket clients

**New Code**:
```typescript
// Initialize Redis PubSub
await redisPubSubService.connect();

// Subscribe to bot events
await redisPubSubService.subscribeBotEvents({
  onQRGenerated: async (botId: string) => {
    const userId = await getBotUserId(botId);
    if (userId) {
      socketService.emitToUser(userId, 'qr_code', { botId });
    }
  },
  onBotConnected: async (botId: string, phoneNumber: string) => {
    const userId = await getBotUserId(botId);
    if (userId) {
      socketService.emitBotStatus(userId, botId, 'connected', phoneNumber);
    }
  },
  onBotDisconnected: async (botId: string) => {
    const userId = await getBotUserId(botId);
    if (userId) {
      socketService.emitBotStatus(userId, botId, 'disconnected');
    }
  },
  onConnectionLost: async (botId: string, reason: string) => {
    const userId = await getBotUserId(botId);
    if (userId) {
      socketService.emitToUser(userId, 'error', {
        botId,
        message: 'Bot connection lost',
        reason
      });
    }
  }
});
```

### 6. New Admin Endpoints

**File**: `src/routes/admin.routes.ts`

**New Endpoints**:

```typescript
// GET /api/v1/admin/workers
// Returns list of active workers with health status
router.get('/workers', adminAuth, async (req, res) => {
  const workers = await adminService.getActiveWorkers();
  res.json({ workers });
});

// GET /api/v1/admin/workers/:workerId/connections
// Returns list of connections managed by specific worker
router.get('/workers/:workerId/connections', adminAuth, async (req, res) => {
  const connections = await adminService.getWorkerConnections(req.params.workerId);
  res.json({ connections });
});
```

**Admin Service Methods**:
```typescript
async getActiveWorkers(): Promise<WorkerInfo[]> {
  const keys = await redisClient.keys('worker:*:heartbeat');
  const workers: WorkerInfo[] = [];
  
  for (const key of keys) {
    const data = await redisClient.get(key);
    if (data) {
      const heartbeat = JSON.parse(data);
      const workerId = key.split(':')[1];
      const age = Date.now() - heartbeat.timestamp;
      
      workers.push({
        workerId,
        hostname: heartbeat.hostname,
        pid: heartbeat.pid,
        connectionCount: heartbeat.connectionCount,
        lastHeartbeat: new Date(heartbeat.timestamp),
        status: age < 30000 ? 'active' : 'inactive'
      });
    }
  }
  
  return workers;
}

async getWorkerConnections(workerId: string): Promise<string[]> {
  const data = await redisClient.get(`worker:${workerId}:connections`);
  return data ? JSON.parse(data) : [];
}
```

## Data Models

### Database Schema Changes

No database schema changes required. Existing tables are sufficient:

**bots table** (existing):
- `connection_status`: Already tracks status
- `phone_number`: Already stores phone number
- `qr_code`: No longer used (moved to Redis)

**messages table** (existing):
- No changes needed

### Redis Data Structures

**QR Code**:
```typescript
interface QRCodeData {
  key: `qr:${string}`;  // qr:{botId}
  value: string;         // Raw QR code text
  ttl: 60;              // seconds
}
```

**Worker Heartbeat**:
```typescript
interface WorkerHeartbeat {
  key: `worker:${string}:heartbeat`;  // worker:{workerId}:heartbeat
  value: {
    timestamp: number;
    connectionCount: number;
    hostname: string;
    pid: number;
  };
  ttl: 30;  // seconds
}
```

**Worker Connections**:
```typescript
interface WorkerConnections {
  key: `worker:${string}:connections`;  // worker:{workerId}:connections
  value: string[];  // Array of bot IDs
  ttl: 30;  // seconds
}
```

## Error Handling

### Connection Failures

**Scenario**: Worker fails to create Baileys connection

**Handling**:
1. Worker logs error with full stack trace
2. Worker updates bot status to `disconnected` in database
3. Worker publishes `bot:connection_lost` event with error details
4. Main API receives event and notifies user via WebSocket
5. Frontend displays error message to user

**Code**:
```typescript
try {
  await this.createConnection(botId);
} catch (error) {
  logger.error(`Failed to create connection for bot ${botId}:`, error);
  
  await db.query(
    'UPDATE bots SET connection_status = $1 WHERE id = $2',
    ['disconnected', botId]
  );
  
  await redisPubSubService.publishConnectionLost(
    botId,
    error.message || 'Unknown error'
  );
}
```

### Redis Connection Loss

**Scenario**: Redis server becomes unavailable

**Handling**:
1. Redis client automatically attempts reconnection with exponential backoff
2. During disconnection, events are queued in memory (up to limit)
3. When reconnected, queued events are published
4. If queue exceeds limit, oldest events are dropped and logged

**Code**:
```typescript
class RedisPubSubService {
  private eventQueue: Array<{ channel: string; message: string }> = [];
  private readonly MAX_QUEUE_SIZE = 1000;
  
  async publish(channel: string, message: string): Promise<void> {
    if (!this.isConnected) {
      if (this.eventQueue.length < this.MAX_QUEUE_SIZE) {
        this.eventQueue.push({ channel, message });
        logger.warn(`Redis disconnected, queued event: ${channel}`);
      } else {
        logger.error(`Event queue full, dropping event: ${channel}`);
      }
      return;
    }
    
    await this.publisher.publish(channel, message);
  }
  
  private async onReconnect(): Promise<void> {
    logger.info(`Redis reconnected, publishing ${this.eventQueue.length} queued events`);
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.publisher.publish(event.channel, event.message);
    }
  }
}
```

### Worker Process Crash

**Scenario**: Worker process crashes unexpectedly

**Handling**:
1. Worker heartbeat stops updating in Redis
2. After 30 seconds, heartbeat key expires
3. Admin panel shows worker as `inactive`
4. Bots managed by crashed worker remain in `connected` status in DB
5. When worker restarts, it loads all `connected` bots and recreates connections
6. If bot cannot reconnect, status is updated to `disconnected`

**Code**:
```typescript
async initialize(): Promise<void> {
  logger.info('Worker starting, loading connected bots...');
  
  const result = await db.query(
    'SELECT id FROM bots WHERE connection_status = $1 AND is_active = true',
    ['connected']
  );
  
  const bots = result.rows;
  logger.info(`Found ${bots.length} connected bots to restore`);
  
  for (const bot of bots) {
    try {
      await this.createConnection(bot.id);
      logger.info(`Restored connection for bot ${bot.id}`);
    } catch (error) {
      logger.error(`Failed to restore bot ${bot.id}:`, error);
      await db.query(
        'UPDATE bots SET connection_status = $1 WHERE id = $2',
        ['disconnected', bot.id]
      );
    }
  }
  
  await redisPubSubService.publishWorkerReady(
    this.workerId,
    this.connections.size
  );
}
```

### Message Delivery Failures

**Scenario**: Worker cannot send message because bot is disconnected

**Handling**:
1. Worker checks for active connection
2. If no connection exists, message is returned to queue with delay
3. After 3 retry attempts, message is moved to dead letter queue
4. Message status in database is updated to `failed`
5. User is notified via WebSocket

**Code**:
```typescript
async processMessage(queuedMessage: QueuedMessage): Promise<void> {
  const connection = await this.getConnection(queuedMessage.botId);
  
  if (!connection) {
    logger.warn(`No connection for bot ${queuedMessage.botId}, attempt ${queuedMessage.attempts + 1}`);
    
    if (queuedMessage.attempts >= 3) {
      // Max retries reached
      await db.query(
        'UPDATE messages SET status = $1 WHERE id = $2',
        ['failed', queuedMessage.id]
      );
      
      throw new Error(`No active connection for bot ${queuedMessage.botId}`);
    }
    
    // Retry with delay
    throw new Error(`No active connection, will retry`);
  }
  
  // Send message
  await this.sendMessage(connection, queuedMessage);
}
```

## Testing Strategy

### Unit Tests

**Redis PubSub Service**:
- Test event publishing
- Test event subscription
- Test reconnection logic
- Test event queue during disconnection

**Worker Baileys Manager**:
- Test connection creation
- Test event handling
- Test heartbeat mechanism
- Test graceful shutdown

**Bot Service**:
- Test connect/disconnect actions
- Test QR code retrieval
- Test ownership verification

### Integration Tests

**Bot Connection Flow**:
1. Start main API and worker processes
2. Call connect endpoint
3. Verify `bot:connect` event is published
4. Verify worker creates connection
5. Verify QR code is stored in Redis
6. Verify `qr:generated` event is published
7. Verify frontend receives QR code via WebSocket

**Message Sending Flow**:
1. Connect a bot
2. Send message via API
3. Verify message is queued in RabbitMQ
4. Verify worker processes message
5. Verify message is sent via Baileys
6. Verify message status is updated in database

**Worker Crash Recovery**:
1. Start worker with connected bot
2. Kill worker process
3. Verify heartbeat expires in Redis
4. Start new worker process
5. Verify worker restores connection
6. Verify bot remains functional

### Manual Testing

**QR Code Flow**:
1. Open frontend dashboard
2. Click "Connect" on a bot
3. Verify QR code appears within 5 seconds
4. Scan QR code with WhatsApp mobile app
5. Verify bot status changes to "Connected"
6. Verify phone number is displayed

**Message Sending**:
1. Connect a bot
2. Send test message via API or frontend
3. Verify message is received on target WhatsApp number
4. Verify message status updates in frontend

**Admin Panel**:
1. Open admin panel
2. Navigate to workers section
3. Verify worker is listed with correct status
4. Verify connection count is accurate
5. Verify heartbeat timestamp updates

## Performance Considerations

### Redis PubSub Overhead

**Concern**: Redis PubSub adds latency to bot operations

**Mitigation**:
- Redis PubSub is extremely fast (<1ms for local Redis)
- Events are fire-and-forget, no blocking
- Use Redis pipelining for multiple operations

**Benchmarks**:
- Event publish: <1ms
- Event delivery: <5ms
- Total overhead: <10ms per operation

### Worker Heartbeat Load

**Concern**: Frequent heartbeat updates may overload Redis

**Mitigation**:
- Heartbeat interval: 10 seconds (configurable)
- Use SETEX for atomic set+expire
- Heartbeat is lightweight (< 100 bytes)

**Calculations**:
- 10 workers × 6 updates/minute = 60 updates/minute
- 60 updates × 100 bytes = 6 KB/minute
- Negligible load on Redis

### Connection Restoration Time

**Concern**: Worker restart may cause extended downtime

**Mitigation**:
- Parallel connection restoration (Promise.all)
- Continue with successful connections even if some fail
- Log failures for manual intervention

**Expected Times**:
- Single bot restoration: 2-5 seconds
- 10 bots in parallel: 5-10 seconds
- 100 bots in parallel: 10-20 seconds

## Deployment Considerations

### Environment Variables

**New Variables**:
```bash
# Redis PubSub (uses existing Redis connection)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Worker Configuration
WORKER_ENABLED=true
WORKER_HEALTH_CHECK_INTERVAL=30000
WORKER_HEARTBEAT_INTERVAL=10000
```

### Process Management

**PM2 Configuration** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [
    {
      name: 'whatsapp-api',
      script: './dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        WORKER_ENABLED: 'false'
      }
    },
    {
      name: 'whatsapp-worker',
      script: './dist/workers/message.worker.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        WORKER_ENABLED: 'true'
      }
    }
  ]
};
```

### Monitoring

**Health Checks**:
- Main API: `GET /health` - Check Redis, PostgreSQL, RabbitMQ
- Worker: Heartbeat in Redis - Check via admin panel

**Metrics to Track**:
- Active worker count
- Connection count per worker
- Message queue depth
- Message processing rate
- Failed message count
- Average QR code generation time
- Connection restoration time

### Scaling

**Horizontal Scaling**:
- Multiple worker processes can run simultaneously
- Distributed locks prevent duplicate connections
- Each worker manages subset of bots
- Load balancing happens naturally through RabbitMQ

**Vertical Scaling**:
- Each worker can handle 50-100 concurrent connections
- Memory: ~50MB per connection
- CPU: Minimal when idle, spikes during message processing

## Migration Plan

### Phase 1: Add Redis PubSub (No Breaking Changes)

1. Implement `RedisPubSubService`
2. Add event publishing to existing code
3. Add event subscription to main API
4. Deploy and test in parallel with existing system

### Phase 2: Migrate Worker (Breaking Change)

1. Update `WorkerBaileysManager` to use Redis events
2. Remove Baileys manager from main API
3. Update bot service to use Redis events
4. Deploy worker first, then main API

### Phase 3: Add Admin Features

1. Implement worker monitoring endpoints
2. Add admin panel UI for workers
3. Add health check dashboard

### Rollback Plan

If issues occur after deployment:

1. Set `WORKER_ENABLED=false` in main API
2. Restart main API (will handle connections directly)
3. Stop worker process
4. Investigate and fix issues
5. Re-deploy when ready

## Security Considerations

### Redis PubSub Security

**Concern**: Unauthorized access to Redis events

**Mitigation**:
- Use Redis password authentication
- Run Redis on private network only
- Use Redis ACLs to restrict commands
- Encrypt Redis traffic with TLS (production)

### QR Code Security

**Concern**: QR codes contain sensitive authentication data

**Mitigation**:
- Store QR codes in Redis with short TTL (60 seconds)
- Verify bot ownership before returning QR code
- QR codes automatically expire after use
- Log all QR code access attempts

### Worker Authentication

**Concern**: Rogue worker processes could interfere

**Mitigation**:
- Workers use same database credentials (already secured)
- Distributed locks prevent duplicate connections
- Worker heartbeat includes hostname and PID for tracking
- Admin panel shows all active workers

## Future Enhancements

### Multi-Worker Load Balancing

Implement intelligent bot assignment to workers based on:
- Current worker load
- Geographic location
- Bot priority level

### Connection Pooling

Reuse Baileys connections across multiple bots:
- Reduce memory footprint
- Faster connection establishment
- Better resource utilization

### Advanced Monitoring

Add detailed metrics:
- Message latency histogram
- Connection uptime percentage
- Error rate by bot
- Worker resource usage

### Auto-Scaling

Automatically start/stop workers based on:
- Message queue depth
- Active bot count
- System resource usage
