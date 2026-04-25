# WhatsApp API Monetization Platform

Платформа для монетизации WhatsApp API с использованием Baileys, построенная на Node.js, Express, PostgreSQL, Redis и React.

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- Docker и Docker Compose
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3+

### Локальная разработка

```bash
# Установка зависимостей
npm install
cd frontend && npm install && cd ..

# Запуск БД и сервисов
docker-compose up -d postgres redis rabbitmq

# Миграции
npm run migrate

# Запуск в dev режиме
npm run dev
```

### Production развертывание

См. **[DEPLOYMENT.md](DEPLOYMENT.md)** для полной инструкции по развертыванию на сервер.

### Использование API

См. **[docs/API-USAGE.md](docs/API-USAGE.md)** для получения API ключа, отправки сообщений, просмотра истории и пересборки Docker-стека.

## 📋 Основные возможности

- ✅ Аутентификация (JWT + Refresh tokens)
- ✅ Управление ботами WhatsApp
- ✅ Отправка сообщений (текст, изображения, видео, документы)
- ✅ Автоответчики
- ✅ Монетизация (Stripe интеграция)
- ✅ Квоты и лимиты
- ✅ Rate limiting
- ✅ WebSocket (Socket.IO) для real-time обновлений
- ✅ Админ панель
- ✅ API документация

## 🔐 Безопасность

- Сильные пароли (8+ символов, заглавные, строчные, цифры, спецсимволы)
- JWT токены с автоматическим обновлением
- Rate limiting (100 запросов/минуту)
- Login rate limiting (5 попыток/15 минут, блокировка на 15 минут)
- CORS настроен
- Security headers (HSTS, CSP, X-Frame-Options)
- Input validation и sanitization
- SQL injection защита
- XSS защита

См. **[SECURITY.md](SECURITY.md)** для деталей.

## 📁 Структура проекта

```
.
├── src/                    # Backend код
│   ├── routes/            # API маршруты
│   ├── services/          # Бизнес логика
│   ├── middleware/        # Middleware
│   ├── workers/           # Background workers
│   └── utils/             # Утилиты
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/   # React компоненты
│   │   ├── pages/        # Страницы
│   │   ├── hooks/        # Custom hooks
│   │   └── services/     # API сервисы
├── migrations/            # SQL миграции
├── scripts/               # Утилиты и скрипты
└── docker-compose.yml     # Docker конфигурация
```

## 🔧 Конфигурация

### Переменные окружения

Создайте `.env` файл на основе `.env.example`:

```bash
# Генерация секретов
node scripts/generate-secrets.js

# Создание .env
cp .env.example .env
# Отредактируйте .env и вставьте сгенерированные секреты
```

### Основные настройки

- `NODE_ENV` - Окружение (development/production)
- `PORT` - Порт API сервера (по умолчанию 3000)
- `DB_*` - Настройки PostgreSQL
- `REDIS_*` - Настройки Redis
- `JWT_SECRET` - Секрет для JWT токенов
- `CORS_ORIGINS` - Разрешенные домены для CORS

См. `.env.example` для полного списка.

## 📚 API Документация

### Аутентификация

```bash
# Регистрация
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}

# Вход
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}

# Обновление токена
POST /api/v1/auth/refresh
{
  "refreshToken": "your_refresh_token"
}
```

### Боты

```bash
# Создать бота
POST /api/v1/bots
Authorization: Bearer {token}
{
  "name": "My Bot"
}

# Получить QR код
GET /api/v1/bots/:botId/qr
Authorization: Bearer {token}

# Список ботов
GET /api/v1/bots
Authorization: Bearer {token}
```

### Сообщения

```bash
# Отправить сообщение
POST /api/v1/messages/send
Authorization: Bearer {token}
{
  "botId": "bot-uuid",
  "to": "1234567890",
  "message": "Hello!"
}

# Отправить с API ключом
POST /api/v1/messages/send
X-API-Key: your_api_key
{
  "to": "1234567890",
  "message": "Hello!"
}
```

## 🛠️ Разработка

### Запуск в dev режиме

```bash
# API + Worker
npm run dev

# Только API
npm run dev:api

# Только Worker
npm run dev:worker

# Frontend
cd frontend && npm run dev
```

### Тестирование

```bash
# Проверка типов
npm run build

# Линтинг
npm run lint

# Форматирование
npm run format
```

### Миграции БД

```bash
# Запуск миграций
npm run migrate

# Создание новой миграции
# Добавьте файл в migrations/ с именем XXX_description.sql
```

## 📦 Production

### Docker Compose

```bash
# Запуск всех сервисов
docker-compose up -d --build

# Проверка статуса
docker-compose ps

# Логи
docker-compose logs -f

# Остановка
docker-compose down
```

### PM2 (альтернатива)

```bash
# Запуск с PM2
npm run pm2:start

# Логи
npm run pm2:logs

# Мониторинг
npm run pm2:monit

# Остановка
npm run pm2:stop
```

## 🔄 Обновление

```bash
# Получить последние изменения
git pull

# Обновить зависимости
npm install
cd frontend && npm install && cd ..

# Пересобрать и перезапустить
docker-compose up -d --build

# Запустить миграции
docker-compose exec api-server npm run migrate
```

## 📊 Мониторинг

### Health Check

```bash
# API health
curl https://r1riepas.lv/whatsapp/health

# Ответ:
# {"status":"ok","timestamp":"2024-01-13T..."}
```

### Логи

```bash
# Docker логи
docker-compose logs -f api-server
docker-compose logs -f message-worker

# Логи в файлах
tail -f logs/app.log
tail -f logs/error.log
```

### Метрики

- Статус контейнеров: `docker-compose ps`
- Использование ресурсов: `docker stats`
- Проверка портов: `ss -tlnp`

## 🤝 Вклад в проект

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 Лицензия

MIT License - см. [LICENSE](LICENSE) файл

## 📞 Поддержка

- **Документация:** См. файлы в корне проекта
- **Issues:** GitHub Issues
- **Email:** support@r1riepas.lv

## 🙏 Благодарности

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Express](https://expressjs.com/) - Web framework
- [React](https://reactjs.org/) - Frontend framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Redis](https://redis.io/) - Cache
- [RabbitMQ](https://www.rabbitmq.com/) - Message queue

---

**Версия:** 1.0.0  
**Статус:** Production Ready ✅  
**Последнее обновление:** 2024-01-13
