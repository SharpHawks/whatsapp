# Развертывание WhatsApp API на r1riepas.lv

## 📋 Что будет развернуто

```
https://r1riepas.lv/whatsapp          → Веб-интерфейс
https://r1riepas.lv/whatsapp/api      → API
```

**Время установки:** 15 минут  
**Требования:** Linux сервер с Apache, Docker, Docker Compose

**⚠️ Для Ubuntu 18.04:** См. `UBUNTU-18-NOTES.md` - Node.js не работает напрямую из-за старой GLIBC. Используйте только Docker!

---

## 🚀 Быстрая установка

### Шаг 1: Подключитесь к серверу

```bash
ssh -p 22000 root@87.99.76.51
```

### Шаг 2: Загрузите проект

**Вариант A: Через ZIP/TAR архив (рекомендуется)**

На локальной машине:
```powershell
# Windows PowerShell
.\pack-for-deployment.ps1

# Или Linux/Mac
bash pack-for-deployment.sh
```

Это создаст архив `whatsapp-api-deploy.zip` (Windows) или `whatsapp-api-deploy.tar.gz` (Linux/Mac).

Загрузите на сервер:
```bash
# С локальной машины
scp -P 22000 whatsapp-api-deploy.tar.gz root@87.99.76.51:/tmp/

# На сервере
ssh -p 22000 root@87.99.76.51
cd /var/www
mkdir -p whatsapp-api
tar -xzf /tmp/whatsapp-api-deploy.tar.gz -C whatsapp-api
cd whatsapp-api
```

**Вариант B: Через Git**
```bash
cd /var/www
git clone https://github.com/your-username/whatsapp-api.git
cd whatsapp-api
```

### Шаг 3: Создайте .env файл

**ВАЖНО для Ubuntu 18.04:** Node.js не работает напрямую из-за старой GLIBC. Используйте готовый `.env.production` с вашими секретами.

```bash
# Скопируйте готовый файл
cp .env.production .env

# Или создайте вручную
nano .env
```

Вставьте (замените секреты на сгенерированные):

```env
NODE_ENV=production
PORT=3000
API_VERSION=v1

CORS_ORIGINS=https://r1riepas.lv,https://www.r1riepas.lv
ENABLE_HTTPS_REDIRECT=false

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=whatsapp_api
DB_USER=postgres
DB_PASSWORD=ВАША_СГЕНЕРИРОВАННАЯ_DB_PASSWORD

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=ВАША_СГЕНЕРИРОВАННАЯ_REDIS_PASSWORD
REDIS_DB=0

# JWT
JWT_SECRET=ВАШ_СГЕНЕРИРОВАННЫЙ_JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=ВАШ_СГЕНЕРИРОВАННЫЙ_JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN=7d

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
RABBITMQ_QUEUE_NAME=whatsapp_messages

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Pricing (EUR)
PRICE_TEXT=0.05
PRICE_IMAGE=0.10
PRICE_VIDEO=0.20
PRICE_DOCUMENT=0.10
PRICE_AUDIO=0.10
PRICE_INTERACTIVE=0.15

# Withdrawal
MIN_WITHDRAWAL_AMOUNT=100
WITHDRAWAL_FEE_PERCENT=2

# Baileys
BAILEYS_SESSION_PATH=/app/sessions

# Worker
WORKER_ENABLED=true
WORKER_HEALTH_CHECK_INTERVAL=30000
WORKER_HEARTBEAT_INTERVAL=10000
SHUTDOWN_TIMEOUT=30000

# Lock
REDIS_LOCK_TTL=30000

# API Key Salt
API_KEY_SALT=ВАШ_СГЕНЕРИРОВАННЫЙ_API_KEY_SALT
```

Сохраните: `Ctrl+X`, `Y`, `Enter`

### Шаг 4: Настройте Apache

```bash
# Включите необходимые модули
a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl

# Найдите конфигурацию вашего сайта
ls /etc/apache2/sites-available/
# Обычно: r1riepas.lv-le-ssl.conf или 000-default-le-ssl.conf

# Отредактируйте конфигурацию
nano /etc/apache2/sites-available/r1riepas.lv-le-ssl.conf
```

**Добавьте эти строки ВНУТРЬ блока `<VirtualHost *:443>`** (перед `</VirtualHost>`):

```apache
    # WhatsApp API Proxy Configuration
    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
    
    # WebSocket Support (Socket.IO)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule ^/whatsapp/socket.io/(.*)  ws://localhost:3000/socket.io/$1 [P,L]
    
    ProxyPass /whatsapp/socket.io/ http://localhost:3000/socket.io/
    ProxyPassReverse /whatsapp/socket.io/ http://localhost:3000/socket.io/
    
    # API Proxy
    ProxyPass /whatsapp/api http://localhost:3000/api
    ProxyPassReverse /whatsapp/api http://localhost:3000/api
    
    # Health Check
    ProxyPass /whatsapp/health http://localhost:3000/health
    ProxyPassReverse /whatsapp/health http://localhost:3000/health
    
    # Frontend Proxy (must be last!)
    ProxyPass /whatsapp/ http://localhost:8080/
    ProxyPassReverse /whatsapp/ http://localhost:8080/
    
    ProxyTimeout 300
```

Сохраните: `Ctrl+X`, `Y`, `Enter`

**Проверьте и перезагрузите Apache:**

```bash
# Проверка конфигурации
apache2ctl configtest

# Если OK, перезагрузите
systemctl reload apache2

# Проверьте статус
systemctl status apache2
```

### Шаг 5: Запустите Docker контейнеры

```bash
# Запуск всех сервисов
docker-compose up -d --build

# Проверка статуса (все должны быть "Up")
docker-compose ps

# Просмотр логов (опционально)
docker-compose logs -f
# Нажмите Ctrl+C для выхода
```

### Шаг 6: Дождитесь запуска контейнеров

```bash
# Подождите 30 секунд пока контейнеры полностью запустятся
sleep 30

# Проверьте статус
docker-compose ps
```

### Шаг 7: Запустите миграции базы данных

```bash
docker-compose exec api-server npm run migrate
```

### Шаг 8: Проверка

```bash
# Проверка API
curl https://r1riepas.lv/whatsapp/health

# Должно вернуть:
# {"status":"ok","timestamp":"2024-01-13T..."}
```

**Откройте в браузере:**
- ✅ https://r1riepas.lv/whatsapp

---

## 🎉 Готово!

Ваш WhatsApp API работает!

### Создайте первого пользователя

**Через веб-интерфейс:**
1. Откройте https://r1riepas.lv/whatsapp
2. Нажмите "Register"
3. Введите email и пароль (минимум 8 символов, с заглавными, строчными, цифрами и спецсимволами)

**Или через API:**
```bash
curl -X POST https://r1riepas.lv/whatsapp/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@r1riepas.lv",
    "password": "YourStrongPassword123!"
  }'
```

---

## 🔧 Управление

### Просмотр логов

```bash
# Docker логи
docker-compose logs -f api-server
docker-compose logs -f message-worker

# Apache логи
tail -f /var/log/apache2/error.log
tail -f /var/log/apache2/access.log
```

### Перезапуск

```bash
# Перезапуск Docker
docker-compose restart

# Перезапуск Apache
systemctl reload apache2
```

### Остановка

```bash
docker-compose down
```

### Обновление

```bash
git pull
docker-compose up -d --build
docker-compose exec api-server npm run migrate
```

---

## 🔍 Troubleshooting

### Проблема: 404 Not Found

```bash
# Проверьте Apache конфигурацию
apache2ctl configtest
systemctl status apache2
tail -f /var/log/apache2/error.log

# Проверьте, что модули включены
apache2ctl -M | grep proxy
```

### Проблема: Docker контейнеры не запускаются

```bash
# Проверьте статус
docker-compose ps

# Проверьте логи
docker-compose logs

# Проверьте порты
ss -tlnp | grep -E ':(3000|8080)'
```

### Проблема: API не отвечает

```bash
# Проверьте контейнер
docker-compose ps api-server
docker-compose logs api-server

# Проверьте напрямую
curl http://localhost:3000/health
```

### Проблема: База данных не подключается

```bash
# Проверьте PostgreSQL
docker-compose logs postgres

# Проверьте подключение
docker-compose exec postgres psql -U postgres -d whatsapp_api
```

---

## 📊 Полезные команды

```bash
# Статус всех сервисов
docker-compose ps

# Использование ресурсов
docker stats

# Проверка портов
ss -tlnp | grep -E ':(3000|8080|5432|6379|5672)'

# Проверка Apache модулей
apache2ctl -M | grep proxy

# Тест Apache конфигурации
apache2ctl -t

# Проверка DNS
dig r1riepas.lv +short

# Проверка SSL сертификата
openssl s_client -connect r1riepas.lv:443 -servername r1riepas.lv
```

---

## 🔐 Безопасность

После развертывания проверьте:

```bash
# Проверка security headers
curl -I https://r1riepas.lv/whatsapp/health

# Проверка HTTPS
curl -I http://r1riepas.lv/whatsapp
# Должен быть редирект на HTTPS

# Проверка rate limiting (сделайте 110 запросов)
for i in {1..110}; do curl https://r1riepas.lv/whatsapp/health; done
# После 100 запросов должна быть ошибка 429
```

**Реализованная защита:**
- ✅ HTTPS шифрование
- ✅ Сильные пароли (8+ символов, заглавные, строчные, цифры, спецсимволы)
- ✅ JWT токены с refresh tokens
- ✅ Rate limiting (100 запросов/минуту)
- ✅ Login rate limiting (5 попыток/15 минут)
- ✅ CORS настроен
- ✅ Security headers (HSTS, CSP, X-Frame-Options)
- ✅ Input validation и sanitization
- ✅ SQL injection защита (параметризованные запросы)
- ✅ XSS защита

---

## 📦 Бэкапы

### Настройка автоматических бэкапов БД

```bash
# Создайте скрипт бэкапа
nano /root/backup-whatsapp.sh
```

Вставьте:

```bash
#!/bin/bash
BACKUP_DIR="/backups/whatsapp"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

cd /var/www/whatsapp-api
docker-compose exec -T postgres pg_dump -U postgres whatsapp_api | \
  gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Удалить бэкапы старше 30 дней
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

```bash
# Сделайте исполняемым
chmod +x /root/backup-whatsapp.sh

# Добавьте в cron (ежедневно в 2:00)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-whatsapp.sh") | crontab -

# Проверьте cron
crontab -l
```

### Восстановление из бэкапа

```bash
# Остановите приложение
cd /var/www/whatsapp-api
docker-compose down

# Восстановите БД
gunzip < /backups/whatsapp/backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d whatsapp_api

# Запустите приложение
docker-compose up -d
```

---

## 📞 Поддержка

**Документация:**
- Безопасность: `SECURITY.md`
- Примеры .env: `.env.example`, `.env.production.example`

**Логи:**
- Docker: `docker-compose logs`
- Apache: `/var/log/apache2/`

**Проверка здоровья:**
- API: https://r1riepas.lv/whatsapp/health
- Frontend: https://r1riepas.lv/whatsapp

---

**Версия:** 1.0.0  
**Дата:** 2024-01-13  
**Домен:** r1riepas.lv  
**Сервер:** 87.99.76.51
