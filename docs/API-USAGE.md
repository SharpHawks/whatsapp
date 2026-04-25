# API Usage Guide

This guide explains how to use the WhatsApp API platform after deployment.

## Base URL

Local development:

```bash
http://localhost:3000/api/v1
```

Production behind the frontend/nginx usually uses the same origin:

```bash
https://your-domain.com/api/v1
```

## 1. Create And Connect A Bot

1. Log in to the web dashboard.
2. Open **Bots**.
3. Create a bot.
4. Open the bot page and click **Connect**.
5. Scan the QR code with WhatsApp.
6. After the bot connects, the platform creates an API key for that bot.

## 2. View Your Bot API Key

Open the bot page, go to the **API** tab, and click **Show API Key**.

The system asks for your account password before revealing the key. You can reveal the same active key again later; it is stored encrypted at rest.

If a key was created before encrypted key storage was added, it cannot be recovered from the old hash-only record. Regenerate it once from the bot API tab, then future reveals will work.

## 3. Send A Text Message

Use the bot API key in the `X-API-Key` header.

```bash
curl -X POST "https://your-domain.com/api/v1/messages/send" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_your_bot_api_key" \
  -d '{
    "to": "+37120000000",
    "type": "text",
    "content": {
      "text": "Hello from the API"
    }
  }'
```

Successful response:

```json
{
  "message": "Message queued successfully",
  "messageId": "uuid",
  "status": "queued",
  "timestamp": "2026-04-24T20:00:00.000Z",
  "cost": 0.05
}
```

## 4. Send Media

Image by URL:

```bash
curl -X POST "https://your-domain.com/api/v1/messages/send" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_your_bot_api_key" \
  -d '{
    "to": "+37120000000",
    "type": "image",
    "content": {
      "mediaUrl": "https://example.com/image.jpg",
      "caption": "Image caption"
    }
  }'
```

Document by URL:

```bash
curl -X POST "https://your-domain.com/api/v1/messages/send" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_your_bot_api_key" \
  -d '{
    "to": "+37120000000",
    "type": "document",
    "content": {
      "mediaUrl": "https://example.com/file.pdf",
      "filename": "file.pdf"
    }
  }'
```

## 5. Check Message Status

```bash
curl "https://your-domain.com/api/v1/messages/your-message-id" \
  -H "X-API-Key: sk_your_bot_api_key"
```

## 6. Get Message History

```bash
curl "https://your-domain.com/api/v1/messages/history?limit=20&offset=0" \
  -H "X-API-Key: sk_your_bot_api_key"
```

Optional filters:

- `direction=inbound|outbound`
- `status=queued|sent|delivered|read|failed`
- `startDate=2026-04-01T00:00:00.000Z`
- `endDate=2026-04-30T23:59:59.999Z`
- `limit=20`
- `offset=0`

## 7. Webhooks

Each bot can have a webhook URL. Incoming messages and bot events are sent to that URL when webhook delivery is enabled by the backend workflow.

Recommended receiver behavior:

- Accept `POST`.
- Return `2xx` quickly.
- Verify your own shared secret if you expose the endpoint publicly.
- Process heavy work asynchronously.

Example receiver payload shape may include:

```json
{
  "event": "message.received",
  "botId": "uuid",
  "message": {
    "from": "+37120000000",
    "type": "text",
    "content": "Hello"
  }
}
```

## 8. Rebuild And Deploy

After code changes, rebuild containers:

```bash
docker compose build api-server message-worker frontend
docker compose up -d
```

Run migrations after backend changes that modify the database:

```bash
docker compose exec api-server node scripts/run-migrations.cjs
```

For this update on an existing database, run only the encrypted API key migration:

```bash
docker compose exec api-server node scripts/run-migrations.cjs 011
```

Check logs:

```bash
docker compose logs -f api-server
docker compose logs -f message-worker
docker compose logs -f frontend
```

## 9. Required Production Secrets

Set these in `.env` before deployment:

```bash
JWT_SECRET=...
JWT_REFRESH_SECRET=...
API_KEY_ENCRYPTION_SECRET=...
DB_PASSWORD=...
RABBITMQ_USER=whatsapp
RABBITMQ_PASSWORD=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

`API_KEY_ENCRYPTION_SECRET` must stay stable. If you rotate it, existing encrypted API keys cannot be revealed and must be regenerated.
