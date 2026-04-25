@echo off
echo ========================================
echo WhatsApp API Platform - Setup
echo ========================================
echo.

echo [1/5] Checking Git installation...
git --version
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed!
    echo Please install Git from https://git-scm.com/download/win
    pause
    exit /b 1
)
echo Git OK!
echo.

echo [2/5] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    echo Trying with legacy peer deps...
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo ERROR: Installation failed!
        pause
        exit /b 1
    )
)
echo Dependencies installed!
echo.

echo [3/5] Creating necessary directories...
if not exist "logs" mkdir logs
if not exist "sessions" mkdir sessions
echo Directories created!
echo.

echo [4/5] Checking .env file...
if not exist ".env" (
    echo .env file already exists!
) else (
    echo .env file created!
)
echo.

echo [5/5] Setup complete!
echo.
echo ========================================
echo Next steps:
echo ========================================
echo 1. Start Docker services: docker-compose up -d
echo 2. Run migrations: npm run migrate up
echo 3. Start API server: npm run dev
echo 4. Start worker (in new terminal): npm run worker
echo ========================================
echo.
pause
