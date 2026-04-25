# Requirements Document

## Introduction

This document specifies requirements for fixing the QR code display issue in the WhatsApp bot connection flow. Currently, users experience a "Generating QR code..." message that never resolves, preventing them from connecting their bots to WhatsApp.

## Glossary

- **Frontend**: The React-based user interface application
- **Backend**: The Node.js/Express API server
- **QR Code**: Quick Response code used for WhatsApp bot authentication
- **WebSocket**: Real-time bidirectional communication channel between Frontend and Backend
- **Baileys Service**: Backend service managing WhatsApp connections via the Baileys library
- **useBotQR Hook**: React hook responsible for fetching and displaying QR codes

## Requirements

### Requirement 1: QR Code Polling

**User Story:** As a user, I want the system to automatically retry fetching the QR code if it's not immediately available, so that I don't get stuck on "Generating QR code..."

#### Acceptance Criteria

1. WHEN the user opens the reconnect modal, THE Frontend SHALL poll the QR code endpoint every 2 seconds until a QR code is received
2. WHILE polling for QR code, THE Frontend SHALL display a loading spinner with "Generating QR code..." message
3. WHEN a QR code is successfully received, THE Frontend SHALL stop polling and display the QR code
4. IF polling continues for more than 30 seconds without receiving a QR code, THEN THE Frontend SHALL display an error message and stop polling
5. WHEN the reconnect modal is closed, THE Frontend SHALL stop all active polling

### Requirement 2: WebSocket QR Code Delivery

**User Story:** As a user, I want to receive the QR code immediately when it's generated, so that I can connect my bot without delays

#### Acceptance Criteria

1. WHEN the Baileys Service generates a QR code, THE Backend SHALL emit the QR code via WebSocket to the user
2. WHEN the Frontend receives a QR code via WebSocket, THE Frontend SHALL immediately display it in the reconnect modal
3. WHEN the Frontend receives a QR code via WebSocket, THE Frontend SHALL stop any active polling
4. THE Backend SHALL log QR code emission events for debugging purposes
5. THE Frontend SHALL log QR code reception events for debugging purposes

### Requirement 3: Fallback HTTP Endpoint

**User Story:** As a user, I want the system to have a reliable fallback method to retrieve QR codes, so that I can connect my bot even if WebSocket fails

#### Acceptance Criteria

1. THE Backend SHALL store the latest QR code in the database for each bot
2. WHEN the Frontend requests a QR code via HTTP GET, THE Backend SHALL return the stored QR code if available
3. IF no QR code is available, THEN THE Backend SHALL return a 404 status with a descriptive message
4. THE Backend SHALL clear the stored QR code when the bot successfully connects
5. THE Backend SHALL update the stored QR code whenever a new QR code is generated

### Requirement 4: Error Handling and User Feedback

**User Story:** As a user, I want clear feedback about what's happening during the connection process, so that I know whether to wait or take action

#### Acceptance Criteria

1. WHEN QR code generation fails, THE Backend SHALL log the error with full context
2. WHEN QR code fetching fails on Frontend, THE Frontend SHALL display a user-friendly error message
3. IF the bot is already connected, THEN THE Frontend SHALL display a message indicating the bot is already connected
4. WHEN the connection process times out, THE Frontend SHALL provide an option to retry
5. THE Frontend SHALL display the current connection status (connecting, qr_required, connected) at all times

### Requirement 5: Connection State Synchronization

**User Story:** As a user, I want the UI to accurately reflect my bot's connection status, so that I know when my bot is ready to use

#### Acceptance Criteria

1. WHEN a bot's status changes, THE Backend SHALL emit the new status via WebSocket
2. WHEN the Frontend receives a status update, THE Frontend SHALL update the bot's status in the UI immediately
3. WHEN a bot connects successfully, THE Frontend SHALL close the reconnect modal automatically after 2 seconds
4. THE Frontend SHALL refresh the bot list when a bot's status changes
5. THE Frontend SHALL display appropriate badges for each connection status (connected, connecting, qr_required, disconnected)
