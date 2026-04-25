# Implementation Plan

- [x] 1. Set up project structure and core dependencies


  - Initialize Node.js project with TypeScript configuration
  - Install core dependencies: Express, PostgreSQL client, Redis client, Baileys
  - Set up project folder structure: src/services, src/models, src/routes, src/utils
  - Configure environment variables and config management
  - Set up ESLint and Prettier for code quality
  - _Requirements: All requirements depend on proper project setup_



- [ ] 2. Implement database schema and migrations
  - Create PostgreSQL database schema with all tables (users, api_keys, bots, baileys_sessions, messages, media_files, balances, transactions, auto_response_rules, webhook_deliveries)
  - Write database migration scripts using a migration tool (node-pg-migrate or similar)
  - Create database connection pool and query utilities
  - Implement database initialization script


  - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1_

- [ ] 3. Build authentication and user management system
  - [ ] 3.1 Implement user registration with email and password
    - Create User model with password hashing (bcrypt)

    - Implement registration endpoint POST /api/v1/auth/register
    - Add email validation logic
    - Create initial balance record on user registration
    - _Requirements: 1.1_
  

  - [ ] 3.2 Implement user login and JWT token generation
    - Create login endpoint POST /api/v1/auth/login
    - Implement JWT token generation and validation
    - Add refresh token functionality POST /api/v1/auth/refresh
    - _Requirements: 1.1_
  
  - [ ] 3.3 Implement API key management
    - Create API key generation logic with SHA-256 hashing


    - Implement GET /api/v1/auth/api-keys endpoint
    - Implement POST /api/v1/auth/api-keys/regenerate endpoint
    - Create API key validation middleware for protected routes
    - Store API keys in encrypted format in database
    - _Requirements: 1.2, 1.3, 1.4, 1.5_



- [ ] 4. Implement Baileys connection manager
  - [ ] 4.1 Create Baileys connection pool and lifecycle management
    - Implement BaileysConnectionPool class to manage multiple bot connections
    - Create connection initialization with auth state loading


    - Implement QR code generation and storage
    - Handle connection status updates (connecting, qr_required, connected, disconnected)
    - Implement automatic reconnection logic with exponential backoff
    - _Requirements: 2.1, 2.2, 10.2_
  
  - [x] 4.2 Implement session persistence for Baileys


    - Create functions to save auth state (creds and keys) to baileys_sessions table
    - Implement auth state loading from database on bot reconnection
    - Handle session updates and credential changes
    - _Requirements: 2.1_
  
  - [ ] 4.3 Set up event handlers for incoming messages and status updates
    - Implement messages.upsert event handler for incoming messages

    - Implement messages.update event handler for message status changes
    - Implement connection.update event handler for connection state changes
    - Parse different message types (text, image, document, video, audio, button responses)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_


- [ ] 5. Build bot management service
  - [ ] 5.1 Implement bot CRUD operations
    - Create POST /api/v1/bots endpoint to create new bot
    - Generate unique API key for each bot
    - Implement GET /api/v1/bots endpoint to list user's bots
    - Implement GET /api/v1/bots/:botId endpoint to get bot details
    - Implement PUT /api/v1/bots/:botId endpoint to update bot configuration
    - Implement DELETE /api/v1/bots/:botId endpoint to delete bot
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 5.2 Implement bot connection endpoints
    - Create GET /api/v1/bots/:botId/qr endpoint to retrieve QR code for scanning
    - Create POST /api/v1/bots/:botId/disconnect endpoint to logout bot
    - Update bot connection_status in database based on Baileys events
    - _Requirements: 10.2_
  
  - [ ] 5.3 Implement webhook URL configuration
    - Add webhook_url field to bot update endpoint
    - Validate webhook URL format
    - Store webhook URL in bots table
    - _Requirements: 3.1_
  
  - [x] 5.4 Implement auto-response rules management


    - Create endpoints for CRUD operations on auto_response_rules
    - Implement keyword matching logic (case-insensitive)
    - Add enable/disable toggle for auto-response functionality per bot
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 5.5 Enforce bot limit per user

    - Add validation to check bot count before creating new bot
    - Return error if user has reached maximum of 10 bots
    - _Requirements: 10.5_

- [ ] 6. Implement message sending functionality
  - [x] 6.1 Create message queue system



    - Set up RabbitMQ or AWS SQS connection
    - Implement message queue producer to enqueue outgoing messages
    - Create message queue consumer (worker) to process messages
    - Add retry logic with exponential backoff for failed messages
    - _Requirements: 2.3_
  


  - [ ] 6.2 Implement text message sending
    - Create POST /api/v1/messages/send endpoint
    - Validate API key and extract botId
    - Validate phone number format (E.164)
    - Check user balance before queueing message
    - Deduct message cost from user balance
    - Queue message for delivery
    - Return message ID and status in response within 2 seconds


    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.2_
  
  - [ ] 6.3 Implement message worker to send via Baileys
    - Process messages from queue
    - Get Baileys connection for bot
    - Send message using Baileys sendMessage method


    - Update message status in database
    - Handle errors and retry logic
    - _Requirements: 2.3, 2.4_
  
  - [ ] 6.4 Implement media message sending
    - Create POST /api/v1/media/upload endpoint
    - Validate file type and size (max 16 MB)
    - Upload file to cloud storage (AWS S3 or similar)

    - Store media metadata in media_files table
    - Return media ID
    - Support sending messages with media ID
    - Support image, video, audio, and document types
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  

  - [ ] 6.5 Implement interactive button messages
    - Add support for button message type in send endpoint
    - Validate button count (max 3 buttons)
    - Support reply and URL button types
    - Format button message for Baileys
    - _Requirements: 6.1, 6.2, 6.3_
  


  - [ ] 6.6 Implement message history retrieval
    - Create GET /api/v1/messages/history endpoint
    - Add filters for date range, direction (inbound/outbound), status
    - Implement pagination
    - Return message list with content and metadata

    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 7. Implement webhook notification system
  - [ ] 7.1 Create webhook service for outgoing notifications
    - Implement sendWebhook function to POST events to user's webhook URL

    - Add HMAC-SHA256 signature generation for webhook security
    - Set timeout of 10 seconds for webhook requests
    - Store webhook delivery records in webhook_deliveries table
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [ ] 7.2 Implement webhook retry logic
    - Retry failed webhooks up to 3 times with exponential backoff (2s, 10s, 30s)

    - Update webhook delivery status and attempt count
    - Mark as failed after 3 unsuccessful attempts
    - _Requirements: 3.5_
  
  - [ ] 7.3 Implement webhook event types
    - Send message.received event for incoming messages
    - Send message.status event for delivery status updates


    - Send button.clicked event for button interactions
    - Include message content, sender, timestamp, and message ID in payload
    - _Requirements: 3.4, 6.4_

- [x] 8. Build billing and payment system


  - [ ] 8.1 Implement balance management
    - Create GET /api/v1/billing/balance endpoint to retrieve user balance
    - Implement balance deduction logic for message sending
    - Add balance validation before message operations
    - Return error 402 when balance is insufficient
    - Update balance in database and cache (Redis)
    - _Requirements: 4.1, 4.2, 4.3_

  
  - [ ] 8.2 Implement transaction tracking
    - Create transaction record for every balance change
    - Store balance_before and balance_after for audit trail
    - Implement GET /api/v1/billing/transactions endpoint with filters
    - Display transaction history in chronological order
    - _Requirements: 4.4, 4.5_
  
  - [x] 8.3 Implement payment integration with Stripe

    - Set up Stripe SDK and API keys
    - Create POST /api/v1/billing/topup endpoint
    - Implement Stripe payment intent creation
    - Handle Stripe webhook for payment confirmation
    - Update user balance on successful payment
    - Support EUR currency and SEPA payments
    - _Requirements: 4.4_
  
  - [ ] 8.4 Implement withdrawal functionality
    - Create POST /api/v1/billing/withdraw endpoint
    - Validate minimum withdrawal amount (100 EUR)
    - Validate sufficient balance
    - Create pending withdrawal transaction
    - Integrate with Stripe for payout to SEPA bank account
    - Send email notification on withdrawal completion
    - Apply 2% withdrawal fee
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 8.5 Implement message cost calculation
    - Create pricing configuration for different message types


    - Implement calculateMessageCost function
    - Apply costs: text (0.05 EUR), image (0.10 EUR), video (0.20 EUR), document (0.10 EUR), audio (0.10 EUR), interactive (0.15 EUR)
    - _Requirements: 4.2_

- [ ] 9. Implement statistics and analytics
  - [ ] 9.1 Create statistics tracking
    - Track message count, delivery rate, and costs per user and bot
    - Implement GET /api/v1/statistics/messages endpoint with date range filter


    - Aggregate statistics by day
    - Calculate delivery rate percentage
    - _Requirements: 7.1, 7.2, 7.3_
  

  - [ ] 9.2 Implement cost analytics
    - Create GET /api/v1/statistics/costs endpoint
    - Calculate total spending for selected period
    - Calculate average cost per message
    - Return data suitable for chart visualization
    - _Requirements: 7.4, 7.5_


- [ ] 10. Implement caching layer with Redis
  - Set up Redis connection and client
  - Implement API key validation cache with 1 hour TTL
  - Implement user balance cache with 5 minutes TTL
  - Implement rate limiting counters with 1 minute TTL
  - Implement message status cache with 24 hours TTL
  - Create cache invalidation logic for balance updates
  - _Requirements: 2.1, 4.1_

- [ ] 11. Implement rate limiting and security
  - [ ] 11.1 Add rate limiting middleware
    - Implement rate limiter using Redis
    - Set limit of 100 requests per minute per API key
    - Return 429 error when rate limit exceeded
    - _Requirements: 2.1_
  

  - [ ] 11.2 Implement security measures
    - Add CORS configuration
    - Implement request validation middleware
    - Add SQL injection prevention
    - Implement XSS protection headers


    - Add HTTPS/TLS enforcement
    - _Requirements: All requirements benefit from security_



- [ ] 12. Build API Gateway and routing
  - Create Express app with middleware setup
  - Implement centralized error handling middleware
  - Set up request logging with correlation IDs
  - Create route handlers for all endpoints
  - Add request/response validation using Joi or similar
  - Implement API versioning (v1)
  - _Requirements: All requirements_

- [ ] 13. Implement auto-response functionality
  - Process incoming messages through auto-response rules
  - Match keywords case-insensitively
  - Send configured response automatically within 2 seconds
  - Respect auto-response enabled/disabled setting per bot
  - Log auto-response actions
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 14. Set up monitoring and logging
  - Implement structured JSON logging
  - Add log levels (ERROR, WARN, INFO, DEBUG)
  - Create metrics collection for request rate, latency, error rate
  - Track message queue depth
  - Monitor database connection pool usage
  - Track Baileys connection health
  - Set up alerting for high error rates and connection failures
  - _Requirements: All requirements benefit from monitoring_

- [ ] 15. Create deployment configuration
  - Write Dockerfile for containerization
  - Create docker-compose.yml for local development
  - Set up environment variable templates
  - Create database initialization scripts
  - Write deployment documentation
  - Configure process manager (PM2) for production
  - _Requirements: All requirements_

- [ ] 16. Integration and end-to-end testing
  - [ ] 16.1 Test complete message flow
    - Test API request → Queue → Baileys → WhatsApp → Status update flow
    - Verify message delivery and status tracking
    - Test different message types (text, media, buttons)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ] 16.2 Test webhook delivery flow
    - Test incoming message → Processing → User webhook delivery
    - Verify webhook retry logic
    - Test webhook signature verification
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 16.3 Test payment and billing flow
    - Test top-up → Balance update → Transaction record
    - Test withdrawal flow
    - Verify balance deduction on message send
    - Test insufficient balance error handling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 16.4 Test bot lifecycle
    - Test bot creation → QR code generation → Connection → Message sending
    - Test bot disconnection and reconnection
    - Test multiple bots per user
    - Verify bot limit enforcement
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
