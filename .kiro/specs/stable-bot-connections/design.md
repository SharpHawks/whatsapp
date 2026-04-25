# Design Document

## Overview

This design addresses the bot disconnection issue by implementing a robust development workflow that separates concerns between the API server and bot connection management. The solution ensures that bot connections remain stable regardless of code changes, browser state, or server restarts during development.

The key insight is that nodemon restarts are necessary for development but should not affect bot connections. We achieve this by:
1. Running bot connections in a separate worker process that doesn't restart
2. Improving nodemon configuration to avoid unnecessary restarts
3. Providing flexible development modes for different scenarios

## Architecture

### Current Architecture Issues

```
┌─────────────────────────────────────┐
│   Development Server (nodemon)      │
│  ┌──────────────┐  ┌──────────────┐│
│  │  API Server  │  │ Bot Manager  ││
│  │              │  │ (Baileys)    ││
│  └──────────────┘  └──────────────┘│
└─────────────────────────────────────┘
         ↓ File change detected
         ↓ Server restarts
         ↓ All bots disconnect ❌
```

### Proposed Architecture

```
┌──────────────────────┐    ┌─────────────────────────┐
│  API Server          │    │  Worker Process         │
│  (nodemon restarts)  │    │  (persistent)           │
│                      │    │                         │
│  - HTTP/WebSocket    │◄──►│  - Bot Connections      │
│  - User Auth         │    │  - Message Processing   │
│  - Bot Management    │    │  - Connection Lifecycle │
│                      │    │                         │
└──────────────────────┘    └─────────────────────────┘
         │                            │
         └────────────┬───────────────┘
                      ↓
              ┌───────────────┐
              │  Redis PubSub │
              │  RabbitMQ     │
              │  PostgreSQL   │
              └───────────────┘
```

## Components and Interfaces

### 1. Development Mode Scripts

#### 1.1 Enhanced nodemon Configuration

**File:** `nodemon.json`

```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": [
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "src/workers/**",
    "sessions/**",
    "logs/**",
    "node_modules/**",
    "dist/**",
    ".git/**"
  ],
  "exec": "ts-node src/index.ts",
  "delay": 1000
}
```

**Changes:**
- Add `src/workers/**` to ignore list (workers run separately)
- Add `dist/**` and `.git/**` to ignore list
- Add 1 second delay to debounce rapid file changes

#### 1.2 Development Startup Script

**File:** `scripts/start-dev-stable.js`

This script will:
- Start the API server with nodemon (restarts on code changes)
- Start the worker process separately with ts-node-dev (only restarts on worker code changes)
- Handle graceful shutdown of both processes
- Provide clear console output for debugging

```javascript
const { spawn } = require('child_process');
const chalk = require('chalk'); // Optional: for colored output

// Start API with nodemon
const api = spawn('npx', ['nodemon'], {
  env: { ...process.env, WORKER_ENABLED: 'false' },
  stdio: 'inherit'
});

// Start worker with ts-node-dev (only watches worker files)
const worker = spawn('npx', ['ts-node-dev', '--respawn', '--watch', 'src/workers', 'src/workers/message.worker.ts'], {
  env: { ...process.env, WORKER_ENABLED: 'true' },
  stdio: 'inherit'
});

// Handle shutdown
process.on('SIGINT', () => {
  api.kill();
  worker.kill();
  process.exit(0);
});
```

#### 1.3 Simple Development Mode (Current Behavior)

**File:** `scripts/start-dev-simple.js`

For developers who want the simplest setup (accepting reconnections):
- Single process with nodemon
- Bots reconnect automatically after restart
- Faster startup, simpler debugging

### 2. Package.json Scripts

```json
{
  "scripts": {
    "dev": "node scripts/start-dev-stable.js",
    "dev:simple": "nodemon",
    "dev:api": "cross-env WORKER_ENABLED=false nodemon",
    "dev:worker": "cross-env WORKER_ENABLED=true ts-node-dev --respawn --watch src/workers src/workers/message.worker.ts",
    "dev:full": "node scripts/start-dev.js"
  }
}
```

**Script Descriptions:**
- `dev` - Recommended: Stable connections with separate processes
- `dev:simple` - Quick start: Single process, bots reconnect on restart
- `dev:api` - API only: For frontend development
- `dev:worker` - Worker only: For testing bot connections
- `dev:full` - Production-like: Uses compiled code

### 3. Worker Process Enhancements

#### 3.1 Worker Baileys Manager Improvements

**File:** `src/services/worker-baileys.manager.ts`

Enhancements needed:
1. Better connection state tracking
2. Automatic reconnection with exponential backoff
3. Health check endpoint
4. Graceful shutdown handling

```typescript
export class WorkerBaileysManager {
  private connections: Map<string, WASocket> = new Map();
  private connectionHealth: Map<string, ConnectionHealth> = new Map();
  
  async initialize(): Promise<void> {
    // Subscribe to Redis events
    await this.subscribeToEvents();
    
    // Restore existing connections
    await this.restoreConnections();
    
    // Start health check interval
    this.startHealthCheck();
  }
  
  private startHealthCheck(): void {
    setInterval(() => {
      this.checkAllConnections();
    }, 30000); // Every 30 seconds
  }
  
  async shutdown(): Promise<void> {
    // Stop accepting new connections
    // Wait for active operations
    // Gracefully close all connections
    // Persist connection state
  }
}
```

#### 3.2 Connection State Persistence

Store connection state in Redis to survive worker restarts:

```typescript
interface ConnectionState {
  botId: string;
  status: 'connected' | 'connecting' | 'disconnected';
  lastSeen: Date;
  phoneNumber?: string;
  reconnectAttempts: number;
}
```

### 4. Frontend Improvements

#### 4.1 Connection Status Polling

Add fallback polling for connection status when WebSocket is disconnected:

```typescript
// In useBots.ts or BotDetailsPage.tsx
useEffect(() => {
  const interval = setInterval(async () => {
    if (!socket?.connected) {
      // Fetch bot status from API
      const status = await api.get(`/bots/${botId}/status`);
      updateBotStatus(status);
    }
  }, 5000); // Poll every 5 seconds when WebSocket is down
  
  return () => clearInterval(interval);
}, [socket?.connected, botId]);
```

#### 4.2 Reconnection Indicator

Show clear UI feedback when bot is reconnecting:

```typescript
{bot.status === 'connecting' && (
  <div className="flex items-center gap-2">
    <Spinner size="sm" />
    <span>Reconnecting... (Attempt {reconnectAttempt}/5)</span>
  </div>
)}
```

## Data Models

### Connection Health Tracking

```typescript
interface ConnectionHealth {
  botId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastMessageSent: Date;
  lastMessageReceived: Date;
  lastQRGenerated?: Date;
  reconnectAttempts: number;
  errors: Array<{
    timestamp: Date;
    error: string;
  }>;
}
```

### Redis Keys

```
bot:connection:{botId}:state     - Connection state
bot:connection:{botId}:health    - Health metrics
bot:connection:{botId}:lock      - Distributed lock
```

## Error Handling

### 1. Worker Process Crashes

**Scenario:** Worker process crashes unexpectedly

**Handling:**
1. PM2/nodemon automatically restarts worker
2. Worker reads connection state from Redis
3. Worker attempts to restore connections
4. If session files exist, reconnect without QR
5. If session files missing, mark bot as requiring reconnection

### 2. Redis Connection Loss

**Scenario:** Redis becomes unavailable

**Handling:**
1. Worker continues managing existing connections
2. New connection requests are queued in memory
3. Automatic reconnection to Redis with exponential backoff
4. Replay queued events once Redis is back

### 3. Database Connection Loss

**Scenario:** PostgreSQL becomes unavailable

**Handling:**
1. Worker maintains bot connections (they don't depend on DB)
2. Message status updates are queued
3. Automatic reconnection to database
4. Flush queued updates once database is back

### 4. Session File Corruption

**Scenario:** Session files become corrupted

**Handling:**
1. Detect corruption on connection attempt
2. Delete corrupted session files
3. Update bot status to 'qr_required'
4. Generate new QR code
5. Notify user via WebSocket

## Testing Strategy

### Unit Tests

1. **Worker Baileys Manager**
   - Connection lifecycle
   - Reconnection logic
   - Health check functionality
   - Graceful shutdown

2. **Development Scripts**
   - Process spawning
   - Signal handling
   - Error propagation

### Integration Tests

1. **Bot Connection Stability**
   - Create bot and connect
   - Restart API server (worker stays up)
   - Verify bot remains connected
   - Send message through bot
   - Verify message delivery

2. **Worker Restart**
   - Connect multiple bots
   - Restart worker process
   - Verify all bots reconnect
   - Verify session persistence

3. **Browser Disconnect**
   - Connect bot
   - Close browser
   - Wait 5 minutes
   - Reopen browser
   - Verify bot still connected

### Manual Testing Checklist

1. Start development server with `npm run dev`
2. Create and connect a bot
3. Modify API code (e.g., add console.log)
4. Verify API restarts but bot stays connected
5. Close browser tab
6. Wait 2 minutes
7. Reopen browser
8. Verify bot status shows 'connected'
9. Send test message
10. Verify message delivers successfully

## Performance Considerations

### Memory Usage

- Each bot connection uses ~10-20MB of memory
- Worker process should handle 50-100 concurrent connections
- Monitor memory usage and set max_memory_restart in PM2

### CPU Usage

- Connection management is I/O bound, not CPU intensive
- Message processing may spike CPU during high volume
- Consider horizontal scaling for >100 bots

### Network

- Each bot maintains persistent WebSocket to WhatsApp
- Bandwidth usage depends on message volume
- Monitor network I/O for bottlenecks

## Deployment Considerations

### Development

- Use `npm run dev` for stable development experience
- Use `npm run dev:simple` for quick iterations
- Worker logs to `logs/message-worker-out.log`
- API logs to `logs/api-server-out.log`

### Production

- Use PM2 with `ecosystem.config.js`
- Run 2+ API instances for load balancing
- Run 1 worker instance (avoid connection conflicts)
- Set up log rotation
- Monitor worker health with PM2 monitoring

### Docker

- Separate containers for API and worker
- Share session volume between worker restarts
- Use Docker Compose health checks
- Set proper restart policies

## Migration Path

### Phase 1: Improve Current Setup (Quick Win)

1. Update nodemon.json to ignore more files
2. Add delay to nodemon
3. Document current behavior

### Phase 2: Separate Processes (Recommended)

1. Create start-dev-stable.js script
2. Add ts-node-dev dependency
3. Update package.json scripts
4. Test with multiple bots

### Phase 3: Enhanced Monitoring (Optional)

1. Add connection health tracking
2. Implement health check endpoint
3. Add Prometheus metrics
4. Set up alerting

## Alternative Approaches Considered

### 1. Hot Module Replacement (HMR)

**Pros:** No server restart needed
**Cons:** Complex to implement, doesn't work well with WebSocket connections
**Decision:** Not suitable for this use case

### 2. Single Process with Connection Pooling

**Pros:** Simpler architecture
**Cons:** Still requires restart on code changes, doesn't solve the core problem
**Decision:** Doesn't meet requirements

### 3. Kubernetes with StatefulSets

**Pros:** Production-grade solution
**Cons:** Overkill for development, complex setup
**Decision:** Good for production, not for development workflow
