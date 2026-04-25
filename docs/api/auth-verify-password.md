# Password Verification Endpoint

## Overview

The password verification endpoint allows authenticated users to verify their password. This is used for sensitive operations like viewing API keys.

## Endpoint

```
POST /api/v1/auth/verify-password
```

## Authentication

Requires JWT authentication via `Authorization: Bearer <token>` header.

## Request Body

```json
{
  "password": "string (required)"
}
```

## Response

### Success (200 OK)

```json
{
  "valid": true,
  "userId": "uuid"
}
```

### Error Responses

#### Invalid Password (401 Unauthorized)

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid password"
  }
}
```

#### Rate Limited (401 Unauthorized)

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Too many attempts. Please try again in 5 minutes."
  }
}
```

## Rate Limiting

- Maximum 3 failed attempts per 5 minutes per user
- Counter resets on successful verification
- Counter expires after 5 minutes

## Audit Logging

All password verification attempts are logged with:
- User ID
- Timestamp
- Result (success/failure)
- Attempt count (for failures)

## Security Features

1. **Rate Limiting**: Prevents brute force attacks
2. **Audit Logging**: All attempts are logged for security monitoring
3. **JWT Authentication**: Only authenticated users can verify passwords
4. **No Password Hints**: Error messages don't reveal password information

## Example Usage

```javascript
const response = await fetch('/api/v1/auth/verify-password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    password: 'userPassword123'
  })
});

const data = await response.json();
if (data.valid) {
  console.log('Password verified successfully');
}
```

## Testing

Use the provided test script:

```bash
node scripts/test-verify-password.js <email> <password>
```

This will test:
1. Correct password verification
2. Incorrect password rejection
3. Rate limiting after 3 failed attempts
