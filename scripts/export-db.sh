#!/bin/bash

# Скрипт для экспорта базы данных из локального Docker контейнера

set -e

echo "🔄 Экспорт базы данных whatsapp_api из Docker..."

# Имя файла с датой
BACKUP_FILE="whatsapp_api_backup_$(date +%Y%m%d_%H%M%S).sql"

# Экспорт базы данных
docker-compose exec -T postgres pg_dump -U postgres -d whatsapp_api > "$BACKUP_FILE"

echo "✅ База данных экспортирована в файл: $BACKUP_FILE"
echo ""
echo "📤 Для отправки на сервер используйте:"
echo "scp $BACKUP_FILE root@YOUR_SERVER_IP:/var/www/whatsapp-api/"
echo ""
echo "📥 Для импорта на сервере выполните:"
echo "cat $BACKUP_FILE | docker-compose exec -T postgres psql -U postgres -d whatsapp_api"
