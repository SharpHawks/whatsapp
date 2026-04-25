# Design Document - Auto API Key Generation

## Overview

This design implements automatic API key generation when a bot connects to WhatsApp, with secure viewing through password verification. The system ensures that users can immediately use their bot's API while maintaining security through password-protected access to view the full key.

## Architecture

### High-Level Flow

```
Bot Connection → API Key Generation → Display Key → Secure Storage
                                    ↓
User Views Key ← Password Verification ← Bot Details Page
```

### Components

1. **Backend Services**
   - `auth.service.ts` - API key generation and verification
   - `bot.service.ts` - Bot connection handling
   - `worker-baileys.manager.ts` - WhatsApp connection events

2. **Backend Routes**
   - `auth.routes.ts` - Password verification endpoint
   - `bot.routes.ts` - API key management endpoints

3. **Frontend Components**
   - `BotDetailsPage.tsx` - API key display and management
   - `ApiKeyModal.tsx` - Password verification modal (new)
   - `ApiKeyDisplay.tsx` - Secure key display component (new)

4. **Real-time Communication**
   - WebSocket events for API key generation notification
   - Redis pub/sub for cross-process communication

## Components and Interfaces

### Backend Interfaces

```typescript
// API Key with plain text (only used during generation)
interface ApiKeyWithPlainText {
  id: string;
  key: string; // Plain text, only available once
  botId: string;
  userId: string;
  createdAt: Date;
}

// API Key Info (for display)
interface ApiKeyInfo {
  id: string;
  maskedKey: string; // e.g., "sk_****************************"
  botId: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

// Password Verification Request
interface PasswordVerificationRequest {
  password: string;
}

// Password Verification Response
interface PasswordVerificationResponse {
  valid: boolean;
  userId?: string;
}

// API Key Reveal Request
interface ApiKeyRevealRequest {
  password: string;
}

// API Key Reveal Response
interface ApiKeyRevealResponse {
  key: string;
  expiresAt: Date; // When this response expires (5 minutes)
}
```

### Frontend Interfaces

```typescript
// API Key Display Props
interface ApiKeyDisplayProps {
  apiKey: string;
  onClose: () => void;
  showWarning?: boolean;
}

// API Key Modal Props
interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  botId: string;
  onSuccess: (apiKey: string) => void;
}

// Bot with API Key
interface BotWithApiKey extends Bot {
  apiKey?: ApiKeyInfo;
  hasApiKey: boolean;
}
```

## Data Models

### Database Schema Changes

No schema changes needed - existing `api_keys` table already supports all requirements:

```sql
-- Existing table structure
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Redis Cache Structure

```typescript
// Rate limiting for password verification
key: `password_attempts:${userId}`
value: number (attempt count)
ttl: 300 seconds (5 minutes)

// Temporary API key display (after generation)
key: `api_key_display:${botId}`
value: string (plain text key)
ttl: 300 seconds (5 minutes)
```

## Implementation Details

### 1. Automatic API Key Generation

**Location:** `src/services/worker-baileys.manager.ts`

```typescript
// In the connection.update handler, when status becomes 'connected'
private async handleConnectionOpen(botId: string, phoneNumber: string) {
  // ... existing connection logic ...
  
  // Generate API key if it doesn't exist
  const userId = await this.getBotUserId(botId);
  if (userId) {
    const apiKey = await this.ensureApiKey(userId, botId);
    
    // Store in Redis for one-time display (5 minutes)
    await redis.setex(`api_key_display:${botId}`, 300, apiKey);
    
    // Emit event with API key
    socketService.emitApiKeyGenerated(userId, botId, apiKey);
    
    logger.info(`API key generated for bot ${botId}`);
  }
}

private async ensureApiKey(userId: string, botId: string): Promise<string> {
  // Check if API key already exists
  const existing = await db.query(
    'SELECT id FROM api_keys WHERE bot_id = $1 AND is_active = true',
    [botId]
  );
  
  if (existing.rows.length > 0) {
    // Key exists, retrieve it from Redis if available
    const cached = await redis.get(`api_key_display:${botId}`);
    if (cached) return cached;
    
    // If not in cache, return masked version (shouldn't happen in normal flow)
    return 'sk_****************************';
  }
  
  // Generate new API key
  return await authService.generateApiKey(userId, botId);
}
```

### 2. Display API Key After Connection

**Location:** `frontend/src/pages/BotsPage.tsx` or `BotDetailsPage.tsx`

```typescript
// Listen for API key generation event
useEffect(() => {
  const handleApiKeyGenerated = (event: CustomEvent) => {
    const { botId, apiKey } = event.detail;
    
    if (botId === currentBotId) {
      // Show API key modal
      setGeneratedApiKey(apiKey);
      setShowApiKeyModal(true);
    }
  };
  
  window.addEventListener('bot:apikey:generated', handleApiKeyGenerated);
  return () => window.removeEventListener('bot:apikey:generated', handleApiKeyGenerated);
}, [currentBotId]);

// Replace QR code with API key display
{bot.status === 'connected' && generatedApiKey && (
  <ApiKeyDisplay
    apiKey={generatedApiKey}
    onClose={() => {
      setGeneratedApiKey(null);
      setShowApiKeyModal(false);
    }}
    showWarning={true}
  />
)}
```

### 3. Password Verification Endpoint

**Location:** `src/routes/auth.routes.ts`

```typescript
// POST /api/v1/auth/verify-password
router.post('/verify-password', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    const userId = req.userId!;
    
    // Rate limiting check
    const attempts = await redis.get(`password_attempts:${userId}`);
    if (attempts && parseInt(attempts) >= 3) {
      throw new AuthorizationError('Too many attempts. Please try again in 5 minutes.');
    }
    
    // Verify password
    const user = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    const isValid = await bcrypt.compare(password, user.rows[0].password_hash);
    
    if (!isValid) {
      // Increment attempts
      await redis.incr(`password_attempts:${userId}`);
      await redis.expire(`password_attempts:${userId}`, 300);
      
      throw new AuthenticationError('Invalid password');
    }
    
    // Clear attempts on success
    await redis.del(`password_attempts:${userId}`);
    
    res.json({ valid: true, userId });
  } catch (error) {
    next(error);
  }
});
```

### 4. API Key Reveal Endpoint

**Location:** `src/routes/bot.routes.ts`

```typescript
// POST /api/v1/bots/:botId/api-key/reveal
router.post('/:botId/api-key/reveal', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { botId } = req.params;
    const { password } = req.body;
    const userId = req.userId!;
    
    // Verify bot ownership
    await botService.getBot(botId, userId);
    
    // Verify password
    const verifyResponse = await axios.post('/api/v1/auth/verify-password', 
      { password },
      { headers: { Authorization: req.headers.authorization } }
    );
    
    if (!verifyResponse.data.valid) {
      throw new AuthenticationError('Invalid password');
    }
    
    // Get API key
    const result = await db.query(
      `SELECT ak.id, ak.key_hash
       FROM api_keys ak
       WHERE ak.bot_id = $1 AND ak.user_id = $2 AND ak.is_active = true
       ORDER BY ak.created_at DESC
       LIMIT 1`,
      [botId, userId]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('API key not found');
    }
    
    // Check Redis cache first
    const cached = await redis.get(`api_key_display:${botId}`);
    if (cached) {
      return res.json({ key: cached });
    }
    
    // If not in cache, we can't reveal the key
    // (it was only stored during generation)
    throw new ValidationError('API key can only be viewed once after generation. Please regenerate to view again.');
    
  } catch (error) {
    next(error);
  }
});
```

### 5. API Key Regeneration

**Location:** `src/routes/bot.routes.ts`

```typescript
// POST /api/v1/bots/:botId/api-key/regenerate
router.post('/:botId/api-key/regenerate', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { botId } = req.params;
    const userId = req.userId!;
    
    // Verify bot ownership
    await botService.getBot(botId, userId);
    
    // Regenerate API key
    const newApiKey = await authService.regenerateApiKey(userId, botId);
    
    // Store in Redis for one-time display
    await redis.setex(`api_key_display:${botId}`, 300, newApiKey);
    
    // Log the operation
    logger.info(`API key regenerated for bot ${botId} by user ${userId}`);
    
    res.json({
      message: 'API key regenerated successfully',
      apiKey: newApiKey,
      expiresAt: new Date(Date.now() + 300000) // 5 minutes
    });
  } catch (error) {
    next(error);
  }
});
```

### 6. Frontend Components

#### ApiKeyModal Component

**Location:** `frontend/src/components/bots/ApiKeyModal.tsx`

```typescript
interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  botId: string;
  onSuccess: (apiKey: string) => void;
}

export default function ApiKeyModal({ isOpen, onClose, botId, onSuccess }: ApiKeyModalProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleReveal = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await api.post(`/bots/${botId}/api-key/reveal`, { password });
      onSuccess(response.data.key);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to reveal API key');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Enter Password to View API Key</h3>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          error={error}
        />
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleReveal} isLoading={isLoading}>
            Show API Key
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

#### ApiKeyDisplay Component

**Location:** `frontend/src/components/bots/ApiKeyDisplay.tsx`

```typescript
interface ApiKeyDisplayProps {
  apiKey: string;
  onClose: () => void;
  showWarning?: boolean;
}

export default function ApiKeyDisplay({ apiKey, onClose, showWarning = false }: ApiKeyDisplayProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success('API key copied to clipboard!');
  };
  
  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Your API Key</h3>
        
        {showWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
            <p className="text-sm text-amber-800">
              ⚠️ This key will only be shown once. Please copy it now and store it securely.
            </p>
          </div>
        )}
        
        <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm break-all mb-4">
          {apiKey}
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={copyToClipboard}>
            <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Card>
  );
}
```

## Error Handling

### Error Scenarios

1. **Password Verification Failed**
   - Status: 401 Unauthorized
   - Message: "Invalid password"
   - Action: Increment rate limit counter

2. **Too Many Attempts**
   - Status: 429 Too Many Requests
   - Message: "Too many attempts. Please try again in 5 minutes."
   - Action: Block further attempts

3. **API Key Not Found**
   - Status: 404 Not Found
   - Message: "API key not found for this bot"
   - Action: Suggest regenerating key

4. **API Key Already Expired**
   - Status: 410 Gone
   - Message: "API key can only be viewed once after generation. Please regenerate to view again."
   - Action: Provide regenerate button

5. **Bot Not Found**
   - Status: 404 Not Found
   - Message: "Bot not found"
   - Action: Redirect to bots list

## Testing Strategy

### Unit Tests

1. **authService.generateApiKey()**
   - Test key generation format
   - Test key uniqueness
   - Test database storage

2. **authService.regenerateApiKey()**
   - Test old key deactivation
   - Test new key generation
   - Test user/bot association

3. **Password verification**
   - Test correct password
   - Test incorrect password
   - Test rate limiting

### Integration Tests

1. **Bot connection flow**
   - Create bot → Connect → Verify API key generated
   - Test WebSocket event emission
   - Test Redis caching

2. **API key reveal flow**
   - Request reveal → Verify password → Receive key
   - Test rate limiting
   - Test expiration

3. **API key regeneration**
   - Regenerate → Old key deactivated → New key active
   - Test API calls with old key (should fail)
   - Test API calls with new key (should succeed)

### E2E Tests

1. **Complete user flow**
   - Register → Create bot → Scan QR → See API key → Copy key
   - Navigate away → Return → View key with password
   - Regenerate key → Verify old key doesn't work

## Security Considerations

1. **Password Verification**
   - Rate limiting: 3 attempts per 5 minutes
   - No password hints or recovery in this flow
   - Audit logging of all attempts

2. **API Key Storage**
   - Only hashed keys stored in database
   - Plain text keys only in Redis with 5-minute TTL
   - Keys cleared from memory after display

3. **API Key Transmission**
   - Always over HTTPS in production
   - Never logged in plain text
   - Masked in UI by default

4. **Rate Limiting**
   - Password verification: 3/5min per user
   - API key reveal: 5/hour per bot
   - API key regeneration: 3/hour per bot

5. **Audit Trail**
   - Log all API key operations
   - Log all password verification attempts
   - Alert on suspicious patterns

## Performance Considerations

1. **Redis Caching**
   - API keys cached for 5 minutes after generation
   - Reduces database queries
   - Automatic expiration

2. **WebSocket Events**
   - Real-time notification of API key generation
   - No polling required
   - Efficient cross-tab communication

3. **Database Queries**
   - Indexed on `bot_id` and `user_id`
   - Single query for key retrieval
   - Batch deactivation on regeneration

## Deployment Notes

1. **Environment Variables**
   - No new variables required
   - Uses existing JWT and Redis configuration

2. **Database Migrations**
   - No schema changes needed
   - Existing `api_keys` table sufficient

3. **Redis Requirements**
   - Ensure Redis is available
   - Configure appropriate memory limits
   - Set up key expiration policies

4. **Monitoring**
   - Monitor rate limit hits
   - Track API key generation rate
   - Alert on failed password attempts
