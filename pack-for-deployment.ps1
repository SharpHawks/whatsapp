# Script to pack project for server deployment
# Run: .\pack-for-deployment.ps1

Write-Host "=== Packing project for deployment ===" -ForegroundColor Green
Write-Host ""

# Archive name
$archiveName = "whatsapp-api-deploy.zip"

Write-Host "Creating archive: $archiveName" -ForegroundColor Yellow
Write-Host ""

# Remove old archive if exists
if (Test-Path $archiveName) {
    Remove-Item $archiveName
    Write-Host "Removed old archive" -ForegroundColor Gray
}

# Create temporary directory for packing
$tempDir = "temp_pack_$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host "Copying files..." -ForegroundColor Cyan

# Copy all files except excluded ones
$excludeDirs = @('node_modules', 'dist', '.git', '.vscode', '.kiro', 'logs', 'sessions', 'temp_pack_*')
$excludeFiles = @('.env', '*.log', '*.zip')

# Use robocopy for efficient copying with exclusions
$excludeDirArgs = $excludeDirs | ForEach-Object { "/XD `"$_`"" }
$excludeFileArgs = $excludeFiles | ForEach-Object { "/XF `"$_`"" }

$robocopyArgs = @(
    ".",
    $tempDir,
    "/E",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/nc",
    "/ns",
    "/np"
) + $excludeDirArgs + $excludeFileArgs

Start-Process -FilePath "robocopy" -ArgumentList $robocopyArgs -Wait -NoNewWindow

# Create archive from temp directory
Write-Host "Creating archive..." -ForegroundColor Cyan
Compress-Archive -Path "$tempDir\*" -DestinationPath $archiveName -Force

# Clean up temp directory
Remove-Item -Path $tempDir -Recurse -Force

$archiveSize = (Get-Item $archiveName).Length / 1MB
Write-Host "Archive created: $archiveName" -ForegroundColor Green
Write-Host "Size: $([math]::Round($archiveSize, 2)) MB" -ForegroundColor Green
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Upload archive to server:" -ForegroundColor White
Write-Host "   scp -P 22000 $archiveName root@87.99.76.51:/tmp/" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. On server, extract:" -ForegroundColor White
Write-Host "   cd /var/www" -ForegroundColor Cyan
Write-Host "   unzip /tmp/$archiveName -d whatsapp-api" -ForegroundColor Cyan
Write-Host "   cd whatsapp-api" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Follow instructions in DEPLOYMENT.md" -ForegroundColor White
Write-Host ""
