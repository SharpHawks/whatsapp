# Deployment Guide

## Architecture Overview

The WhatsApp API Platform uses a **two-process architecture**:

1. **Main API Process** (`api-server`)
   - Handles HTTP/WebSocket requests from frontend
   - Coordinates bot actions via Redis PubSub events
   - Does NOT manage WhatsApp connections directly
   - Runs with `WORKER_ENABLED=false`

2. **Worker Process** (`message-worker`)
   - Manages ALL WhatsApp (Baileys) connections
   - Processes message queue from RabbitMQ
   - Handles bot connection lifecycle
   - Publishes events to Redis PubSub
   - Runs with `WORKER_ENABLED=true`

## Process Management with PM2

### Starting Processes

```bash
# Start all processes
pm2 start ecosystem.config.js

# Start only API server
pm2 start ecosystem.config.js --only api-server

# Start only worker
pm2 start ecosystem.config.js --only message-worker

# Start with specific environment
pm2 start ecosystem.config.js --env production
pm2 start ecosystem.config.js --env development
```

### Monitoring

```bash
# View all processes
pm2 list

# Monitor in real-time
pm2 monit

# View logs
pm2 logs

# View logs for specific process
pm2 logs api-server
pm2 logs message-worker

# View last 100 lines
pm2 logs --lines 100
```

### Restarting

```bash
# Restart all processes
pm2 restart all

# Restart specific process
pm2 restart api-server
pm2 restart message-worker

# Graceful reload (zero-downtime for API)
pm2 reload api-server
```

### Stopping

```bash
# Stop all processes
pm2 stop all

# Stop specific process
pm2 stop api-server
pm2 stop message-worker

# Delete from PM2 list
pm2 delete all
pm2 delete api-server
```

## Environment Configuration

### Main API Process

Required environment variables:
```bash
WORKER_ENABLED=false
NODE_ENV=production
PORT=3000

# Redis for PubSub and caching
REDIS_HOST=localhost
REDIS_PORT=6379

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_api
```

### Worker Process

Required environment variables:
```bash
WORKER_ENABLED=true
NODE_ENV=production

# Redis for PubSub, storage, and locking
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ for message queue
RABBITMQ_URL=amqp://localhost:5672

# Worker configuration
WORKER_HEARTBEAT_INTERVAL=10000
WORKER_HEALTH_CHECK_INTERVAL=30000
SHUTDOWN_TIMEOUT=30000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_api
```

## Deployment Steps

### 1. Prerequisites

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Ensure logs directory exists
mkdir -p logs
```

### 2. Database Setup

```bash
# Run migrations
npm run migrate

# Or initialize database
npm run db:init
```

### 3. Start Services

```bash
# Start Redis
redis-server

# Start RabbitMQ
rabbitmq-server

# Start PostgreSQL
# (depends on your setup)
```

### 4. Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

## Scaling

### Horizontal Scaling

**API Server:**
- Can run multiple instances (currently configured for 2)
- Load balanced automatically by PM2 cluster mode
- Increase instances in `ecosystem.config.js`:
  ```javascript
  instances: 4, // or 'max' for CPU count
  ```

**Worker Process:**
- Should run ONLY 1 instance per deployment
- Multiple workers can run on different servers
- Each worker manages its own set of bot connections
- Distributed locks prevent connection conflicts

### Vertical Scaling

Adjust memory limits in `ecosystem.config.js`:
```javascript
max_memory_restart: '2G', // Increase as needed
```

## Monitoring

### Worker Health

Check worker status via admin API:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/admin/workers
```

Response:
```json
{
  "success": true,
  "data": {
    "workers": [
      {
        "workerId": "hostname-12345",
        "hostname": "hostname",
        "pid": 12345,
        "connectionCount": 10,
        "lastHeartbeat": "2024-01-01T12:00:00.000Z",
        "status": "active",
        "age": 5000
      }
    ],
    "stats": {
      "totalWorkers": 1,
      "activeWorkers": 1,
      "inactiveWorkers": 0,
      "totalConnections": 10
    }
  }
}
```

### Connection Status

Check bot connections:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/admin/connections
```

## Troubleshooting

### Worker Not Starting

1. Check logs:
   ```bash
   pm2 logs message-worker --lines 50
   ```

2. Verify environment:
   ```bash
   pm2 env message-worker
   ```

3. Check Redis connection:
   ```bash
   redis-cli ping
   ```

4. Check RabbitMQ:
   ```bash
   rabbitmqctl status
   ```

### Connections Not Restoring

1. Check worker heartbeat in Redis:
   ```bash
   redis-cli keys "worker:*:heartbeat"
   redis-cli get "worker:hostname-12345:heartbeat"
   ```

2. Check bot status in database:
   ```sql
   SELECT id, name, connection_status FROM bots WHERE is_active = true;
   ```

3. Restart worker:
   ```bash
   pm2 restart message-worker
   ```

### High Memory Usage

1. Check process memory:
   ```bash
   pm2 list
   ```

2. Increase memory limit or reduce connections per worker

3. Consider running multiple workers on different servers

## Graceful Shutdown

The worker implements graceful shutdown:

1. Stops accepting new messages
2. Waits for active messages to complete (up to 30s)
3. Saves all connection states
4. Closes all WhatsApp connections
5. Disconnects from Redis and RabbitMQ

To trigger:
```bash
pm2 stop message-worker
# or
pm2 restart message-worker
```

## Backup and Recovery

### Session Backup

WhatsApp sessions are stored in `./sessions/`:
```bash
# Backup sessions
tar -czf sessions-backup.tar.gz sessions/

# Restore sessions
tar -xzf sessions-backup.tar.gz
```

### Database Backup

```bash
# Backup database
pg_dump whatsapp_api > backup.sql

# Restore database
psql whatsapp_api < backup.sql
```

## Security Considerations

1. **Redis Security:**
   - Use password authentication
   - Run on private network only
   - Enable TLS in production

2. **Process Isolation:**
   - API and worker run as separate processes
   - Worker has no HTTP endpoints exposed
   - Communication only via Redis PubSub

3. **Secrets Management:**
   - Use environment variables
   - Never commit `.env` files
   - Use secret management tools in production

## Performance Tuning

### Redis

```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### RabbitMQ

```bash
# Increase prefetch count for better throughput
# (configured in queue.service.ts)
```

### Database

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_bots_status ON bots(connection_status) WHERE is_active = true;
CREATE INDEX idx_messages_status ON messages(status);
```

## Support

For issues or questions:
- Check logs: `pm2 logs`
- Review admin endpoints: `/api/v1/admin/workers`
- Check Redis: `redis-cli monitor`
- Check RabbitMQ: `rabbitmqctl list_queues`
