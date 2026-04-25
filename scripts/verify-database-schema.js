const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'whatsapp_api',
  user: 'postgres',
  password: 'postgres'
});

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkTable(tableName, requiredColumns) {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    if (result.rows.length === 0) {
      log(`   ✗ Таблица ${tableName} не найдена`, 'red');
      return false;
    }

    log(`   ✓ Таблица ${tableName} существует`, 'green');
    
    const existingColumns = result.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      log(`      ⚠ Отсутствуют колонки: ${missingColumns.join(', ')}`, 'yellow');
      return false;
    }
    
    log(`      Все обязательные колонки присутствуют (${requiredColumns.length})`, 'blue');
    return true;
  } catch (error) {
    log(`   ✗ Ошибка проверки таблицы ${tableName}: ${error.message}`, 'red');
    return false;
  }
}

async function checkData(tableName, description) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const count = parseInt(result.rows[0].count);
    log(`   ${description}: ${count} записей`, count > 0 ? 'green' : 'yellow');
    return count;
  } catch (error) {
    log(`   ✗ Ошибка проверки данных ${tableName}: ${error.message}`, 'red');
    return 0;
  }
}

async function verifySchema() {
  log('\n=== Проверка схемы базы данных ===\n', 'blue');

  let allGood = true;

  // 1. Проверка таблицы users
  log('1. Таблица users', 'yellow');
  if (!await checkTable('users', ['id', 'email', 'password_hash', 'role', 'unlimited_access'])) {
    allGood = false;
  }
  await checkData('users', 'Пользователей');

  // 2. Проверка таблицы bots
  log('\n2. Таблица bots', 'yellow');
  if (!await checkTable('bots', [
    'id', 'user_id', 'name', 'phone_number', 'connection_status',
    'connection_process_id', 'connection_hostname', 'connection_updated_at'
  ])) {
    allGood = false;
  }
  await checkData('bots', 'Ботов');

  // 3. Проверка таблицы subscription_plans
  log('\n3. Таблица subscription_plans', 'yellow');
  if (!await checkTable('subscription_plans', [
    'id', 'name', 'slug', 'price_monthly', 'message_quota', 'bot_limit', 'is_active'
  ])) {
    allGood = false;
  }
  const plansCount = await checkData('subscription_plans', 'Планов подписки');
  if (plansCount === 0) {
    log('   ⚠ Нет планов подписки! Запустите миграцию 007', 'yellow');
    allGood = false;
  }

  // 4. Проверка таблицы user_subscriptions
  log('\n4. Таблица user_subscriptions', 'yellow');
  if (!await checkTable('user_subscriptions', [
    'id', 'user_id', 'plan_id', 'status', 'current_period_start', 
    'current_period_end', 'messages_used'
  ])) {
    allGood = false;
  }
  await checkData('user_subscriptions', 'Подписок пользователей');

  // 5. Проверка таблицы messages
  log('\n5. Таблица messages', 'yellow');
  if (!await checkTable('messages', [
    'id', 'bot_id', 'direction', 'from_number', 'to_number', 'type', 'content', 'status'
  ])) {
    allGood = false;
  }
  await checkData('messages', 'Сообщений');

  // 6. Проверка таблицы baileys_sessions
  log('\n6. Таблица baileys_sessions', 'yellow');
  if (!await checkTable('baileys_sessions', ['bot_id', 'creds', 'keys'])) {
    allGood = false;
  }
  await checkData('baileys_sessions', 'Сессий Baileys');

  // 7. Проверка индексов
  log('\n7. Проверка индексов', 'yellow');
  try {
    const result = await pool.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (
        indexname LIKE 'idx_bots_connection%'
        OR indexname LIKE 'idx_user_subscriptions%'
        OR indexname LIKE 'idx_subscription_plans%'
      )
      ORDER BY tablename, indexname
    `);
    
    log(`   Найдено специальных индексов: ${result.rows.length}`, 'green');
    result.rows.forEach(row => {
      log(`      - ${row.tablename}.${row.indexname}`, 'blue');
    });
  } catch (error) {
    log(`   ✗ Ошибка проверки индексов: ${error.message}`, 'red');
    allGood = false;
  }

  // 8. Проверка foreign keys
  log('\n8. Проверка внешних ключей', 'yellow');
  try {
    const result = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('bots', 'user_subscriptions', 'messages')
      ORDER BY tc.table_name
    `);
    
    log(`   Найдено внешних ключей: ${result.rows.length}`, 'green');
    result.rows.forEach(row => {
      log(`      - ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`, 'blue');
    });
  } catch (error) {
    log(`   ✗ Ошибка проверки внешних ключей: ${error.message}`, 'red');
    allGood = false;
  }

  // Итоги
  log('\n=== Результаты проверки ===', 'blue');
  if (allGood) {
    log('✓ Схема базы данных корректна', 'green');
  } else {
    log('✗ Обнаружены проблемы в схеме базы данных', 'red');
  }

  await pool.end();
  process.exit(allGood ? 0 : 1);
}

verifySchema().catch(error => {
  log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
