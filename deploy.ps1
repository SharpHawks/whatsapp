# WhatsApp API Deployment Script (PowerShell)
# This script builds and deploys the entire application stack

Write-Host "🚀 Starting WhatsApp API Deployment..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Stop existing containers
Write-Host "`n📦 Stopping existing containers..." -ForegroundColor Blue
docker-compose down

# Build images
Write-Host "`n🔨 Building Docker images..." -ForegroundColor Blue
docker-compose build --no-cache

# Start database services first
Write-Host "`n🗄️  Starting database services..." -ForegroundColor Blue
docker-compose up -d postgres redis rabbitmq

# Wait for databases to be ready
Write-Host "`n⏳ Waiting for databases to be ready..." -ForegroundColor Blue
Start-Sleep -Seconds 10

# Run migrations
Write-Host "`n🔄 Running database migrations..." -ForegroundColor Blue
docker-compose run --rm api-server npm run migrate

# Start all services
Write-Host "`n🚀 Starting all services..." -ForegroundColor Blue
docker-compose up -d

# Show status
Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "`nServices:" -ForegroundColor Cyan
Write-Host "  - API Server: http://localhost:3000"
Write-Host "  - Frontend: http://localhost:80"
Write-Host "  - Adminer (DB): http://localhost:5050"
Write-Host "  - RabbitMQ Management: http://localhost:15672"
Write-Host "`nTo view logs:" -ForegroundColor Yellow
Write-Host "  docker-compose logs -f"
Write-Host "`nTo stop all services:" -ForegroundColor Yellow
Write-Host "  docker-compose down"
