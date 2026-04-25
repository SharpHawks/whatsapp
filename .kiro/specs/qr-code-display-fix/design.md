# Design Document: QR Code Display Fix

## Overview

This design addresses the QR code display issue by implementing a robust multi-layered approach:
1. **Polling mechanism** with exponential backoff for HTTP requests
2. **WebSocket real-time delivery** as the primary method
3. **Database persistence** for QR codes as a fallback
4. **Enhanced error handling** with user-friendly feedback

The solution ensures users can reliably connect their bots regardless of timing issues or WebSocket connectivity problems.

## Architecture

### High-Level Flow

```
User clicks "Reconnect" 
  → Frontend opens modal
  → Frontend starts polling /bots/:botId/qr
  → Backend initiates Baileys connection
  → Baileys generates QR code
  → Backend stores QR in DB + emits via WebSocket
  → Frontend receives QR (WebSocket or HTTP)
  → Frontend displays QR code
  → User scans QR
  → Backend detects connection
  → Backend emits status update via WebSocket
  → Frontend closes modal
```

### Component Interaction

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Frontend  │◄───────►│   Backend   │◄───────►│   Baileys   │
│  (React)    │ HTTP/WS │  (Express)  │         │   Service   │
└─────────────┘         └─────────────┘         └─────────────┘
       │                       │                        │
       │                       ▼                        │
       │                ┌─────────────┐                │
       │                │  PostgreSQL │                │
       │                │  (QR Store) │                │
       │                └─────────────┘                │
       │                                                │
       └────────────── WebSocket ─────────────────────┘
```

## Components and Interfaces

### 1. Frontend: useBotQR Hook (Modified)

**File:** `frontend/src/hooks/useBots.ts`

**Changes:**
- Add polling with `refetchInterval: 2000` (2 seconds)
- Add timeout logic (30 seconds max)
- Stop polling when QR code received or modal closed
- Integrate WebSocket updates to stop polling immediately

**Interface:**
```typescript
interface UseBotQROptions {
  enabled: boolean;
  onSuccess?: (qrCode: string) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
}

function useBotQR(botId: string, options?: UseBotQROptions): {
  qrCode: string | null;
  isLoading: boolean;
  error: Error | null;
  isTimeout: boolean;
}
```

**Key Logic:**
```typescript
// Start polling when modal opens
refetchInterval: (data) => {
  // Stop if QR received or timeout
  if (data?.qrCode || isTimeout) return false;
  return 2000; // Poll every 2 seconds
}

// Timeout after 30 seconds
useEffect(() => {
  const timer = setTimeout(() => {
    setIsTimeout(true);
  }, 30000);
  return () => clearTimeout(timer);
}, [botId]);

// Stop polling on WebSocket update
useEffect(() => {
  const handleQR = (event) => {
    if (event.detail.botId === botId) {
      queryClient.setQueryData(['bot-qr', botId], { 
        qrCode: event.detail.qrCode 
      });
      // Polling will stop automatically
    }
  };
  window.addEventListener('bot:qr', handleQR);
  return () => window.removeEventListener('bot:qr', handleQR);
}, [botId]);
```

### 2. Frontend: BotsPage Modal (Modified)

**File:** `frontend/src/pages/BotsPage.tsx`

**Changes:**
- Add timeout state and error handling
- Display retry button on timeout
- Show more detailed status messages
- Add cancel button to stop polling

**UI States:**
1. **Loading:** Spinner + "Generating QR code..."
2. **QR Ready:** Display QR code + instructions
3. **Timeout:** Error message + "Retry" button
4. **Error:** Error message + "Close" button
5. **Connected:** Success message (auto-close after 2s)

### 3. Backend: QR Code Storage

**File:** `src/services/baileys.service.ts`

**Changes:**
- Store QR code in database immediately when generated
- Clear QR code when bot connects
- Add logging for QR generation and emission

**Database Schema (existing):**
```sql
-- bots table already has qr_code column
ALTER TABLE bots 
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMP;
```

**Method:**
```typescript
private async updateBotQRCode(botId: string, qrCode: string): Promise<void> {
  await db.query(
    `UPDATE bots 
     SET qr_code = $1, 
         qr_generated_at = NOW(),
         connection_status = 'qr_required' 
     WHERE id = $2`,
    [qrCode, botId]
  );
  logger.info(`QR code stored for bot ${botId}`);
}
```

### 4. Backend: QR Code Endpoint (Modified)

**File:** `src/routes/bot.routes.ts`

**Current Implementation:** Already exists, no changes needed

**Behavior:**
- Returns QR code from database if available
- Returns 404 if not available
- Validates bot ownership

### 5. Backend: WebSocket Emission (Enhanced)

**File:** `src/services/baileys.service.ts`

**Changes:**
- Add more detailed logging
- Ensure QR emission happens immediately after generation
- Add error handling for WebSocket failures

**Enhanced Logic:**
```typescript
if (qr) {
  // Store in DB first
  await this.updateBotQRCode(botId, qr);
  
  // Then emit via WebSocket
  try {
    const { socketService } = await import('./services/socket.service');
    const userId = await this.getBotUserId(botId);
    if (userId) {
      socketService.emitBotQRCode(userId, botId, qr);
      logger.info(`QR code emitted via WebSocket for bot ${botId}`);
    } else {
      logger.warn(`Cannot emit QR: user not found for bot ${botId}`);
    }
  } catch (error) {
    logger.error(`Failed to emit QR via WebSocket:`, error);
    // QR is still in DB, HTTP polling will work
  }
  
  this.connectionStatus.set(botId, 'qr_required');
}
```

### 6. Backend: Connection Success Handler (Enhanced)

**File:** `src/services/baileys.service.ts`

**Changes:**
- Clear QR code from database when connected
- Emit connection status via WebSocket
- Update bot phone number

**Enhanced Logic:**
```typescript
if (connection === 'open') {
  logger.info(`Bot ${botId} connected successfully`);
  
  // Clear QR code
  await db.query(
    'UPDATE bots SET qr_code = NULL, qr_generated_at = NULL WHERE id = $1',
    [botId]
  );
  
  // Update status
  this.connectionStatus.set(botId, 'connected');
  await this.updateBotStatus(botId, 'connected');
  
  // Get and store phone number
  const phoneNumber = sock.user?.id?.split(':')[0];
  if (phoneNumber) {
    await this.updateBotPhoneNumber(botId, phoneNumber);
  }
  
  // Emit via WebSocket
  const { socketService } = await import('./services/socket.service');
  const userId = await this.getBotUserId(botId);
  if (userId) {
    socketService.emitBotStatus(userId, botId, 'connected', phoneNumber);
  }
}
```

## Data Models

### QR Code Data Flow

```typescript
// Backend stores
interface BotQRData {
  botId: string;
  qrCode: string;
  generatedAt: Date;
  status: 'qr_required';
}

// WebSocket emits
interface QRCodeEvent {
  botId: string;
  qrCode: string;
  timestamp: string;
}

// HTTP response
interface QRCodeResponse {
  qrCode: string;
  message: string;
}

// Frontend state
interface QRCodeState {
  qrCode: string | null;
  isLoading: boolean;
  error: Error | null;
  isTimeout: boolean;
}
```

## Error Handling

### Frontend Error States

1. **Network Error:** "Failed to connect. Please check your internet connection."
2. **Timeout:** "QR code generation timed out. Please try again."
3. **Bot Not Found:** "Bot not found. Please refresh the page."
4. **Already Connected:** "Bot is already connected."
5. **Unknown Error:** "An unexpected error occurred. Please try again."

### Backend Error Logging

```typescript
// Log levels
logger.info()   // Normal flow (QR generated, bot connected)
logger.warn()   // Recoverable issues (WebSocket emit failed, user not found)
logger.error()  // Critical errors (Baileys connection failed, DB error)
logger.debug()  // Detailed debugging (connection updates, event handlers)
```

### Error Recovery

| Error Scenario | Recovery Strategy |
|----------------|-------------------|
| WebSocket disconnected | HTTP polling continues |
| QR generation fails | User sees error, can retry |
| Timeout (30s) | User can click "Retry" button |
| Database error | Log error, return 500 to client |
| Bot already connected | Return 409, show message to user |

## Testing Strategy

### Unit Tests

1. **useBotQR Hook:**
   - Test polling starts when enabled
   - Test polling stops when QR received
   - Test timeout after 30 seconds
   - Test WebSocket update stops polling

2. **Baileys Service:**
   - Test QR code storage in database
   - Test QR code emission via WebSocket
   - Test QR code clearing on connection
   - Test error handling for WebSocket failures

### Integration Tests

1. **QR Code Flow:**
   - Create bot → Connect → Verify QR in DB
   - Request QR via HTTP → Verify response
   - Simulate WebSocket QR delivery → Verify frontend receives it
   - Simulate connection → Verify QR cleared

2. **Timeout Scenario:**
   - Start connection → Wait 30s → Verify timeout error
   - Click retry → Verify new polling starts

3. **WebSocket Fallback:**
   - Disconnect WebSocket → Start connection
   - Verify HTTP polling retrieves QR code

### Manual Testing Checklist

- [ ] Open reconnect modal → QR appears within 5 seconds
- [ ] Scan QR with WhatsApp → Bot connects → Modal closes
- [ ] Disconnect WebSocket → Reconnect bot → QR still appears
- [ ] Wait 30 seconds without scanning → Timeout error appears
- [ ] Click retry after timeout → New QR appears
- [ ] Close modal during QR generation → Polling stops
- [ ] Multiple tabs open → QR appears in all tabs

## Performance Considerations

### Polling Frequency

- **2 seconds** is chosen as a balance between responsiveness and server load
- With 100 concurrent users reconnecting, this generates 50 req/s (manageable)
- Polling stops immediately when QR received (via WebSocket or HTTP)

### Database Impact

- QR codes are small strings (~200 bytes)
- One UPDATE per QR generation
- One UPDATE per connection (to clear QR)
- Minimal impact on database performance

### WebSocket Scalability

- WebSocket events are targeted to specific users (room-based)
- No broadcast to all users
- Existing implementation already handles this efficiently

## Security Considerations

1. **QR Code Access:** Only bot owner can retrieve QR code (JWT auth + ownership check)
2. **QR Code Expiry:** QR codes expire after ~60 seconds (Baileys behavior)
3. **QR Code Cleanup:** QR codes cleared from DB after successful connection
4. **Rate Limiting:** Existing rate limiting applies to QR endpoint
5. **WebSocket Auth:** WebSocket connections require valid JWT token

## Deployment Notes

### Database Migration

No migration needed - `qr_code` column already exists in `bots` table.

Optional: Add index for faster QR lookups (if needed):
```sql
CREATE INDEX IF NOT EXISTS idx_bots_qr_code ON bots(id) WHERE qr_code IS NOT NULL;
```

### Backward Compatibility

- All changes are backward compatible
- Existing bots will work without changes
- No breaking API changes

### Rollback Plan

If issues occur:
1. Revert frontend changes (restore old `useBotQR` hook)
2. Backend changes are non-breaking, can remain
3. Monitor logs for errors

## Monitoring and Observability

### Key Metrics

1. **QR Generation Time:** Time from connect request to QR available
2. **QR Delivery Method:** WebSocket vs HTTP polling ratio
3. **Connection Success Rate:** % of QR scans that result in connection
4. **Timeout Rate:** % of connections that timeout

### Log Queries

```typescript
// QR generation
logger.info(`QR code generated for bot: ${botId}`)

// QR emission
logger.info(`QR code emitted via WebSocket for bot ${botId}`)

// QR retrieval
logger.debug(`QR code retrieved via HTTP for bot ${botId}`)

// Connection success
logger.info(`Bot ${botId} connected successfully`)

// Timeout
logger.warn(`QR code timeout for bot ${botId}`)
```

## Future Enhancements

1. **QR Code Refresh:** Auto-refresh QR if it expires before scanning
2. **Push Notifications:** Notify user when bot connects (mobile app)
3. **Connection History:** Track connection attempts and success rate
4. **Multi-Device Support:** Allow multiple devices to scan same QR
5. **QR Code Analytics:** Track time-to-scan, retry rates, etc.
