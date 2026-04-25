# Быстрое развертывание через ZIP

## 📦 Шаг 1: Упаковка (на локальной машине)

### Windows:
```powershell
.\pack-for-deployment.ps1
```

### Linux/Mac:
```bash
bash pack-for-deployment.sh
```

Это создаст архив без `node_modules`, `logs`, `.git` и других ненужных файлов.

---

## 📤 Шаг 2: Загрузка на сервер

```bash
# Загрузите архив
scp -P 22000 whatsapp-api-deploy.tar.gz root@87.99.76.51:/tmp/

# Подключитесь к серверу
ssh -p 22000 root@87.99.76.51
```

---

## 📂 Шаг 3: Распаковка на сервере

```bash
# Создайте директорию и распакуйте
cd /var/www
mkdir -p whatsapp-api
tar -xzf /tmp/whatsapp-api-deploy.tar.gz -C whatsapp-api
cd whatsapp-api

# Удалите архив
rm /tmp/whatsapp-api-deploy.tar.gz
```

---

## ⚙️ Шаг 4: Настройка

```bash
# 1. Создайте .env файл
cp .env.production .env
nano .env
# Вставьте ваши сгенерированные секреты, сохраните (Ctrl+X, Y, Enter)

# 2. Настройте Apache
a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl
nano /etc/apache2/sites-available/r1riepas.lv-le-ssl.conf
# Добавьте конфигурацию из DEPLOYMENT.md, сохраните

# 3. Проверьте и перезагрузите Apache
apache2ctl configtest
systemctl reload apache2

# 4. Запустите Docker
docker-compose up -d --build

# 5. Миграции БД
docker-compose exec api-server npm run migrate
```

---

## ✅ Шаг 5: Проверка

```bash
# Проверка API
curl https://r1riepas.lv/whatsapp/health

# Откройте в браузере
# https://r1riepas.lv/whatsapp
```

---

## 🎉 Готово!

Полная документация: **DEPLOYMENT.md**

---

## 🔄 Обновление проекта

Когда нужно обновить:

```bash
# 1. На локальной машине: упакуйте новую версию
.\pack-for-deployment.ps1

# 2. Загрузите на сервер
scp -P 22000 whatsapp-api-deploy.tar.gz root@87.99.76.51:/tmp/

# 3. На сервере: остановите, обновите, запустите
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
docker-compose exec api-server npm run migrate
```

---

**Время: 15 минут | Простота: ⭐⭐⭐⭐⭐**
