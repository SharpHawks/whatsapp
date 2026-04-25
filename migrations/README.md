# Database Migrations

This directory contains SQL migration scripts for the WhatsApp API database schema.

## Migration Files

- `001_initial_schema.sql` - Initial database schema with all core tables
- `002_add_process_tracking.sql` - Adds process tracking columns to bots table for worker management

## Running Migrations

### Run all migrations (up)
```bash
npx ts-node scripts/migrate.ts up
```

### Run a specific migration (up)
```bash
npx ts-node scripts/migrate.ts up 002
```

### Rollback all migrations (down)
```bash
npx ts-node scripts/migrate.ts down
```

### Rollback a specific migration (down)
```bash
npx ts-node scripts/migrate.ts down 002
```

## Migration 002: Process Tracking

This migration adds support for tracking which process (worker or main server) is managing each bot's WhatsApp connection.

### Added Columns

- `connection_process_id` (INTEGER) - Process ID of the worker or server managing the connection
- `connection_hostname` (VARCHAR) - Hostname of the machine where the connection is managed
- `connection_updated_at` (TIMESTAMP) - Last time the connection status was updated

### Added Indexes

- `idx_bots_connection_monitoring` - Composite index on (connection_status, connection_updated_at) for efficient monitoring queries

### Use Cases

1. **Connection Monitoring** - Track which process owns each bot connection
2. **Stale Connection Cleanup** - Identify and clean up connections from crashed processes
3. **Load Distribution** - Monitor connection distribution across worker processes
4. **Debugging** - Troubleshoot connection issues by identifying the managing process

## Verification

To verify the schema after running migrations:

```bash
npx ts-node scripts/verify-schema.ts
```

This will check that all expected columns and indexes exist in the database.
