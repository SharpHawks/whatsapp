@echo off
echo ========================================
echo Starting WhatsApp API Platform
echo ========================================
echo.

echo Checking if Docker services are running...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Docker is not running!
    echo Please start Docker Desktop or run: docker-compose up -d
    echo.
)

echo Starting API server...
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

npm run dev
