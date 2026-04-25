# Development Guide

## Overview

This guide explains how to develop the WhatsApp API Platform with stable bot connections. The system uses a split architecture where the API server and bot connection worker run in separate processes.

## Architecture

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

## Development Modes

### 1. Stable Mode (Recommended)

**Command:** `npm run dev`

This mode runs API and worker in separate processes. When you change code:
- API server restarts automatically (via nodemon)
- Worker process stays running
- **Bot connections remain active** ✅

**Use this when:**
- Developing API endpoints
- Working on frontend
- Testing bot connections
- You want bots to stay connected during development

### 2. Simple Mode

**Command:** `npm run dev:simple`

This mode runs everything in a single process. When you change code:
- Entire server restarts
- All bots disconnect and reconnect
- Faster startup, simpler debugging

**Use this when:**
- Quick prototyping
- You don't mind reconnecting bots
- Debugging connection issues

### 3. API Only Mode

**Command:** `npm run dev:api`

Runs only the API server without managing bot connections.

**Use this when:**
- Developing frontend
- Testing API endpoints
- Worker is running separately

### 4. Worker Only Mode

**Command:** `npm run dev:worker`

Runs only the worker process that manages bot connections.

**Use this when:**
- Testing bot connection logic
- Debugging worker issues
- API is running separately

### 5. Production-like Mode

**Command:** `npm run dev:full`

Runs compiled code (requires `npm run build` first).

**Use this when:**
- Testing production build
- Debugging production issues

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- RabbitMQ

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize database:
```bash
npm run setup
```

5. Start development server:
```bash
npm run dev
```

## Development Workflow

### Making Changes to API Code

1. Start in stable mode: `npm run dev`
2. Make changes to files in `src/` (except `src/workers/`)
3. API server will restart automatically
4. Bots stay connected ✅
5. Test your changes

### Making Changes to Worker Code

1. Start in stable mode: `npm run dev`
2. Make changes to files in `src/workers/` or `src/services/worker-baileys.manager.ts`
3. Worker will restart automatically
4. Bots will reconnect (this is expected)
5. Test your changes

### Testing Bot Connections

1. Start server: `npm run dev`
2. Open browser: http://localhost:3000
3. Create a bot
4. Connect the bot (scan QR code)
5. Make changes to API code
6. Verify bot stays connected
7. Send a test message

## Troubleshooting

### Bots Keep Disconnecting

**Problem:** Bots disconnect when you save files

**Solution:**
- Make sure you're using `npm run dev` (not `npm run dev:simple`)
- Check that nodemon is ignoring worker files (see `nodemon.json`)
- Verify worker process is running separately

### Worker Not Starting

**Problem:** Worker process fails to start

**Solution:**
- Check Redis is running: `redis-cli ping`
- Check RabbitMQ is running: visit http://localhost:15672
- Check PostgreSQL is running: `psql -U postgres -h localhost -p 5433`
- Check logs in `logs/message-worker-out.log`

### API Restarts Too Often

**Problem:** API restarts on every file change

**Solution:**
- Check `nodemon.json` configuration
- Make sure you have the 1 second delay configured
- Verify ignored patterns include sessions, logs, dist

### Port Already in Use

**Problem:** Cannot start server, port 3000 is in use

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or change PORT in .env
```

### Session Files Corrupted

**Problem:** Bot fails to connect with session error

**Solution:**
```bash
# Clean up bot sessions
npm run cleanup:bots

# Or manually delete session folder
rm -rf sessions/{botId}
```

### Redis Connection Failed

**Problem:** Worker cannot connect to Redis

**Solution:**
- Check Redis is running: `docker ps` or `redis-cli ping`
- Verify REDIS_HOST and REDIS_PORT in .env
- Check Redis logs: `docker logs whatsapp-redis`

### Database Migration Issues

**Problem:** Database schema is out of date

**Solution:**
```bash
# Run migrations
npm run migrate

# Or reset database (WARNING: deletes all data)
npm run db:init
```

## Common Tasks

### Adding a New API Endpoint

1. Add route in `src/routes/`
2. Add service method in `src/services/`
3. Test with Postman or curl
4. API will restart automatically

### Adding Worker Functionality

1. Modify `src/workers/message.worker.ts` or `src/services/worker-baileys.manager.ts`
2. Worker will restart automatically
3. Bots will reconnect
4. Test functionality

### Debugging

**API Server:**
```bash
# View API logs
tail -f logs/api-server-out.log

# View API errors
tail -f logs/api-server-error.log
```

**Worker:**
```bash
# View worker logs
tail -f logs/message-worker-out.log

# View worker errors
tail -f logs/message-worker-error.log
```

**Combined:**
```bash
# View all logs
tail -f logs/*.log
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- bot.service.test.ts

# Run with coverage
npm test -- --coverage
```

## Best Practices

### Code Organization

- Keep API logic in `src/routes/` and `src/services/`
- Keep worker logic in `src/workers/` and `src/services/worker-baileys.manager.ts`
- Shared utilities go in `src/utils/`
- Types go in `src/types/`

### Error Handling

- Always use try-catch in async functions
- Use custom error classes from `src/utils/errors.ts`
- Log errors with context using the logger
- Return meaningful error messages to clients

### Logging

```typescript
import { logger } from '../utils/logger';

// Info level
logger.info('Bot connected', { botId, phoneNumber });

// Debug level (only in development)
logger.debug('Processing message', { messageId, botId });

// Error level
logger.error('Failed to send message', error);

// Warning level
logger.warn('QR code expired', { botId });
```

### Database Queries

- Always use parameterized queries to prevent SQL injection
- Use transactions for multi-step operations
- Close connections properly
- Handle connection errors gracefully

### Redis Usage

- Set appropriate TTLs for cached data
- Use meaningful key patterns
- Handle connection failures
- Don't store large objects

## Performance Tips

### Development

- Use `npm run dev` for best development experience
- Keep sessions folder clean (run `npm run cleanup:bots` periodically)
- Monitor memory usage with `npm run pm2:monit` in production

### Production

- Use PM2 for process management: `npm run pm2:start`
- Enable log rotation
- Monitor worker health
- Set up alerts for connection failures

## Environment Variables

Key environment variables for development:

```bash
# Server
NODE_ENV=development
PORT=3000
WORKER_ENABLED=false  # Set by npm scripts

# Database
DB_HOST=localhost
DB_PORT=5433
DB_NAME=whatsapp_api
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Worker
WORKER_HEARTBEAT_INTERVAL=10000
WORKER_HEALTH_CHECK_INTERVAL=30000
SHUTDOWN_TIMEOUT=30000

# Baileys
BAILEYS_SESSION_PATH=./sessions
```

## Next Steps

- Read [README.md](../README.md) for project overview
- Check [DOCKER-SETUP.md](./DOCKER-SETUP.md) for Docker deployment
- Review [API documentation](./API.md) for endpoint details
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design

## Getting Help

- Check logs in `logs/` directory
- Review error messages carefully
- Search existing issues on GitHub
- Ask in team chat or create an issue
