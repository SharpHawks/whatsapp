#!/bin/bash

# Скрипт для импорта базы данных в Docker контейнер на сервере

set -e

if [ -z "$1" ]; then
    echo "❌ Ошибка: Укажите файл для импорта"
    echo "Использование: ./scripts/import-db.sh <backup_file.sql>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Ошибка: Файл $BACKUP_FILE не найден"
    exit 1
fi

echo "⚠️  ВНИМАНИЕ: Это удалит все данные в текущей базе данных!"
echo "Файл для импорта: $BACKUP_FILE"
read -p "Продолжить? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Импорт отменен"
    exit 0
fi

echo ""
echo "🔄 Удаление существующей базы данных..."
docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS whatsapp_api;"

echo "🔄 Создание новой базы данных..."
docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE whatsapp_api;"

echo "🔄 Импорт данных из $BACKUP_FILE..."
cat "$BACKUP_FILE" | docker-compose exec -T postgres psql -U postgres -d whatsapp_api

echo ""
echo "✅ База данных успешно импортирована!"
echo ""
echo "🔄 Перезапуск сервисов..."
docker-compose restart api-server message-worker

echo "✅ Готово!"
