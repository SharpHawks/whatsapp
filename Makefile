.PHONY: help build up down logs restart clean init-db test

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build Docker images
	docker-compose build

up: ## Start all services
	docker-compose up -d
	@echo "✅ Services started!"
	@echo "📝 API: http://localhost:3000"
	@echo "📝 RabbitMQ UI: http://localhost:15672 (guest/guest)"

down: ## Stop all services
	docker-compose down

logs: ## Show logs from all services
	docker-compose logs -f

logs-api: ## Show API server logs
	docker-compose logs -f api-server

logs-worker: ## Show worker logs
	docker-compose logs -f message-worker

restart: ## Restart all services
	docker-compose restart

restart-api: ## Restart API server
	docker-compose restart api-server

restart-worker: ## Restart worker
	docker-compose restart message-worker

clean: ## Stop and remove all containers, volumes
	docker-compose down -v
	docker system prune -f

init-db: ## Initialize database with migrations
	@echo "🔍 Waiting for services to be ready..."
	@sleep 5
	docker-compose exec api-server node scripts/run-migration.js

test: ## Run API tests
	node scripts/test-api.js

status: ## Show status of all services
	docker-compose ps

shell-api: ## Open shell in API container
	docker-compose exec api-server sh

shell-worker: ## Open shell in worker container
	docker-compose exec message-worker sh

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U postgres -d whatsapp_api
