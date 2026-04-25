# API Key Management Endpoints - Quick Reference

## Endpoints

### 1. Get API Key Info (Masked) ✅
```
GET /api/v1/bots/:botId/api-key
Authorization: Bearer {JWT_TOKEN}
```

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

---

### 2. Reveal API Key (Password Required) 🔐
```
POST /api/v1/bots/:botId/api-key/reveal
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "password": "your_password"
}
```

**Response:**
```json
{
  "key": "sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "expiresAt": "2024-01-15T10:35:00Z"
}
```

**Errors:**
- `401` - Invalid password or rate limit exceeded
- `400` - Key expired (not in cache, older than 5 minutes)

---

### 3. Regenerate API Key 🔄
```
POST /api/v1/bots/:botId/api-key/regenerate
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{}
```

**Response:**
```json
{
  "message": "API key regenerated successfully",
  "key": "sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "expiresAt": "2024-01-15T10:35:00Z"
}
```

---

## cURL Examples

### Get Masked Key Info
```bash
curl -X GET "http://localhost:3000/api/v1/bots/{BOT_ID}/api-key" \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

### Reveal Full Key
```bash
curl -X POST "http://localhost:3000/api/v1/bots/{BOT_ID}/api-key/reveal" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"password": "your_password"}'
```

### Regenerate Key
```bash
curl -X POST "http://localhost:3000/api/v1/bots/{BOT_ID}/api-key/regenerate" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Security Notes

- **Rate Limiting**: 3 failed password attempts per 5 minutes
- **Cache Window**: Keys can only be revealed within 5 minutes of generation/regeneration
- **Audit Logging**: All operations are logged
- **Bot Ownership**: All endpoints verify bot belongs to authenticated user

---

## Testing

Run the test script:
```bash
export TEST_EMAIL="your_email@example.com"
export TEST_PASSWORD="your_password"
node scripts/test-api-key-management.js
```

---

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid password` | Wrong password entered | Use correct password |
| `Too many attempts` | 3+ failed password attempts | Wait 5 minutes |
| `API key can only be viewed once` | Key not in cache (>5 min old) | Regenerate the key |
| `Bot not found` | Invalid bot ID or no access | Check bot ID and ownership |

---

## Implementation Files

- **Routes**: `src/routes/bot.routes.ts`
- **Service**: `src/services/auth.service.ts`
- **Tests**: `scripts/test-api-key-management.js`
- **Docs**: `docs/api/api-key-management.md`
