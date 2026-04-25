# Requirements Document

## Introduction

This feature addresses the issue where WhatsApp bots disconnect when the user closes the browser page or when the development server restarts. The system should maintain stable bot connections independent of frontend state and provide better development experience without constant reconnections.

## Glossary

- **Bot Connection**: An active WhatsApp session managed by the Baileys library
- **Development Server**: The Node.js backend server running in development mode
- **Nodemon**: A development tool that automatically restarts the server when file changes are detected
- **Session Persistence**: The ability to maintain WhatsApp authentication across server restarts
- **Connection Manager**: The BaileysConnectionManager service that manages bot connections
- **Worker Process**: A separate Node.js process dedicated to managing bot connections

## Requirements

### Requirement 1

**User Story:** As a developer, I want the bot connections to remain stable during development, so that I don't have to reconnect bots every time I make code changes

#### Acceptance Criteria

1. WHEN the developer modifies source code files, THE Development Server SHALL restart without disconnecting active bot connections
2. WHERE nodemon is used for development, THE Development Server SHALL use a separate worker process for bot connections
3. WHILE the developer is working on code, THE Bot Connection SHALL remain active in the worker process
4. WHEN the main API server restarts, THE Bot Connection SHALL continue functioning in the worker process

### Requirement 2

**User Story:** As a user, I want my bots to stay connected when I close the browser, so that they can continue receiving and sending messages

#### Acceptance Criteria

1. WHEN the user closes the browser tab, THE Bot Connection SHALL remain active on the server
2. WHEN the user reopens the browser, THE Bot Connection SHALL display the current connection status without requiring reconnection
3. THE Bot Connection SHALL persist independently of WebSocket connections
4. WHEN the user navigates away from the bot details page, THE Bot Connection SHALL continue processing messages

### Requirement 3

**User Story:** As a system administrator, I want bot connections to automatically restore after server restarts, so that service interruptions are minimized

#### Acceptance Criteria

1. WHEN the server starts, THE Connection Manager SHALL restore all previously connected bots from session files
2. WHERE session files exist for a bot, THE Connection Manager SHALL authenticate without requiring QR code scanning
3. IF session files are corrupted or missing, THEN THE Connection Manager SHALL mark the bot as requiring reconnection
4. THE Connection Manager SHALL log all connection restoration attempts with success or failure status

### Requirement 4

**User Story:** As a developer, I want clear separation between API and worker processes, so that I can develop and debug each component independently

#### Acceptance Criteria

1. THE Development Server SHALL support running in API-only mode without managing bot connections
2. THE Development Server SHALL support running in worker-only mode dedicated to bot connections
3. WHEN running in development mode, THE Development Server SHALL start both API and worker processes automatically
4. THE Development Server SHALL provide separate npm scripts for starting API and worker processes independently

### Requirement 5

**User Story:** As a developer, I want improved nodemon configuration, so that unnecessary restarts are avoided during development

#### Acceptance Criteria

1. THE Development Server SHALL ignore changes to session files when using nodemon
2. THE Development Server SHALL ignore changes to log files when using nodemon
3. THE Development Server SHALL ignore changes to temporary files when using nodemon
4. WHERE the worker process is running separately, THE Development Server SHALL only restart the API process on code changes

### Requirement 6

**User Story:** As a user, I want to see accurate bot connection status in real-time, so that I know when my bots are actually connected

#### Acceptance Criteria

1. WHEN a bot connects successfully, THE System SHALL emit a real-time status update to the user's browser
2. WHEN a bot disconnects, THE System SHALL emit a real-time status update to the user's browser
3. THE System SHALL update bot connection status in the database within 5 seconds of status changes
4. WHEN the user refreshes the page, THE System SHALL display the current bot connection status from the database
