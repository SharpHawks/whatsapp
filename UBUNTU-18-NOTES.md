# Заметки для Ubuntu 18.04

## ⚠️ Проблема с GLIBC

Ubuntu 18.04 имеет GLIBC 2.27, а Node.js 18+ требует GLIBC 2.28+.

**Ошибка:**
```
node: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.28' not found
```

## ✅ Решение: Используйте только Docker

Все Node.js команды выполняются **ВНУТРИ** Docker контейнеров.

---

## 📋 Правильные команды

### ❌ НЕ РАБОТАЕТ (напрямую на сервере):
```bash
node scripts/generate-secrets.js  # ❌ Ошибка GLIBC
npm install                        # ❌ Ошибка GLIBC
npm run migrate                    # ❌ Ошибка GLIBC
```

### ✅ РАБОТАЕТ (через Docker):
```bash
# Генерация секретов - делайте на ЛОКАЛЬНОЙ машине
# Или используйте готовый .env.production

# Миграции - через Docker
docker-compose exec api-server npm run migrate

# Любые npm команды - через Docker
docker-compose exec api-server npm run <command>
```

---

## 🚀 Процесс развертывания для Ubuntu 18.04

### 1. На локальной машине (Windows/Mac/Linux с новой GLIBC):

```bash
# Сгенерируйте секреты
node scripts/generate-secrets.js

# Скопируйте вывод и сохраните
```

### 2. Упакуйте проект:

```bash
# Windows
.\pack-for-deployment.ps1

# Linux/Mac
bash pack-for-deployment.sh
```

### 3. Загрузите на сервер:

```bash
scp -P 22000 whatsapp-api-deploy.tar.gz root@87.99.76.51:/tmp/
```

### 4. На сервере Ubuntu 18.04:

```bash
# Распакуйте
cd /var/www
mkdir -p whatsapp-api
tar -xzf /tmp/whatsapp-api-deploy.tar.gz -C whatsapp-api
cd whatsapp-api

# Создайте .env с сгенерированными секретами
nano .env
# Вставьте конфигурацию с секретами, сохраните

# Настройте Apache
a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl
nano /etc/apache2/sites-available/r1riepas.lv-le-ssl.conf
# Добавьте конфигурацию из DEPLOYMENT.md

# Проверьте и перезагрузите Apache
apache2ctl configtest
systemctl reload apache2

# Запустите Docker (НЕ требует Node.js на хосте!)
docker-compose up -d --build

# Подождите 30 секунд
sleep 30

# Миграции через Docker
docker-compose exec api-server npm run migrate

# Проверка
curl https://r1riepas.lv/whatsapp/health
```

---

## 🔧 Полезные команды через Docker

### Просмотр логов:
```bash
docker-compose logs -f api-server
docker-compose logs -f message-worker
```

### Выполнение npm команд:
```bash
# Установка зависимостей (если нужно)
docker-compose exec api-server npm install

# Любая npm команда
docker-compose exec api-server npm run <command>

# Проверка версии Node.js в контейнере
docker-compose exec api-server node --version
```

### Доступ к контейнеру:
```bash
# Войти в контейнер
docker-compose exec api-server bash

# Внутри контейнера можно использовать node, npm и т.д.
node --version
npm --version
```

### Перезапуск:
```bash
docker-compose restart
```

### Остановка:
```bash
docker-compose down
```

### Обновление:
```bash
# Загрузите новый архив на сервер
# Затем:
cd /var/www/whatsapp-api
docker-compose down
cd /var/www
rm -rf whatsapp-api-old
mv whatsapp-api whatsapp-api-old
mkdir whatsapp-api
tar -xzf /tmp/whatsapp-api-deploy.tar.gz -C whatsapp-api
cd whatsapp-api
cp ../whatsapp-api-old/.env .
docker-compose up -d --build
sleep 30
docker-compose exec api-server npm run migrate
```

---

## 💡 Почему это работает?

Docker контейнеры используют свою собственную файловую систему с новой GLIBC:
- Контейнер основан на `node:18-alpine` или `node:18`
- Внутри контейнера есть GLIBC 2.28+
- Node.js работает внутри контейнера, а не на хосте Ubuntu 18.04

**Вывод:** Вам НЕ нужно обновлять Ubuntu или устанавливать Node.js на сервер!

---

## 🔍 Проверка

### Проверка версии GLIBC на хосте:
```bash
ldd --version
# Покажет: ldd (Ubuntu GLIBC 2.27-3ubuntu1) 2.27
```

### Проверка версии GLIBC в контейнере:
```bash
docker-compose exec api-server ldd --version
# Покажет: более новую версию (2.28+)
```

### Проверка Node.js в контейнере:
```bash
docker-compose exec api-server node --version
# Покажет: v18.x.x или v20.x.x
```

---

## ⚠️ Важно

1. **НЕ пытайтесь** запускать `node` или `npm` напрямую на Ubuntu 18.04
2. **Всегда используйте** `docker-compose exec api-server` для Node.js команд
3. **Генерируйте секреты** на локальной машине, не на сервере
4. **Docker** - это единственный способ запустить современный Node.js на Ubuntu 18.04

---

**Рекомендация:** Если возможно, обновите Ubuntu до 20.04 или 22.04 в будущем для лучшей совместимости.
