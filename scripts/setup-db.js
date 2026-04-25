const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres', // Connect to default database first
};

async function setupDatabase() {
  const client = new Client(config);

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Check if database exists
    const dbName = process.env.DB_NAME || 'whatsapp_api';
    const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`;
    const result = await client.query(checkDbQuery);

    if (result.rows.length === 0) {
      console.log(`📦 Creating database: ${dbName}...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database ${dbName} created successfully`);
    } else {
      console.log(`✅ Database ${dbName} already exists`);
    }

    await client.end();

    // Connect to the new database and run migrations
    const dbClient = new Client({
      ...config,
      database: dbName,
    });

    console.log(`🔌 Connecting to ${dbName}...`);
    await dbClient.connect();
    console.log(`✅ Connected to ${dbName}`);

    // Run migration
    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    
    if (fs.existsSync(migrationPath)) {
      console.log('📝 Running migrations...');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      await dbClient.query(migrationSQL);
      console.log('✅ Migrations completed successfully');
    } else {
      console.log('⚠️  No migration file found at:', migrationPath);
    }

    // Verify tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const tables = await dbClient.query(tablesQuery);
    
    console.log('\n📊 Created tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    await dbClient.end();

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Run: npm run dev');
    console.log('  2. Open: http://localhost:3000/health');
    console.log('  3. Start frontend: cd frontend && npm run dev');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('  1. Make sure PostgreSQL is running');
    console.error('  2. Check your .env file configuration');
    console.error('  3. Verify database credentials');
    console.error('  4. Try: psql -U postgres -c "SELECT 1"');
    process.exit(1);
  }
}

// Run setup
setupDatabase();
