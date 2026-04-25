const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkUsers() {
  try {
    const result = await pool.query('SELECT id, email, email_verified FROM users');
    console.log('\n📋 Users in database:');
    console.table(result.rows);
    
    if (result.rows.length === 0) {
      console.log('\n⚠️  No users found. You need to register a user first.');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
