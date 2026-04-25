/**
 * Test database connection with different passwords
 */

const { Client } = require('pg');
require('dotenv').config();

async function testConnection(password) {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'whatsapp_api',
    user: process.env.DB_USER || 'postgres',
    password: password,
  });

  try {
    await client.connect();
    console.log(`✅ Connection successful with password: "${password}"`);
    await client.end();
    return true;
  } catch (error) {
    console.log(`❌ Connection failed with password: "${password}"`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing PostgreSQL connection...\n');
  console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`Port: ${process.env.DB_PORT || '5432'}`);
  console.log(`Database: ${process.env.DB_NAME || 'whatsapp_api'}`);
  console.log(`User: ${process.env.DB_USER || 'postgres'}\n`);

  // Try different common passwords
  const passwords = [
    process.env.DB_PASSWORD,
    '',           // Empty password
    'admin',
    'root',
    '123456',
  ];

  for (const password of passwords) {
    const success = await testConnection(password);
    if (success) {
      console.log(`\n✅ Found working password!`);
      console.log(`\n📝 Update your .env file:`);
      console.log(`DB_PASSWORD=${password}`);
      return;
    }
  }

  console.log(`\n❌ Could not connect with any common password.`);
  console.log(`\n💡 Solutions:`);
  console.log(`1. Check your PostgreSQL password`);
  console.log(`2. Reset PostgreSQL password:`);
  console.log(`   psql -U postgres -c "ALTER USER postgres PASSWORD 'newpassword';"`);
  console.log(`3. Or use Docker PostgreSQL:`);
  console.log(`   Uncomment postgres service in docker-compose.yml`);
  console.log(`   docker-compose up -d postgres`);
}

main();
