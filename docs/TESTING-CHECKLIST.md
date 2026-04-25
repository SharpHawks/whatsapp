# Testing Checklist

## Pre-Launch Checklist

### 1. ✅ Required Services

Перед запуском убедитесь, что следующие сервисы запущены:

- [ ] **PostgreSQL** (порт 5432)
  ```bash
  # Проверка
  psql -U postgres -c "SELECT version();"
  ```

- [ ] **Redis** (порт 6379)
  ```bash
  # Проверка
  redis-cli ping
  # Должно вернуть: PONG
  ```

- [ ] **RabbitMQ** (порт 5672)
  ```bash
  # Проверка
  rabbitmqctl status
  ```

### 2. ✅ Environment Configuration

- [ ] Файл `.env` создан (скопировать из `.env.example`)
- [ ] Все обязательные переменные заполнены:
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - `REDIS_HOST`, `REDIS_PORT`
  - `RABBITMQ_URL`
  - `JWT_SECRET`

### 3. ✅ Database Setup

- [ ] База данных создана
  ```bash
  npm run db:init
  ```

- [ ] Миграции выполнены
  ```bash
  npm run migrate
  ```

### 4. ✅ Build

- [ ] Проект собран
  ```bash
  npm run build
  ```

---

## Launch Options

### Option 1: Development Mode (Recommended for Testing)

Запускает API и Worker в отдельных процессах:

```bash
npm run dev:full
```

**Плюсы:**
- Видны все логи в одном окне
- Легко остановить (Ctrl+C)
- Не требует PM2

**Минусы:**
- Не подходит для production
- Нет автоматического перезапуска

### Option 2: Separate Processes

Запустите в двух разных терминалах:

**Terminal 1 - API Server:**
```bash
npm run start:api
```

**Terminal 2 - Worker:**
```bash
npm run start:worker
```

### Option 3: PM2 (Production)

```bash
npm run pm2:start
```

Управление:
```bash
npm run pm2:logs      # Просмотр логов
npm run pm2:monit     # Мониторинг
npm run pm2:restart   # Перезапуск
npm run pm2:stop      # Остановка
```

---

## Testing Flow

### 1. ✅ Basic Health Check

После запуска проверьте:

```bash
# API Health
curl http://localhost:3000/health

# Должно вернуть:
# {"status":"ok","timestamp":"..."}
```

### 2. ✅ User Registration

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User"
  }'
```

Сохраните `token` из ответа.

### 3. ✅ Create Bot

```bash
curl -X POST http://localhost:3000/api/v1/bots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Bot",
    "webhookUrl": "https://example.com/webhook"
  }'
```

Сохраните `botId` из ответа.

### 4. ✅ Connect Bot

```bash
curl -X POST http://localhost:3000/api/v1/bots/BOT_ID/connect \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. ✅ Get QR Code

```bash
curl http://localhost:3000/api/v1/bots/BOT_ID/qr \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Ожидаемое поведение:**
- Worker получает событие `bot:connect`
- Worker создает Baileys подключение
- Генерируется QR код
- QR код сохраняется в Redis
- Публикуется событие `qr:generated`
- API возвращает QR код

### 6. ✅ Check Worker Status

```bash
curl http://localhost:3000/api/v1/admin/workers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Ожидаемое:**
```json
{
  "success": true,
  "data": {
    "workers": [
      {
        "workerId": "hostname-12345",
        "status": "active",
        "connectionCount": 1,
        "lastHeartbeat": "..."
      }
    ]
  }
}
```

### 7. ✅ Send Test Message

После сканирования QR кода:

```bash
curl -X POST http://localhost:3000/api/v1/messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "botId": "BOT_ID",
    "to": "+1234567890",
    "type": "text",
    "content": {
      "text": "Hello from WhatsApp API!"
    }
  }'
```

---

## Common Issues

### Issue: "Redis connection failed"

**Solution:**
1. Убедитесь, что Redis запущен
2. Проверьте `REDIS_HOST` и `REDIS_PORT` в `.env`
3. Попробуйте: `redis-cli ping`

### Issue: "Database connection failed"

**Solution:**
1. Убедитесь, что PostgreSQL запущен
2. Проверьте credentials в `.env`
3. Создайте базу данных: `createdb whatsapp_api`

### Issue: "RabbitMQ connection failed"

**Solution:**
1. Убедитесь, что RabbitMQ запущен
2. Проверьте `RABBITMQ_URL` в `.env`
3. Попробуйте: `rabbitmqctl status`

### Issue: "Worker not showing in admin panel"

**Solution:**
1. Проверьте, что worker запущен с `WORKER_ENABLED=true`
2. Проверьте логи worker: `npm run pm2:logs message-worker`
3. Проверьте Redis heartbeat: `redis-cli keys "worker:*:heartbeat"`

### Issue: "QR code not available"

**Solution:**
1. Проверьте логи worker
2. Убедитесь, что bot status = "connecting"
3. Проверьте Redis: `redis-cli get "qr:BOT_ID"`
4. QR код истекает через 60 секунд - попробуйте снова

---

## Logs Location

### Development Mode
- Все логи в консоли

### PM2 Mode
- API Server: `logs/api-server-out.log`, `logs/api-server-error.log`
- Worker: `logs/message-worker-out.log`, `logs/message-worker-error.log`

### View Logs
```bash
# All logs
npm run pm2:logs

# Specific process
pm2 logs api-server
pm2 logs message-worker

# Last 100 lines
pm2 logs --lines 100
```

---

## Success Criteria

✅ Система считается работающей, если:

1. API Server запускается без ошибок
2. Worker запускается и показывает heartbeat в admin panel
3. Можно создать бота
4. Можно инициировать подключение бота
5. Генерируется QR код
6. После сканирования QR кода статус меняется на "connected"
7. Можно отправить тестовое сообщение

---

## Next Steps After Testing

1. ✅ Если все работает - переходим к написанию автоматических тестов
2. ❌ Если есть проблемы - фиксим баги
3. 📝 Документируем найденные issues
