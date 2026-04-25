#!/bin/bash

echo "🔍 Waiting for PostgreSQL to be ready..."
until docker exec whatsapp-postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "✅ PostgreSQL is ready!"
echo "📝 Running database migrations..."

# Run migrations
docker exec whatsapp-postgres psql -U postgres -d whatsapp_api -f /docker-entrypoint-initdb.d/001_initial_schema.sql
docker exec whatsapp-postgres psql -U postgres -d whatsapp_api -f /docker-entrypoint-initdb.d/002_add_user_fields.sql

echo "✅ Database initialized successfully!"
