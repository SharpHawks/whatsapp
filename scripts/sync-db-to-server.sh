#!/bin/bash

# Полный скрипт для синхронизации базы данных с локального Docker на сервер

set -e

# Конфигурация
SERVER_USER="root"
SERVER_IP=""
SERVER_PATH="/var/www/whatsapp-api"

# Проверка параметров
if [ -z "$1" ]; then
    echo "❌ Ошибка: Укажите IP адрес сервера"
    echo "Использование: ./scripts/sync-db-to-server.sh <server_ip>"
    exit 1
fi

SERVER_IP="$1"

echo "🎯 Синхронизация базы данных на сервер $SERVER_IP"
echo ""

# Имя файла с датой
BACKUP_FILE="whatsapp_api_backup_$(date +%Y%m%d_%H%M%S).sql"

# Шаг 1: Экспорт базы данных
echo "📦 Шаг 1/3: Экспорт базы данных из локального Docker..."
docker-compose exec -T postgres pg_dump -U postgres -d whatsapp_api > "$BACKUP_FILE"
echo "✅ Экспортировано в: $BACKUP_FILE"
echo ""

# Шаг 2: Отправка на сервер
echo "📤 Шаг 2/3: Отправка файла на сервер..."
scp "$BACKUP_FILE" "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"
echo "✅ Файл отправлен на сервер"
echo ""

# Шаг 3: Импорт на сервере
echo "📥 Шаг 3/3: Импорт базы данных на сервере..."
ssh "$SERVER_USER@$SERVER_IP" << EOF
cd $SERVER_PATH
echo "🔄 Удаление существующей базы данных..."
docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS whatsapp_api;"
echo "🔄 Создание новой базы данных..."
docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE whatsapp_api;"
echo "🔄 Импорт данных..."
cat "$BACKUP_FILE" | docker-compose exec -T postgres psql -U postgres -d whatsapp_api
echo "🔄 Перезапуск сервисов..."
docker-compose restart api-server message-worker
echo "🧹 Удаление временного файла..."
rm "$BACKUP_FILE"
EOF

echo ""
echo "✅ Синхронизация завершена успешно!"
echo "🧹 Локальный файл сохранен: $BACKUP_FILE"
