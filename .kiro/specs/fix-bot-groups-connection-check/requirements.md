# Requirements Document

## Introduction

This document specifies the requirements for fixing a bug where the `/api/v1/bots/{botId}/groups` endpoint returns "Bot is not connected" error even when the bot is actually connected and can send messages to contacts. The issue stems from inconsistent connection state checking between different service methods.

## Glossary

- **Bot Service**: The service layer that handles bot-related business logic and API operations
- **Worker Baileys Manager**: The service that manages WhatsApp socket connections and their lifecycle
- **Connection Map**: An in-memory Map structure that stores active bot connections and their status
- **Database Status**: The connection status stored in the PostgreSQL database for persistence
- **Socket Connection**: The active WhatsApp Web socket connection managed by Baileys library

## Requirements

### Requirement 1

**User Story:** As a user with a connected bot, I want to retrieve the list of groups my bot is a member of, so that I can send messages to those groups

#### Acceptance Criteria

1. WHEN the user requests groups for a bot that has an active socket connection, THE Bot Service SHALL return the list of groups successfully
2. WHEN the user requests groups for a bot that is truly disconnected, THE Bot Service SHALL return an appropriate error message
3. THE Worker Baileys Manager SHALL verify connection status by checking both the Connection Map and the actual socket state
4. IF the Connection Map shows a bot as connected but the socket is invalid, THEN THE Worker Baileys Manager SHALL return null and log the inconsistency
5. THE getGroups method SHALL succeed for any bot that can successfully send messages to contacts

### Requirement 2

**User Story:** As a system administrator, I want consistent connection state checking across all bot operations, so that users don't experience confusing errors

#### Acceptance Criteria

1. THE Worker Baileys Manager SHALL use the same connection validation logic for all operations (sending messages, getting groups, etc.)
2. WHEN checking connection status, THE Worker Baileys Manager SHALL verify that the socket object exists and is valid
3. THE getConnection method SHALL check both the Connection Map status and the socket validity
4. IF there is a mismatch between database status and Connection Map status, THE system SHALL log a warning with details
5. THE system SHALL handle connection state synchronization between database and in-memory storage

### Requirement 3

**User Story:** As a developer, I want clear error messages and logging, so that I can quickly diagnose connection issues

#### Acceptance Criteria

1. WHEN a connection check fails, THE system SHALL log the specific reason (missing from map, wrong status, invalid socket)
2. THE error messages returned to users SHALL clearly indicate whether the bot needs to reconnect or if it's a temporary issue
3. THE system SHALL log connection state mismatches at the warning level with bot ID and status details
4. WHEN getGroups succeeds after a connection check, THE system SHALL log the number of groups retrieved
5. THE logging SHALL include sufficient context to trace the request flow from API endpoint to socket operation
