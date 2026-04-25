const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let botId = '';

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

function logTest(name, passed) {
  const symbol = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`${symbol} ${name}`, color);
}

async function test(name, fn) {
  try {
    await fn();
    logTest(name, true);
    return true;
  } catch (error) {
    logTest(name, false);
    console.error(`   Error: ${error.message}`);
    if (error.response?.data) {
      console.error(`   Response:`, error.response.data);
    }
    return false;
  }
}

async function runTests() {
  log('\n=== Тестирование WhatsApp API Platform ===\n', 'blue');
  
  let passed = 0;
  let failed = 0;

  const email = process.argv[2] || 'indrikis38@gmail.com';
  const password = process.argv[3] || 'edgars1213';

  // 1. Тест аутентификации
  log('1. Тесты аутентификации', 'yellow');
  if (await test('   Login с существующим пользователем', async () => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: email,
      password: password
    });
    authToken = response.data.accessToken || response.data.token;
    if (!authToken) throw new Error('Token not received');
  })) {
    passed++;
  } else {
    failed++;
    log('   Пропускаем остальные тесты из-за ошибки аутентификации', 'red');
    return { passed, failed };
  }

  // 2. Тест получения профиля
  log('\n2. Тесты профиля пользователя', 'yellow');
  if (await test('   Получение профиля пользователя', async () => {
    const response = await axios.get(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.data.user) throw new Error('User data not received');
    log(`      Email: ${response.data.user.email}`, 'blue');
    log(`      Role: ${response.data.user.role}`, 'blue');
  })) passed++; else failed++;

  // 3. Тест квот и подписки
  log('\n3. Тесты квот и подписки', 'yellow');
  if (await test('   Получение информации о квотах', async () => {
    const response = await axios.get(`${API_URL}/quota/usage`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    log(`      Plan: ${response.data.subscription?.plan || 'N/A'}`, 'blue');
    log(`      Message Quota: ${response.data.messageQuota}`, 'blue');
    log(`      Messages Used: ${response.data.messagesUsed}`, 'blue');
    log(`      Bot Limit: ${response.data.botLimit}`, 'blue');
    log(`      Current Bots: ${response.data.currentBots}`, 'blue');
  })) passed++; else failed++;

  if (await test('   Получение доступных планов подписки', async () => {
    const response = await axios.get(`${API_URL}/quota/plans`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.data.plans || response.data.plans.length === 0) {
      throw new Error('No plans available');
    }
    log(`      Доступно планов: ${response.data.plans.length}`, 'blue');
    response.data.plans.forEach(plan => {
      log(`         - ${plan.name}: $${plan.price_monthly}/mo (${plan.message_quota} msgs, ${plan.bot_limit} bots)`, 'blue');
    });
  })) passed++; else failed++;

  // 4. Тест ботов
  log('\n4. Тесты управления ботами', 'yellow');
  if (await test('   Получение списка ботов', async () => {
    const response = await axios.get(`${API_URL}/bots`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (response.data.bots && response.data.bots.length > 0) {
      botId = response.data.bots[0].id;
      log(`      Найдено ботов: ${response.data.bots.length}`, 'blue');
      response.data.bots.forEach(bot => {
        log(`         - ${bot.name}: ${bot.connection_status} (${bot.phone_number || 'no phone'})`, 'blue');
      });
    } else {
      log('      Ботов не найдено', 'blue');
    }
  })) passed++; else failed++;

  if (botId) {
    if (await test('   Получение деталей бота', async () => {
      const response = await axios.get(`${API_URL}/bots/${botId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      log(`      Bot ID: ${response.data.id}`, 'blue');
      log(`      Name: ${response.data.name}`, 'blue');
      log(`      Status: ${response.data.connection_status}`, 'blue');
      log(`      Phone: ${response.data.phone_number || 'N/A'}`, 'blue');
    })) passed++; else failed++;

    if (await test('   Получение статистики бота', async () => {
      const response = await axios.get(`${API_URL}/bots/${botId}/stats`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      log(`      Total Messages: ${response.data.totalMessages || 0}`, 'blue');
      log(`      Sent: ${response.data.sentMessages || 0}`, 'blue');
      log(`      Received: ${response.data.receivedMessages || 0}`, 'blue');
    })) passed++; else failed++;
  }

  // 5. Тест проверки лимитов
  log('\n5. Тесты проверки лимитов', 'yellow');
  if (await test('   Проверка лимита сообщений', async () => {
    const response = await axios.get(`${API_URL}/quota/check/message`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    log(`      Can Send: ${response.data.allowed}`, 'blue');
    log(`      Remaining: ${response.data.remaining}`, 'blue');
  })) passed++; else failed++;

  if (await test('   Проверка лимита ботов', async () => {
    const response = await axios.get(`${API_URL}/quota/check/bot`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    log(`      Can Create: ${response.data.allowed}`, 'blue');
    log(`      Remaining: ${response.data.remaining}`, 'blue');
  })) passed++; else failed++;

  // 6. Тест здоровья системы
  log('\n6. Тесты здоровья системы', 'yellow');
  if (await test('   Health check API', async () => {
    const response = await axios.get('http://localhost:3000/health');
    if (response.data.status !== 'ok') throw new Error('Health check failed');
    log(`      Status: ${response.data.status}`, 'blue');
    log(`      Database: ${response.data.database}`, 'blue');
    log(`      Redis: ${response.data.redis}`, 'blue');
  })) passed++; else failed++;

  return { passed, failed };
}

runTests()
  .then(({ passed, failed }) => {
    log('\n=== Результаты тестирования ===', 'blue');
    log(`Пройдено: ${passed}`, 'green');
    log(`Провалено: ${failed}`, 'red');
    log(`Всего: ${passed + failed}\n`, 'yellow');

    if (failed === 0) {
      log('🎉 Все тесты пройдены успешно!', 'green');
    } else {
      log('⚠️  Некоторые тесты провалены. Проверьте ошибки выше.', 'red');
    }

    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(error => {
    log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
