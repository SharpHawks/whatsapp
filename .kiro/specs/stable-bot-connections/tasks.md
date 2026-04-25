# Implementation Plan

- [x] 1. Update nodemon configuration for better file watching


  - Update `nodemon.json` to ignore worker files, sessions, logs, dist, and .git directories
  - Add 1 second delay to debounce rapid file changes
  - Test that nodemon only restarts on relevant file changes
  - _Requirements: 5.1, 5.2, 5.3_



- [x] 2. Create stable development startup script

  - [x] 2.1 Create `scripts/start-dev-stable.js` script

    - Spawn API server with nodemon (WORKER_ENABLED=false)
    - Spawn worker process with ts-node-dev watching only src/workers
    - Add proper signal handling for graceful shutdown (SIGINT, SIGTERM)
    - Add colored console output for better visibility
    - _Requirements: 4.3, 5.4_

  - [x] 2.2 Create simple development script `scripts/start-dev-simple.js`


    - Single process startup for quick iterations
    - Document that bots will reconnect on restart
    - _Requirements: 4.3_



  - [x] 2.3 Update package.json scripts

    - Add `dev` script pointing to start-dev-stable.js
    - Add `dev:simple` script for single process mode
    - Add `dev:api` script for API-only mode
    - Add `dev:worker` script for worker-only mode
    - Update script descriptions in package.json
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3. Enhance worker process stability


  - [x] 3.1 Add connection health tracking to WorkerBaileysManager


    - Create ConnectionHealth interface with status, timestamps, and error tracking
    - Implement health check method that runs every 30 seconds
    - Store health metrics in Redis with TTL
    - _Requirements: 3.1, 3.4_



  - [x] 3.2 Implement connection state persistence in Redis

    - Create ConnectionState interface
    - Save connection state to Redis on status changes
    - Load connection state on worker startup
    - Add Redis key patterns: `bot:connection:{botId}:state`, `bot:connection:{botId}:health`


    - _Requirements: 3.1, 3.2_

  - [x] 3.3 Improve graceful shutdown handling

    - Implement proper shutdown sequence in WorkerBaileysManager
    - Wait for active operations to complete (with timeout)


    - Persist connection state before shutdown
    - Log shutdown progress
    - _Requirements: 3.1, 3.4_




  - [x] 3.4 Add automatic reconnection with exponential backoff

    - Implement reconnection logic with configurable max attempts

    - Use exponential backoff: 1s, 2s, 4s, 8s, 16s
    - Track reconnection attempts in connection health
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Add bot status API endpoint

  - Create GET `/api/v1/bots/:botId/status` endpoint
  - Return current connection status, health metrics, and last activity
  - Verify bot ownership before returning status
  - _Requirements: 6.4_

- [x] 5. Enhance frontend connection status handling


  - [x] 5.1 Add status polling fallback in BotDetailsPage


    - Implement polling when WebSocket is disconnected
    - Poll every 5 seconds using the new status endpoint
    - Stop polling when WebSocket reconnects
    - _Requirements: 2.2, 6.4_



  - [x] 5.2 Add reconnection indicator UI

    - Show spinner and attempt count when status is 'connecting'
    - Display clear message when bot is reconnecting
    - Update Badge component to handle 'connecting' state
    - _Requirements: 6.1, 6.2_

  - [x] 5.3 Improve real-time status updates


    - Ensure bot status updates are reflected immediately in UI
    - Update both bot details page and bots list when status changes
    - Add toast notifications for connection/disconnection events
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. Update documentation



  - [x] 6.1 Create development guide


    - Document all npm scripts and when to use each
    - Explain the difference between stable and simple modes
    - Add troubleshooting section for common issues
    - _Requirements: 4.3_

  - [x] 6.2 Update README.md


    - Add section about bot connection stability
    - Document that bots stay connected when browser is closed
    - Explain worker process architecture
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 6.3 Create architecture diagram


    - Visual representation of API and worker separation
    - Show Redis/RabbitMQ communication flow
    - Include in docs folder
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 7. Add integration tests
  - [ ] 7.1 Test bot connection stability during API restart
    - Create bot and connect
    - Restart API server
    - Verify bot remains connected
    - Send message and verify delivery
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 7.2 Test worker restart with multiple bots
    - Connect 3 bots
    - Restart worker process
    - Verify all bots reconnect automatically
    - Verify session persistence
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 7.3 Test browser disconnect scenario
    - Connect bot
    - Close browser for 5 minutes
    - Reopen browser
    - Verify bot status shows 'connected'
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8. Add monitoring and health checks



  - [x] 8.1 Create health check endpoint for worker


    - Add GET `/health/worker` endpoint
    - Return worker status, active connections count, and health metrics
    - Include memory usage and uptime
    - _Requirements: 3.4_

  - [x] 8.2 Add connection metrics logging


    - Log connection events (connect, disconnect, reconnect)
    - Track average reconnection time
    - Monitor failed connection attempts
    - _Requirements: 3.4, 6.3_



  - [ ] 8.3 Implement alerting for connection issues
    - Alert when bot fails to reconnect after max attempts
    - Alert when worker process crashes repeatedly
    - Send notifications via configured channels
    - _Requirements: 3.1, 3.4_
