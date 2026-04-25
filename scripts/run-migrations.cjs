/**
 * Run all SQL files in /migrations (sorted by name, excluding /down) against PostgreSQL.
 * Use in Docker: docker compose exec api-server node scripts/run-migrations.cjs
 * Run a specific migration prefix: docker compose exec api-server node scripts/run-migrations.cjs 011
 * Relies on DB_* or DATABASE_URL env vars (same as the API container).
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'whatsapp_api',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

function migrationsDir() {
  return path.join(__dirname, '../migrations');
}

async function main() {
  const dir = migrationsDir();
  const migrationPrefix = process.argv[2];
  if (!fs.existsSync(dir)) {
    console.error('Migrations directory not found:', dir);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => !migrationPrefix || f.startsWith(migrationPrefix))
    .sort();

  if (files.length === 0) {
    console.log('No .sql files in', dir);
    process.exit(0);
  }

  const client = new Client(getConfig());
  await client.connect();
  console.log('Connected to database for migrations');

  try {
    for (const file of files) {
      const full = path.join(dir, file);
      const sql = fs.readFileSync(full, 'utf8');
      console.log('Running', file, '...');
      await client.query(sql);
      console.log('OK', file);
    }
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('All migrations completed.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
