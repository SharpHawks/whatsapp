# PowerShell скрипт для экспорта базы данных из Docker на Windows

$ErrorActionPreference = "Stop"

Write-Host "🔄 Экспорт базы данных whatsapp_api из Docker..." -ForegroundColor Cyan

# Имя файла с датой
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "whatsapp_api_backup_$timestamp.sql"

# Экспорт базы данных
Write-Host "📦 Создание дампа базы данных..." -ForegroundColor Yellow
docker-compose exec -T postgres pg_dump -U postgres -d whatsapp_api | Out-File -Encoding UTF8 $backupFile

Write-Host ""
Write-Host "✅ База данных экспортирована в файл: $backupFile" -ForegroundColor Green
Write-Host ""
Write-Host "📤 Для отправки на сервер используйте:" -ForegroundColor Cyan
Write-Host "scp $backupFile root@YOUR_SERVER_IP:/var/www/whatsapp-api/" -ForegroundColor White
Write-Host ""
Write-Host "Или используйте WinSCP, FileZilla или другой SFTP клиент" -ForegroundColor Yellow
Write-Host ""
Write-Host "📥 На сервере выполните для импорта:" -ForegroundColor Cyan
Write-Host "cd /var/www/whatsapp-api" -ForegroundColor White
Write-Host "chmod +x scripts/import-db.sh" -ForegroundColor White
Write-Host "./scripts/import-db.sh $backupFile" -ForegroundColor White
