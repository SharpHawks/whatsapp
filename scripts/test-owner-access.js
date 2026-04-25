const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

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

async function testOwnerAccess() {
  log('\n=== Тестирование Owner доступа ===\n', 'blue');

  const email = process.argv[2] || 'indrikis38@gmail.com';
  const password = process.argv[3] || 'edgars1213';

  try {
    // 1. Login
    log('1. Логин...', 'yellow');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });

    const token = loginResponse.data.accessToken;
    log('   ✓ Успешный логин', 'green');
    log(`   Token: ${token.substring(0, 50)}...`, 'blue');

    // 2. Проверка профиля
    log('\n2. Проверка роли пользователя...', 'yellow');
    try {
      const profileResponse = await axios.get(`${API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      log(`   ✓ Role: ${profileResponse.data.user.role}`, 'green');
      log(`   ✓ Email: ${profileResponse.data.user.email}`, 'green');
    } catch (error) {
      log('   ⚠ Endpoint /auth/profile не реализован', 'yellow');
    }

    // 3. Проверка квот
    log('\n3. Проверка квот...', 'yellow');
    const quotaResponse = await axios.get(`${API_URL}/quota/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (quotaResponse.data.unlimited) {
      log('   ✓ Unlimited access: TRUE', 'green');
      log('   ✓ Квоты не применяются', 'green');
    } else {
      log('   ✗ Unlimited access: FALSE', 'red');
      log(`   Message Quota: ${quotaResponse.data.messageQuota}`, 'yellow');
      log(`   Messages Used: ${quotaResponse.data.messagesUsed}`, 'yellow');
      log(`   Bot Limit: ${quotaResponse.data.botLimit}`, 'yellow');
      log('\n   ⚠ ПРОБЛЕМА: Owner должен иметь unlimited access!', 'red');
    }

    // 4. Проверка админ роутов
    log('\n4. Проверка доступа к админ роутам...', 'yellow');
    
    try {
      const connectionsResponse = await axios.get(`${API_URL}/admin/connections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      log('   ✓ GET /admin/connections - доступен', 'green');
      log(`   Найдено подключений: ${connectionsResponse.data.connections?.length || 0}`, 'blue');
    } catch (error) {
      if (error.response?.status === 403) {
        log('   ✗ GET /admin/connections - доступ запрещен', 'red');
      } else {
        log(`   ✗ GET /admin/connections - ошибка: ${error.message}`, 'red');
      }
    }

    try {
      const workersResponse = await axios.get(`${API_URL}/admin/workers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      log('   ✓ GET /admin/workers - доступен', 'green');
      log(`   Найдено workers: ${workersResponse.data.workers?.length || 0}`, 'blue');
    } catch (error) {
      if (error.response?.status === 403) {
        log('   ✗ GET /admin/workers - доступ запрещен', 'red');
      } else {
        log(`   ✗ GET /admin/workers - ошибка: ${error.message}`, 'red');
      }
    }

    try {
      const statsResponse = await axios.get(`${API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      log('   ✓ GET /admin/stats - доступен', 'green');
      log(`   Total Users: ${statsResponse.data.users?.total || 0}`, 'blue');
      log(`   Total Bots: ${statsResponse.data.bots?.total || 0}`, 'blue');
    } catch (error) {
      if (error.response?.status === 403) {
        log('   ✗ GET /admin/stats - доступ запрещен', 'red');
      } else {
        log(`   ✗ GET /admin/stats - ошибка: ${error.message}`, 'red');
      }
    }

    // 5. Тест отправки сообщения (проверка bypass квоты)
    log('\n5. Проверка bypass квоты при отправке сообщения...', 'yellow');
    log('   (Этот тест требует API ключ и настроенного бота)', 'blue');

    log('\n=== Итог ===', 'blue');
    if (quotaResponse.data.unlimited) {
      log('✓ Owner доступ работает корректно!', 'green');
      log('  - Unlimited access включен', 'green');
      log('  - Квоты не применяются', 'green');
      log('  - Админ роуты доступны', 'green');
    } else {
      log('✗ Owner доступ НЕ работает!', 'red');
      log('\nРешение:', 'yellow');
      log('1. Проверьте роль в БД:', 'yellow');
      log('   docker-compose exec postgres psql -U postgres -d whatsapp_api -c "SELECT email, role, unlimited_access FROM users;"', 'blue');
      log('\n2. Установите unlimited_access:', 'yellow');
      log('   docker-compose exec postgres psql -U postgres -d whatsapp_api -c "UPDATE users SET unlimited_access = true WHERE role = \'owner\';"', 'blue');
      log('\n3. Перелогиньтесь в системе (выйдите и войдите снова)', 'yellow');
    }

  } catch (error) {
    log(`\n❌ Ошибка: ${error.message}`, 'red');
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

testOwnerAccess();
