#!/bin/bash

# WhatsApp API Deployment Script
# This script builds and deploys the entire application stack

set -e

echo "🚀 Starting WhatsApp API Deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Stop existing containers
echo -e "${BLUE}📦 Stopping existing containers...${NC}"
docker-compose down

# Build images
echo -e "${BLUE}🔨 Building Docker images...${NC}"
docker-compose build --no-cache

# Start database services first
echo -e "${BLUE}🗄️  Starting database services...${NC}"
docker-compose up -d postgres redis rabbitmq

# Wait for databases to be ready
echo -e "${BLUE}⏳ Waiting for databases to be ready...${NC}"
sleep 10

# Run migrations
echo -e "${BLUE}🔄 Running database migrations...${NC}"
docker-compose run --rm api-server npm run migrate

# Start all services
echo -e "${BLUE}🚀 Starting all services...${NC}"
docker-compose up -d

# Show status
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Services:"
echo "  - API Server: http://localhost:3000"
echo "  - Frontend: http://localhost:80"
echo "  - Adminer (DB): http://localhost:5050"
echo "  - RabbitMQ Management: http://localhost:15672"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop all services:"
echo "  docker-compose down"
