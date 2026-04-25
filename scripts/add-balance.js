const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function addBalance() {
  try {
    const email = process.argv[2] || 'indrikis38@gmail.com';
    const amount = parseFloat(process.argv[3] || '10.00');

    console.log(`💰 Adding balance for ${email}...\n`);

    // Get user
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      await pool.end();
      return;
    }

    const user = userResult.rows[0];

    // Get current balance
    const balanceResult = await pool.query(
      'SELECT amount FROM balances WHERE user_id = $1',
      [user.id]
    );

    const currentBalance = balanceResult.rows.length > 0 
      ? parseFloat(balanceResult.rows[0].amount) 
      : 0;

    const newBalance = currentBalance + amount;

    // Update or insert balance
    if (balanceResult.rows.length > 0) {
      await pool.query(
        'UPDATE balances SET amount = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [newBalance, user.id]
      );
    } else {
      await pool.query(
        'INSERT INTO balances (user_id, amount, currency) VALUES ($1, $2, $3)',
        [user.id, newBalance, 'EUR']
      );
    }

    // Create transaction record
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, 'topup', amount, currentBalance, newBalance, 'completed', 'Manual top-up for testing']
    );

    console.log('✅ Balance updated successfully!');
    console.log(`   User: ${user.email}`);
    console.log(`   Previous balance: €${currentBalance.toFixed(2)}`);
    console.log(`   Added: €${amount.toFixed(2)}`);
    console.log(`   New balance: €${newBalance.toFixed(2)}\n`);

    console.log('💡 Usage:');
    console.log('   node scripts/add-balance.js <email> <amount>');
    console.log('   Example: node scripts/add-balance.js test@example.com 50.00');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

addBalance();
