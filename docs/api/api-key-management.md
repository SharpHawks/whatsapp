# API Key Management Endpoints

This document describes the API key management endpoints for bot API keys.

## Overview

The API key management system allows users to:
- View masked API key information
- Reveal the full API key (with password verification)
- Regenerate API keys

## Security Features

- **Password Verification**: Revealing API keys requires password verification
- **Rate Limiting**: 3 failed password attempts per 5 minutes
- **Time-Limited Display**: API keys can only be revealed within 5 minutes of generation/regeneration
- **Audit Logging**: All API key operations are logged

## Endpoints

### 1. Get API Key Info (Masked)

Get information about a bot's API key without revealing the full key.

**Endpoint:** `GET /api/v1/bots/:botId/api-key`

**Authentication:** JWT Bearer Token (required)

**Parameters:**
- `botId` (path parameter): The ID of the bot

**Response:**
```json
{
  "id": "uuid",
  "maskedKey": "sk_********************************************************",
  "botId": "uuid",
  "isActive": true,
  "lastUsedAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Status Codes:**
- `200 OK`: API key info retrieved successfully
- `401 Unauthorized`: Invalid or missing JWT token
- `404 Not Found`: Bot not found or no API key exists

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/bots/123e4567-e89b-12d3-a456-426614174000/api-key" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2. Reveal API Key

Reveal the full API key after password verification. The key can only be revealed within 5 minutes of generation or regeneration.

**Endpoint:** `POST /api/v1/bots/:botId/api-key/reveal`

**Authentication:** JWT Bearer Token (required)

**Parameters:**
- `botId` (path parameter): The ID of the bot

**Request Body:**
```json
{
  "password": "your_account_password"
}
```

**Response:**
```json
{
  "key": "sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "expiresAt": "2024-01-15T10:35:00Z"
}
```

**Status Codes:**
- `200 OK`: API key revealed successfully
- `400 Bad Request`: API key expired (not in cache) or missing password
- `401 Unauthorized`: Invalid JWT token or incorrect password
- `404 Not Found`: Bot not found
- `429 Too Many Requests`: Rate limit exceeded (3 attempts per 5 minutes)

**Error Responses:**

*Incorrect Password:*
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid password"
  },
  "requestId": "uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

*Rate Limit Exceeded:*
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Too many attempts. Please try again in 5 minutes."
  },
  "requestId": "uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

*Key Expired:*
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "API key can only be viewed once after generation. Please regenerate to view again."
  },
  "requestId": "uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/v1/bots/123e4567-e89b-12d3-a456-426614174000/api-key/reveal" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "your_password"}'
```

---

### 3. Regenerate API Key

Generate a new API key for a bot. The old key will be deactivated immediately.

**Endpoint:** `POST /api/v1/bots/:botId/api-key/regenerate`

**Authentication:** JWT Bearer Token (required)

**Parameters:**
- `botId` (path parameter): The ID of the bot

**Request Body:** Empty `{}`

**Response:**
```json
{
  "message": "API key regenerated successfully",
  "key": "sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "expiresAt": "2024-01-15T10:35:00Z"
}
```

**Status Codes:**
- `200 OK`: API key regenerated successfully
- `401 Unauthorized`: Invalid or missing JWT token
- `404 Not Found`: Bot not found

**Example:**
```bash
curl -X POST "http://localhost:3000/api/v1/bots/123e4567-e89b-12d3-a456-426614174000/api-key/regenerate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Usage Flow

### Initial Setup (After Bot Connection)

1. Bot connects to WhatsApp
2. API key is automatically generated
3. Key is displayed once in the UI
4. Key is cached in Redis for 5 minutes

### Viewing API Key Later

1. User navigates to bot details page
2. User sees masked API key: `sk_********************************************************`
3. User clicks "View Full Key"
4. User enters password
5. System verifies password (rate limited)
6. If key is in cache (within 5 minutes), it's revealed
7. If key is not in cache, user must regenerate

### Regenerating API Key

1. User clicks "Regenerate Key"
2. System confirms action
3. Old key is deactivated
4. New key is generated and cached
5. New key is displayed once
6. User can reveal it again within 5 minutes

## Security Best Practices

1. **Store Keys Securely**: Never commit API keys to version control
2. **Use Environment Variables**: Store keys in environment variables or secure vaults
3. **Regenerate Compromised Keys**: If a key is exposed, regenerate immediately
4. **Monitor Usage**: Check the "Last Used" timestamp regularly
5. **Limit Access**: Only share keys with authorized team members

## Rate Limiting

Password verification is rate limited to prevent brute force attacks:
- **Limit**: 3 failed attempts
- **Window**: 5 minutes
- **Scope**: Per user account

After 3 failed attempts, the user must wait 5 minutes before trying again.

## Audit Logging

All API key operations are logged with the following information:
- User ID
- Bot ID
- Action (reveal, regenerate, verify_password)
- Timestamp
- Result (success/failure)
- Source (cache/database)

Logs can be reviewed for security audits and troubleshooting.

## Testing

Use the provided test script to verify the endpoints:

```bash
# Set test credentials
export TEST_EMAIL="your_test_email@example.com"
export TEST_PASSWORD="your_test_password"

# Run tests
node scripts/test-api-key-management.js
```

The test script will:
1. Login with test credentials
2. Get list of bots
3. Retrieve masked API key info
4. Test password verification (wrong password)
5. Attempt to reveal API key
6. Regenerate API key
7. Reveal regenerated key
8. Test rate limiting

## Troubleshooting

### "API key can only be viewed once after generation"

This error occurs when trying to reveal an API key that's not in the Redis cache (older than 5 minutes).

**Solution**: Regenerate the API key to view it again.

### "Too many attempts. Please try again in 5 minutes"

This error occurs after 3 failed password verification attempts.

**Solution**: Wait 5 minutes and try again with the correct password.

### "Bot not found"

This error occurs when the bot doesn't exist or doesn't belong to the user.

**Solution**: Verify the bot ID and ensure you have access to the bot.

## Implementation Notes

- API keys are stored as SHA-256 hashes in the database
- Plain text keys are only stored in Redis with a 5-minute TTL
- Keys are never logged in plain text
- All endpoints verify bot ownership before performing operations
