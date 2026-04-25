# Requirements Document

## Introduction

The Worker-Baileys Integration feature addresses the architectural challenge where the message worker process cannot access Baileys WhatsApp connections that are managed in the main server process. Currently, when messages are queued for delivery, the worker fails because it has no active connection to WhatsApp. This feature will enable the worker to either access existing connections or manage its own connection pool.

## Glossary

- **Worker**: A separate Node.js process that consumes messages from the queue and sends them via WhatsApp
- **Main Server**: The primary Express.js application that handles API requests and manages Baileys connections
- **Baileys Connection**: An active WhatsApp Web socket connection managed by the Baileys library
- **Connection Pool**: A collection of active Baileys connections indexed by bot ID
- **Message Queue**: RabbitMQ queue containing messages waiting to be sent
- **IPC**: Inter-Process Communication mechanism for sharing data between processes
- **Shared State**: Connection information accessible by both worker and main server processes

## Requirements

### Requirement 1

**User Story:** As a system architect, I want the message worker to access active Baileys connections, so that queued messages can be delivered successfully

#### Acceptance Criteria

1. WHEN Worker receives message from queue, THE Worker SHALL retrieve active Baileys connection for the bot ID
2. WHEN Baileys connection exists for bot, THE Worker SHALL use the connection to send the message
3. WHEN message is sent successfully, THE Worker SHALL update message status to 'sent' in database
4. THE Worker SHALL complete message processing within 5 seconds
5. WHEN Worker cannot find active connection, THE Worker SHALL return error with code 'NO_ACTIVE_CONNECTION'

### Requirement 2

**User Story:** As a system architect, I want to choose between shared connection pool or worker-managed connections, so that I can optimize for my deployment architecture

#### Acceptance Criteria

1. THE System SHALL support configuration option for connection management strategy
2. WHERE strategy is 'shared', THE Worker SHALL access connections from Main Server process
3. WHERE strategy is 'worker-managed', THE Worker SHALL initialize and manage its own Baileys connections
4. THE System SHALL document trade-offs between both strategies in configuration
5. WHEN strategy changes, THE System SHALL require process restart to apply new configuration

### Requirement 3

**User Story:** As a developer, I want the worker to initialize its own Baileys connections when using worker-managed strategy, so that it operates independently

#### Acceptance Criteria

1. WHEN Worker starts with 'worker-managed' strategy, THE Worker SHALL load all active bots from database
2. WHEN active bot is found, THE Worker SHALL restore Baileys session from baileys_sessions table
3. WHEN session restoration succeeds, THE Worker SHALL establish WhatsApp connection for the bot
4. THE Worker SHALL maintain connection health monitoring with 30-second intervals
5. WHEN connection drops, THE Worker SHALL attempt reconnection with exponential backoff

### Requirement 4

**User Story:** As a system architect, I want connection state synchronized between main server and worker, so that both processes have accurate connection status

#### Acceptance Criteria

1. WHEN Baileys connection status changes in Main Server, THE Main Server SHALL update connection_status in database
2. WHEN Baileys connection status changes in Worker, THE Worker SHALL update connection_status in database
3. THE System SHALL use database as source of truth for connection status
4. WHEN process queries connection status, THE System SHALL read from database with 5-second cache TTL
5. THE System SHALL emit socket event to frontend when connection status changes from any process

### Requirement 5

**User Story:** As a developer, I want to prevent duplicate connections for the same bot, so that WhatsApp doesn't disconnect due to multi-device limit

#### Acceptance Criteria

1. WHEN Worker attempts to create connection for bot, THE Worker SHALL check if connection exists in Main Server
2. WHERE strategy is 'worker-managed', THE Worker SHALL acquire distributed lock before creating connection
3. WHEN lock is acquired, THE Worker SHALL verify no other process has active connection for bot
4. THE Worker SHALL release lock after connection is established or attempt fails
5. WHEN duplicate connection is detected, THE System SHALL log warning and use existing connection

### Requirement 6

**User Story:** As a system operator, I want to monitor which process manages each bot connection, so that I can troubleshoot connection issues

#### Acceptance Criteria

1. THE System SHALL store process identifier (PID) with each active connection in database
2. THE System SHALL store hostname with each active connection in database
3. WHEN connection is established, THE System SHALL log process ID, hostname, and bot ID
4. THE System SHALL provide API endpoint to list all active connections with process information
5. WHEN process terminates, THE System SHALL mark its connections as 'disconnected' within 30 seconds

### Requirement 7

**User Story:** As a developer, I want graceful shutdown of worker connections, so that sessions are properly saved and no messages are lost

#### Acceptance Criteria

1. WHEN Worker receives SIGTERM or SIGINT signal, THE Worker SHALL stop accepting new messages from queue
2. WHEN shutdown is initiated, THE Worker SHALL wait for in-flight messages to complete with 30-second timeout
3. WHEN all messages are processed, THE Worker SHALL save all Baileys session states to database
4. WHEN sessions are saved, THE Worker SHALL close all Baileys connections gracefully
5. THE Worker SHALL exit with code 0 after successful shutdown within 60 seconds
