#!/bin/bash

# Скрипт для упаковки проекта для развертывания на сервер
# Запустите: bash pack-for-deployment.sh

echo "=== Упаковка проекта для развертывания ==="
echo ""

# Имя архива
ARCHIVE_NAME="whatsapp-api-deploy.tar.gz"

# Удалить старый архив если существует
if [ -f "$ARCHIVE_NAME" ]; then
    rm "$ARCHIVE_NAME"
    echo "Удален старый архив"
fi

echo "Создание архива: $ARCHIVE_NAME"
echo ""

# Создать архив, исключая ненужные папки
tar -czf "$ARCHIVE_NAME" \
    --exclude='node_modules' \
    --exclude='frontend/node_modules' \
    --exclude='dist' \
    --exclude='frontend/dist' \
    --exclude='frontend/build' \
    --exclude='.git' \
    --exclude='.vscode' \
    --exclude='.kiro' \
    --exclude='logs' \
    --exclude='sessions' \
    --exclude='.env' \
    --exclude='*.log' \
    --exclude='*.zip' \
    --exclude='*.tar.gz' \
    .

ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
echo "✓ Архив создан: $ARCHIVE_NAME"
echo "✓ Размер: $ARCHIVE_SIZE"
echo ""

echo "=== Следующие шаги ==="
echo ""
echo "1. Загрузите архив на сервер:"
echo "   scp -P 22000 $ARCHIVE_NAME root@87.99.76.51:/tmp/"
echo ""
echo "2. На сервере распакуйте:"
echo "   cd /var/www"
echo "   mkdir -p whatsapp-api"
echo "   tar -xzf /tmp/$ARCHIVE_NAME -C whatsapp-api"
echo "   cd whatsapp-api"
echo ""
echo "3. Следуйте инструкции в DEPLOYMENT.md"
echo ""
