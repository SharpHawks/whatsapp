# Requirements Document - Auto API Key Generation

## Introduction

Implement automatic API key generation when a bot successfully connects to WhatsApp, and provide secure access to view the API key through the bot details page with password verification.

## Glossary

- **Bot**: A WhatsApp bot instance managed by the system
- **API Key**: A secret token used to authenticate API requests for sending messages
- **QR Code**: Quick Response code used to connect WhatsApp to the bot
- **Connection Status**: The current state of the bot's connection to WhatsApp (connecting, connected, disconnected, qr_required)
- **Password Verification**: Process of confirming user identity by requiring their account password

## Requirements

### Requirement 1: Automatic API Key Generation on Bot Connection

**User Story:** As a user, I want an API key to be automatically generated when my bot connects to WhatsApp, so that I can immediately start using the API without manual steps.

#### Acceptance Criteria

1. WHEN the Bot connection status changes to 'connected', THE System SHALL automatically generate a new API key for that Bot
2. WHEN an API key is generated, THE System SHALL associate the key with both the User and the Bot
3. IF an API key already exists for the Bot, THEN THE System SHALL reuse the existing key instead of creating a duplicate
4. WHEN the API key is generated, THE System SHALL store the hashed version in the database
5. WHEN the API key generation completes, THE System SHALL emit an event containing the plain-text key for one-time display

### Requirement 2: Display API Key After Connection

**User Story:** As a user, I want to see my API key immediately after my bot connects, so that I can copy it and start using the API right away.

#### Acceptance Criteria

1. WHEN the Bot status changes to 'connected', THE Frontend SHALL display the API key in place of the QR code
2. THE Frontend SHALL display the API key with a copy-to-clipboard button
3. THE Frontend SHALL show a warning message that the key will only be displayed once
4. THE Frontend SHALL provide a link to view the key later through bot details
5. WHEN the user navigates away from the page, THE Frontend SHALL clear the displayed API key from memory

### Requirement 3: Secure API Key Viewing in Bot Details

**User Story:** As a user, I want to view my bot's API key from the bot details page by entering my password, so that my API key remains secure even if someone accesses my computer.

#### Acceptance Criteria

1. WHEN the user clicks "View API Key" in the bot details page, THE System SHALL display a modal dialog
2. THE Modal SHALL contain a password input field
3. THE Modal SHALL contain "Show API Key" and "Cancel" buttons
4. WHEN the user enters their password and clicks "Show API Key", THE System SHALL verify the password against the user's account
5. IF the password is correct, THEN THE System SHALL retrieve and display the API key
6. IF the password is incorrect, THEN THE System SHALL display an error message and not reveal the key
7. THE System SHALL limit password verification attempts to 3 tries within 5 minutes
8. WHEN the API key is displayed, THE System SHALL provide a copy-to-clipboard button
9. WHEN the modal is closed, THE System SHALL clear the API key from memory

### Requirement 4: API Key Management in Bot Details

**User Story:** As a user, I want to manage my bot's API key from the bot details page, so that I can regenerate it if compromised or view its usage information.

#### Acceptance Criteria

1. THE Bot Details page SHALL display an "API Keys" tab
2. THE API Keys tab SHALL show the masked API key (e.g., "sk_****************************")
3. THE API Keys tab SHALL display the key creation date
4. THE API Keys tab SHALL display the last used date
5. THE API Keys tab SHALL provide a "View Full Key" button that triggers password verification
6. THE API Keys tab SHALL provide a "Regenerate Key" button with confirmation dialog
7. WHEN the user regenerates a key, THE System SHALL deactivate the old key and generate a new one
8. WHEN a key is regenerated, THE System SHALL display the new key once with a warning

### Requirement 5: Backend API Endpoints

**User Story:** As a developer, I want secure API endpoints for API key operations, so that the frontend can safely manage API keys.

#### Acceptance Criteria

1. THE System SHALL provide a POST endpoint `/api/v1/auth/verify-password` that accepts email and password
2. THE System SHALL provide a GET endpoint `/api/v1/bots/:botId/api-key` that returns the masked key information
3. THE System SHALL provide a POST endpoint `/api/v1/bots/:botId/api-key/reveal` that requires password verification
4. THE System SHALL provide a POST endpoint `/api/v1/bots/:botId/api-key/regenerate` that creates a new key
5. ALL endpoints SHALL require JWT authentication
6. ALL endpoints SHALL verify that the bot belongs to the authenticated user
7. THE reveal endpoint SHALL rate-limit password attempts to prevent brute force attacks

### Requirement 6: Security and Audit

**User Story:** As a system administrator, I want all API key operations to be logged and secured, so that I can audit access and prevent unauthorized use.

#### Acceptance Criteria

1. THE System SHALL log all API key generation events with timestamp and user ID
2. THE System SHALL log all API key viewing attempts (successful and failed)
3. THE System SHALL log all password verification attempts
4. THE System SHALL implement rate limiting on password verification (3 attempts per 5 minutes)
5. THE System SHALL never log or store plain-text API keys except during initial generation
6. THE System SHALL emit audit events for all API key operations
7. WHEN suspicious activity is detected (multiple failed attempts), THE System SHALL notify the user via email
