# Implementation Plan

- [x] 1. Create Redis PubSub Service





  - Implement core Redis PubSub service for inter-process communication
  - Create TypeScript interfaces for event handlers and message types
  - Implement connection management with automatic reconnection
  - Implement event queue for handling disconnections
  - Add methods for publishing bot lifecycle events (connect, disconnect, qr_generated, etc.)
  - Add methods for subscribing to bot and worker events
  - _Requirements: 1.1, 1.2, 1.3, 2.4, 4.1, 4.4, 5.1, 7.2_

- [x] 2. Implement Redis data storage utilities



  - Create utility functions for storing QR codes in Redis with TTL
  - Create utility functions for worker heartbeat storage and retrieval
  - Create utility functions for worker connection list management
  - Add Redis key pattern constants for consistency
  - _Requirements: 2.1, 2.2, 5.2, 5.4_



- [x] 3. Refactor Bot Service to use Redis events

  - Remove direct calls to baileysManager.createConnection()
  - Remove direct calls to baileysManager.disconnectBot()
  - Implement connectBot() method that publishes bot:connect event
  - Implement disconnectBot() method that publishes bot:disconnect event
  - Implement getQRCode() method that retrieves QR from Redis
  - Update bot creation to only set status without creating connection
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.1_

- [x] 4. Update Worker Baileys Manager for event-driven architecture


- [x] 4.1 Add Redis PubSub event subscription


  - Implement startEventListener() method to subscribe to bot events
  - Add handler for bot:connect events to create connections
  - Add handler for bot:disconnect events to close connections
  - Initialize event listener in worker startup
  - _Requirements: 1.3, 4.2_

- [x] 4.2 Modify QR code handling to use Redis


  - Update QR code generation to store in Redis instead of database
  - Set 60 second TTL on QR code keys
  - Publish qr:generated event after storing QR code
  - Remove database QR code storage logic
  - _Requirements: 1.4, 1.5, 2.1_



- [x] 4.3 Implement connection state event publishing

  - Publish bot:connected event when connection opens with phone number
  - Publish bot:disconnected event when connection closes normally
  - Publish bot:connection_lost event for unexpected disconnections
  - Include error details in connection_lost events


  - _Requirements: 1.5, 4.3, 4.4, 7.1, 7.2, 7.4_

- [x] 4.4 Add worker heartbeat mechanism

  - Implement startHeartbeat() method with 10 second interval
  - Store heartbeat data in Redis with 30 second TTL
  - Include timestamp, connection count, hostname, and PID in heartbeat
  - Store list of managed bot IDs in separate Redis key
  - Publish worker:started event on initialization
  - Publish worker:ready event after connection restoration
  - _Requirements: 5.1, 5.2, 6.4_

- [x] 4.5 Implement automatic connection restoration


  - Load all bots with status 'connected' on worker startup
  - Create connections in parallel using Promise.all
  - Log failures and update bot status to disconnected for failed restorations
  - Continue with successful connections even if some fail
  - Publish worker:ready event with connection count
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 5. Update Main API to handle Redis events



  - Initialize Redis PubSub service in startup
  - Subscribe to qr:generated events and forward to WebSocket clients
  - Subscribe to bot:connected events and forward to WebSocket clients
  - Subscribe to bot:disconnected events and forward to WebSocket clients
  - Subscribe to bot:connection_lost events and send error notifications
  - Add helper function to get bot's user ID for event routing
  - _Requirements: 2.4, 4.4, 7.2, 7.3_


- [x] 6. Add new bot API endpoints


  - Add POST /api/v1/bots/:botId/connect endpoint
  - Add POST /api/v1/bots/:botId/disconnect endpoint
  - Add GET /api/v1/bots/:botId/qr endpoint
  - Update existing bot routes to use new service methods
  - Add proper error handling and ownership verification
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 4.1_

- [x] 7. Implement admin worker monitoring endpoints


- [x] 7.1 Create admin service methods


  - Implement getActiveWorkers() to scan Redis for worker heartbeats
  - Implement getWorkerConnections() to retrieve bot list for specific worker
  - Parse heartbeat data and calculate worker status (active/inactive)
  - Return structured worker information with health status
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 7.2 Add admin API routes


  - Add GET /api/v1/admin/workers endpoint
  - Add GET /api/v1/admin/workers/:workerId/connections endpoint
  - Add admin authentication middleware to routes
  - Return JSON responses with worker and connection data
  - _Requirements: 5.3, 5.4_

- [x] 8. Update message processing error handling


  - Check for active connection before processing message
  - Return message to queue with delay if no connection exists
  - Increment retry counter on each attempt
  - Move to dead letter queue after 3 failed attempts
  - Update message status to 'failed' in database for dead letters
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Update environment configuration


  - Add WORKER_HEARTBEAT_INTERVAL to config with default 10000ms
  - Update .env.example with new configuration options
  - Document all Redis-related environment variables
  - Update config validation to check required Redis settings
  - _Requirements: 5.2_



- [x] 10. Update graceful shutdown handling

  - Stop heartbeat interval on worker shutdown
  - Unsubscribe from all Redis PubSub channels
  - Close Redis PubSub connections
  - Ensure all connections are saved before shutdown

  - _Requirements: 4.2, 4.3, 6.1, 6.2, 6.3_

- [x] 11. Add comprehensive error handling


  - Implement Redis connection loss handling with event queue
  - Add error logging for all Redis operations
  - Implement fallback behavior when Redis is unavailable
  - Add retry logic for critical Redis operations

  - Log all connection failures with stack traces
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 12. Update PM2 configuration


  - Configure main API process with WORKER_ENABLED=false
  - Configure worker process with WORKER_ENABLED=true
  - Set appropriate instance counts for each process
  - Add environment-specific configurations
  - Document process management commands
  - _Requirements: 5.1, 6.1_
