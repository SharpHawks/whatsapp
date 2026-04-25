# Implementation Plan

- [x] 1. Add database schema for process tracking





  - Add connection_process_id, connection_hostname, and connection_updated_at columns to bots table
  - Create index on connection_status and connection_updated_at for monitoring queries
  - Write migration script to update existing database
  - _Requirements: 4.1, 4.2, 6.1, 6.2_

- [x] 2. Implement distributed lock service



  - [x] 2.1 Create RedisLockService class


    - Implement acquireLock method using Redis SET with NX and PX options
    - Implement releaseLock method with Lua script to verify lock ownership
    - Implement extendLock method for long-running operations
    - Add lock tracking with Map to store lockIds
    - _Requirements: 5.2, 5.3, 5.4_
  
  - [x] 2.2 Add lock service configuration


    - Add REDIS_URL environment variable
    - Create Redis client connection in lock service
    - Add error handling for Redis connection failures
    - _Requirements: 5.2_

- [x] 3. Create WorkerBaileysManager class



  - [x] 3.1 Implement connection pool management


    - Create Map to store ConnectionInfo objects indexed by botId
    - Implement getConnection method to retrieve active socket
    - Implement closeConnection method to gracefully close single connection
    - Implement closeAllConnections method for shutdown
    - _Requirements: 1.1, 1.2, 3.1_
  
  - [x] 3.2 Implement connection initialization


    - Create initialize method to load active bots from database
    - Implement loadActiveBots query to fetch bots with status 'connected' or 'qr_required'
    - Implement createConnection method with distributed lock acquisition
    - Add restoreSession method to load auth state from baileys_sessions table
    - Create Baileys socket with restored auth state
    - Store connection info with processId and hostname
    - _Requirements: 3.1, 3.2, 3.3, 5.2, 5.3_
  

  - [x] 3.3 Set up Baileys event handlers

    - Implement setupEventHandlers method for connection.update events
    - Handle 'open' connection status and update database
    - Handle 'close' connection status and trigger reconnection
    - Implement creds.update handler to save session state
    - Add logging for all connection state changes
    - _Requirements: 3.3, 4.1, 4.2_
  

  - [x] 3.4 Implement reconnection logic

    - Create scheduleReconnection method with exponential backoff
    - Set max retry attempts to 5
    - Set max backoff delay to 30 seconds
    - Add check for isShuttingDown flag before reconnecting
    - _Requirements: 3.5_
  

  - [x] 3.5 Implement connection health monitoring

    - Create startHealthCheck method with 30-second interval
    - Implement checkConnectionHealth method to verify socket state
    - Update lastHealthCheck timestamp in ConnectionInfo
    - Log health check results
    - _Requirements: 3.4_
  

  - [x] 3.6 Implement session management

    - Create saveSession method to store auth state in baileys_sessions table
    - Implement upsert logic for session updates
    - Add error handling for database failures
    - _Requirements: 3.2_
  
  - [x] 3.7 Implement graceful shutdown


    - Create shutdown method to handle SIGTERM/SIGINT
    - Set isShuttingDown flag to prevent new connections
    - Stop health check interval
    - Save all session states to database
    - Close all Baileys sockets gracefully
    - Update connection status to 'disconnected' for all bots





    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 4. Update connection status service
  - [ ] 4.1 Create updateConnectionStatus method
    - Update bots table with status, processId, hostname, and timestamp

    - Add database query with all process tracking fields
    - Emit socket event to frontend with connection status change
    - Add error handling for database and socket failures
    - _Requirements: 4.1, 4.2, 4.5_
  


  - [ ] 4.2 Implement getConnectionStatus method
    - Query bots table for connection status with process info
    - Add Redis caching with 5-second TTL
    - Return ConnectionStatus object
    - _Requirements: 4.3, 4.4_
  

  - [ ] 4.3 Create listActiveConnections endpoint
    - Implement GET /api/v1/admin/connections endpoint
    - Query all bots with connection_status = 'connected'




    - Return list with botId, status, processId, hostname, updatedAt
    - Add authentication check for admin users
    - _Requirements: 6.4_
  

  - [ ] 4.4 Implement stale connection cleanup
    - Create cleanupStaleConnections method
    - Find connections with updatedAt older than 60 seconds
    - Update status to 'disconnected' for stale connections
    - Run cleanup on worker startup and periodically
    - _Requirements: 6.5_


- [x] 5. Refactor message worker to use WorkerBaileysManager

  - [ ] 5.1 Initialize WorkerBaileysManager in worker constructor
    - Create instance of WorkerBaileysManager
    - Call initialize method in worker start function
    - Add error handling for initialization failures
    - _Requirements: 1.1, 3.1_
  
  - [x] 5.2 Update processMessage to use worker connections

    - Call baileysManager.getConnection(botId) to get socket
    - Remove old baileys service dependency
    - Throw ConnectionError if no active connection found
    - Use socket.sendMessage to send WhatsApp message
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  
  - [ ] 5.3 Implement graceful shutdown in worker
    - Add SIGTERM and SIGINT signal handlers
    - Set isShuttingDown flag to stop accepting new messages
    - Track active messages with Set
    - Wait for active messages to complete with 30-second timeout
    - Call baileysManager.shutdown() after messages complete
    - Close queue connection
    - Exit with code 0
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 5.4 Add message processing timeout
    - Wrap processMessage in timeout promise
    - Set timeout to 5 seconds per requirement
    - Update message status to 'failed' on timeout
    - Log timeout errors
    - _Requirements: 1.4_

- [x] 6. Update main server Baileys service




  - [x] 6.1 Add process tracking to connection updates

    - Update updateConnectionStatus calls to include processId and hostname
    - Use os.hostname() and process.pid
    - Ensure socket events include process information
    - _Requirements: 4.1, 4.2, 6.1, 6.2, 6.3_
  
  - [x] 6.2 Add connection conflict detection

    - Check database for existing connection before creating new one
    - Log warning if connection exists in different process
    - Add option to force disconnect existing connection
    - _Requirements: 5.1, 5.5_

- [x] 7. Add configuration and environment variables

  - Add WORKER_ENABLED flag to enable/disable worker mode
  - Add WORKER_HEALTH_CHECK_INTERVAL for health check frequency
  - Add SHUTDOWN_TIMEOUT for graceful shutdown timeout
  - Add REDIS_URL for distributed locking
  - Update .env.example with new variables

  - Document configuration options in README
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 8. Implement monitoring and logging
  - Add structured logging for connection lifecycle events
  - Log connection creation with botId, processId, hostname
  - Log lock acquisition success/failure
  - Log reconnection attempts with backoff delays
  - Log graceful shutdown progress

  - Add metrics for active connections per process

  - Add metrics for lock acquisition rate
  - _Requirements: 6.3, 6.4_

- [x] 9. Update deployment configuration

  - [x] 9.1 Update PM2 ecosystem config

    - Add message-worker app configuration
    - Set instances to 1 for worker
    - Set kill_timeout to 60000 for graceful shutdown
    - Keep api-server in cluster mode
    - _Requirements: 7.5_
  
  - [x] 9.2 Update Docker configuration

    - Add worker service to docker-compose.yml
    - Share Redis connection between services
    - Set proper environment variables
    - Configure restart policy
    - _Requirements: All requirements_

- [x] 10. Integration testing


  - [ ] 10.1 Test worker initialization with multiple bots
    - Create test with 3 active bots in database
    - Start worker and verify all connections are established
    - Check database for correct process tracking info
    - Verify socket events are emitted
    - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.2_
  
  - [ ] 10.2 Test message processing through worker
    - Queue test message for connected bot
    - Verify worker processes message using its connection
    - Check message status is updated to 'sent'
    - Verify message is delivered to WhatsApp
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ] 10.3 Test distributed lock prevents duplicate connections
    - Start two workers simultaneously
    - Attempt to create connection for same bot from both
    - Verify only one connection is created
    - Check lock acquisition logs
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 10.4 Test graceful shutdown
    - Start worker with active connections
    - Queue message and send SIGTERM during processing
    - Verify worker waits for message to complete
    - Check all sessions are saved to database
    - Verify all connections are closed gracefully
    - Confirm worker exits with code 0
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 10.5 Test reconnection after connection drop
    - Establish connection in worker
    - Simulate connection drop
    - Verify worker attempts reconnection with exponential backoff
    - Check connection is re-established
    - _Requirements: 3.5_
  
  - [ ] 10.6 Test connection status synchronization
    - Change connection status in worker
    - Verify database is updated
    - Check frontend receives socket event
    - Verify main server can read updated status
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
