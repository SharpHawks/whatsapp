# Design Document

## Overview

This document outlines the technical design for fixing the bug where the `/api/v1/bots/{botId}/groups` endpoint incorrectly returns "Bot is not connected" error even when the bot is connected and functional. The root cause is that the `getConnection()` method in `WorkerBaileysManager` performs a strict status check against the in-memory `connections` Map, which may not accurately reflect the actual socket connection state.

The fix will improve connection validation logic to be more robust and consistent across all bot operations.

## Problem Analysis

### Current Flow

1. User calls `GET /api/v1/bots/{botId}/groups`
2. `bot.routes.ts` → `botService.getBotGroups()`
3. `botService.getBotGroups()` → `workerBaileysManager.getGroups()`
4. `workerBaileysManager.getGroups()` → `this.getConnection(botId)`
5. `getConnection()` checks:
   - If `botId` exists in `connections` Map
   - If `connInfo.status === 'connected'`
6. Returns `null` if either check fails
7. `getGroups()` throws "Bot is not connected" error

### Root Cause

The `connections` Map status may be out of sync with the actual socket state due to:
- Race conditions during connection establishment
- Delayed status updates
- Worker process restarts
- Redis state vs in-memory state mismatch

Meanwhile, message sending works because it may use a different code path or has more lenient connection checking.

## Architecture

### Component Interaction

```
┌─────────────────┐
│  API Endpoint   │
│  /bots/:id/     │
│     groups      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Bot Service   │
│  getBotGroups() │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Worker Baileys Manager  │
│   getGroups()           │
│        │                │
│        ▼                │
│   getConnection()       │  ◄── FIX HERE
│        │                │
│        ▼                │
│  Validate Socket        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│  Baileys Socket │
│ groupFetchAll   │
│  Participating  │
└─────────────────┘
```

## Solution Design

### Enhanced Connection Validation

Improve the `getConnection()` method to perform multi-level validation:

1. **Check connections Map** - Does the bot exist in memory?
2. **Check status field** - Is the status 'connected'?
3. **Validate socket object** - Is the socket still valid and usable?
4. **Check socket state** - Does the socket have an active connection?

### Implementation Strategy

#### 1. Enhanced `getConnection()` Method

```typescript
async getConnection(botId: string): Promise<WASocket | null> {
  const connInfo = this.connections.get(botId);
  
  // Level 1: Check if connection exists in map
  if (!connInfo) {
    logger.debug(`No connection found in map for bot ${botId}`);
    return null;
  }

  // Level 2: Check status field
  if (connInfo.status !== 'connected') {
    logger.warn(`Connection for bot ${botId} has status: ${connInfo.status}`);
    return null;
  }

  // Level 3: Validate socket object exists
  if (!connInfo.socket) {
    logger.error(`Socket object is null for bot ${botId} despite connected status`);
    // Clean up inconsistent state
    this.connections.delete(botId);
    await this.updateConnectionStatus(botId, 'disconnected');
    return null;
  }

  // Level 4: Check socket connection state
  // The socket.user property is set when authenticated
  if (!connInfo.socket.user) {
    logger.warn(`Socket for bot ${botId} is not authenticated (no user info)`);
    // Update status to reflect reality
    this.updateConnectionInfo(botId, { status: 'connecting' });
    await this.updateConnectionStatus(botId, 'connecting');
    return null;
  }

  // All checks passed - socket is valid and connected
  return connInfo.socket;
}
```

#### 2. Add Socket Validation Helper

Create a dedicated method to check socket validity:

```typescript
/**
 * Validate if a socket is in a usable state
 */
private isSocketValid(socket: WASocket): boolean {
  try {
    // Check if socket has user info (authenticated)
    if (!socket.user) {
      return false;
    }

    // Check if socket has required methods
    if (typeof socket.groupFetchAllParticipating !== 'function') {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error validating socket:', error);
    return false;
  }
}
```

#### 3. Improve Error Messages

Update error handling in `getGroups()` to provide more context:

```typescript
async getGroups(botId: string): Promise<Array<{...}>> {
  try {
    logger.debug(`Getting groups for bot ${botId}`);

    const socket = await this.getConnection(botId);
    
    if (!socket) {
      // Check if bot exists in database
      const botExists = await this.checkBotExists(botId);
      
      if (!botExists) {
        throw new Error('Bot not found');
      }

      // Get current status from database
      const dbStatus = await this.getBotStatus(botId);
      
      throw new Error(
        `Bot is not connected. Current status: ${dbStatus}. ` +
        `Please ensure the bot is connected before fetching groups.`
      );
    }

    // Fetch groups...
  } catch (error) {
    logger.error(`Error getting groups for bot ${botId}:`, error);
    throw error;
  }
}
```

#### 4. Add Connection State Synchronization

Periodically sync in-memory state with database/Redis:

```typescript
/**
 * Sync connection state with database
 * Called periodically to ensure consistency
 */
private async syncConnectionState(botId: string): Promise<void> {
  try {
    const connInfo = this.connections.get(botId);
    const dbStatus = await this.getBotStatusFromDB(botId);
    
    // Check for mismatch
    if (connInfo && connInfo.status !== dbStatus) {
      logger.warn(
        `Connection state mismatch for bot ${botId}: ` +
        `memory=${connInfo.status}, db=${dbStatus}`
      );
      
      // Trust the in-memory state if socket is valid
      if (this.isSocketValid(connInfo.socket)) {
        await this.updateConnectionStatus(botId, connInfo.status);
      } else {
        // Socket is invalid, update memory to match DB
        this.updateConnectionInfo(botId, { status: dbStatus as any });
      }
    }
  } catch (error) {
    logger.error(`Error syncing connection state for bot ${botId}:`, error);
  }
}
```

## Data Models

### ConnectionInfo (Enhanced)

```typescript
interface ConnectionInfo {
  botId: string;
  socket: WASocket;
  status: 'connecting' | 'connected' | 'disconnected';
  lastHealthCheck: Date;
  processId: number;
  hostname: string;
  reconnectAttempts: number;
  // New fields
  lastValidated?: Date;  // Last time socket was validated
  socketValid?: boolean; // Cached validation result
}
```

### Connection Validation Result

```typescript
interface ConnectionValidationResult {
  isValid: boolean;
  reason?: string;
  checks: {
    existsInMap: boolean;
    hasCorrectStatus: boolean;
    socketExists: boolean;
    socketAuthenticated: boolean;
  };
}
```

## Error Handling

### Error Types

1. **Bot Not Found** - Bot doesn't exist in database
2. **Bot Not Connected** - Bot exists but has no active connection
3. **Socket Invalid** - Connection exists but socket is unusable
4. **State Mismatch** - In-memory and database states differ

### Error Response Format

```typescript
{
  error: {
    code: "BOT_NOT_CONNECTED",
    message: "Bot is not connected. Current status: connecting. Please wait for connection to complete.",
    details: {
      botId: "uuid",
      currentStatus: "connecting",
      lastSeen: "2025-11-13T09:00:00Z"
    }
  }
}
```

## Testing Strategy

### Unit Tests

1. Test `getConnection()` with various states:
   - Bot not in map
   - Bot with 'connecting' status
   - Bot with 'connected' status but null socket
   - Bot with valid socket but no user info
   - Bot with fully valid connection

2. Test `isSocketValid()` helper:
   - Socket with no user
   - Socket with user but missing methods
   - Valid socket

3. Test `getGroups()` error handling:
   - Bot not found
   - Bot not connected
   - Socket becomes invalid during operation

### Integration Tests

1. Test full flow from API endpoint to socket operation
2. Test with actual Baileys socket connections
3. Test state synchronization between database and memory
4. Test concurrent requests to same bot

### Manual Testing

1. Connect a bot successfully
2. Verify groups endpoint works
3. Simulate connection loss
4. Verify appropriate error message
5. Reconnect bot
6. Verify groups endpoint works again

## Logging Strategy

### Log Levels

- **DEBUG**: Connection validation steps, state checks
- **INFO**: Successful operations, state changes
- **WARN**: State mismatches, degraded connections
- **ERROR**: Failed operations, invalid states

### Key Log Points

1. Entry to `getConnection()` with botId
2. Each validation check result
3. State mismatches detected
4. Socket validation failures
5. Successful group fetches with count

### Example Log Output

```
[DEBUG] Getting groups for bot abc-123
[DEBUG] Checking connection for bot abc-123
[DEBUG] Connection found in map with status: connected
[DEBUG] Socket object exists and is valid
[DEBUG] Socket is authenticated with user: 1234567890
[INFO] Retrieved 15 groups for bot abc-123
```

## Performance Considerations

### Caching

- Groups are already cached with 5-minute TTL
- Socket validation results can be cached briefly (10-30 seconds)
- Avoid excessive database queries for status checks

### Optimization

- Validation checks are ordered by cost (cheapest first)
- Early return on first failed check
- Batch status updates when possible

## Rollout Plan

1. **Phase 1**: Deploy enhanced `getConnection()` method
2. **Phase 2**: Monitor logs for state mismatches
3. **Phase 3**: Add state synchronization if needed
4. **Phase 4**: Update error messages based on user feedback

## Monitoring

### Metrics to Track

- Connection validation success rate
- State mismatch frequency
- Groups endpoint error rate
- Average response time for groups endpoint

### Alerts

- High rate of "Bot not connected" errors
- Frequent state mismatches
- Socket validation failures

## Rollback Plan

If issues arise:
1. Revert `getConnection()` to original implementation
2. Add temporary logging to diagnose root cause
3. Implement fix with additional safeguards
4. Redeploy with enhanced monitoring
