# PowerShell скрипт для экспорта и загрузки базы данных на сервер

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [Parameter(Mandatory=$false)]
    [string]$ServerUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$ServerPath = "/var/www/whatsapp-api"
)

$ErrorActionPreference = "Stop"

Write-Host "🎯 Синхронизация базы данных на сервер $ServerIP" -ForegroundColor Cyan
Write-Host ""

# Имя файла с датой
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "whatsapp_api_backup_$timestamp.sql"

# Шаг 1: Экспорт базы данных
Write-Host "📦 Шаг 1/2: Экспорт базы данных из локального Docker..." -ForegroundColor Yellow
docker-compose exec -T postgres pg_dump -U postgres -d whatsapp_api | Out-File -Encoding UTF8 $backupFile
Write-Host "✅ Экспортировано в: $backupFile" -ForegroundColor Green
Write-Host ""

# Шаг 2: Отправка на сервер
Write-Host "📤 Шаг 2/2: Отправка файла на сервер..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Используйте одну из команд:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Если установлен OpenSSH:" -ForegroundColor White
Write-Host "   scp $backupFile ${ServerUser}@${ServerIP}:${ServerPath}/" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Если установлен pscp (PuTTY):" -ForegroundColor White
Write-Host "   pscp $backupFile ${ServerUser}@${ServerIP}:${ServerPath}/" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Используйте WinSCP или FileZilla для загрузки файла" -ForegroundColor White
Write-Host ""
Write-Host "📥 После загрузки, на сервере выполните:" -ForegroundColor Cyan
Write-Host "cd $ServerPath" -ForegroundColor White
Write-Host "chmod +x scripts/import-db.sh" -ForegroundColor White
Write-Host "./scripts/import-db.sh $backupFile" -ForegroundColor White
Write-Host ""
Write-Host "✅ Файл готов к отправке: $backupFile" -ForegroundColor Green
