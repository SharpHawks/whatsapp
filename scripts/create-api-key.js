const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createApiKey() {
  log('\n=== Создание API ключа ===\n', 'blue');

  const email = process.argv[2] || 'indrikis38@gmail.com';
  const password = process.argv[3] || 'edgars1213';
  const botId = process.argv[4];

  try {
    // 1. Login
    log('1. Логин...', 'yellow');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });

    const token = loginResponse.data.accessToken;
    log('   ✓ Успешный логин', 'green');

    // 2. Get bots if botId not provided
    let selectedBotId = botId;
    
    if (!selectedBotId) {
      log('\n2. Получение списка ботов...', 'yellow');
      const botsResponse = await axios.get(`${API_URL}/bots`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!botsResponse.data.bots || botsResponse.data.bots.length === 0) {
        log('   ✗ У вас нет ботов. Создайте бота сначала.', 'red');
        process.exit(1);
      }

      log(`   Найдено ботов: ${botsResponse.data.bots.length}`, 'green');
      botsResponse.data.bots.forEach((bot, index) => {
        log(`   ${index + 1}. ${bot.name} (${bot.id})`, 'cyan');
      });

      selectedBotId = botsResponse.data.bots[0].id;
      log(`\n   Используем первого бота: ${botsResponse.data.bots[0].name}`, 'blue');
    }

    // 3. Get existing API keys
    log('\n3. Проверка существующих API ключей...', 'yellow');
    const existingKeysResponse = await axios.get(`${API_URL}/auth/api-keys`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const existingKey = existingKeysResponse.data.apiKeys?.find(
      key => key.botId === selectedBotId && key.isActive
    );

    if (existingKey) {
      log('   ⚠ API ключ для этого бота уже существует', 'yellow');
      log(`   Key ID: ${existingKey.id}`, 'cyan');
      log(`   Created: ${existingKey.createdAt}`, 'cyan');
      log(`   Last Used: ${existingKey.lastUsedAt || 'Never'}`, 'cyan');
      
      log('\n   Хотите перегенерировать ключ? (y/n)', 'yellow');
      log('   Продолжаем с перегенерацией...', 'blue');
    }

    // 4. Generate/Regenerate API key
    log('\n4. Генерация API ключа...', 'yellow');
    const apiKeyResponse = await axios.post(
      `${API_URL}/auth/api-keys/regenerate`,
      { botId: selectedBotId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const apiKey = apiKeyResponse.data.apiKey;

    log('\n' + '='.repeat(60), 'green');
    log('✓ API ключ успешно создан!', 'green');
    log('='.repeat(60), 'green');
    log(`\nAPI Key: ${apiKey}`, 'cyan');
    log('='.repeat(60), 'green');

    log('\n📋 Как использовать:', 'blue');
    log('\n1. В Postman:', 'yellow');
    log('   - Откройте коллекцию WhatsApp API Platform', 'cyan');
    log('   - Перейдите в Variables', 'cyan');
    log('   - Установите apiKey = ' + apiKey, 'cyan');
    log('   - Сохраните коллекцию', 'cyan');

    log('\n2. В curl:', 'yellow');
    log(`   curl -X POST ${API_URL}/messages/send \\`, 'cyan');
    log(`     -H "X-API-Key: ${apiKey}" \\`, 'cyan');
    log(`     -H "Content-Type: application/json" \\`, 'cyan');
    log(`     -d '{"to":"37128344474","type":"text","content":{"text":"Hello!"}}'`, 'cyan');

    log('\n3. В коде (JavaScript):', 'yellow');
    log(`   const response = await axios.post('${API_URL}/messages/send', {`, 'cyan');
    log(`     to: '37128344474',`, 'cyan');
    log(`     type: 'text',`, 'cyan');
    log(`     content: { text: 'Hello from API!' }`, 'cyan');
    log(`   }, {`, 'cyan');
    log(`     headers: { 'X-API-Key': '${apiKey}' }`, 'cyan');
    log(`   });`, 'cyan');

    log('\n⚠️  ВАЖНО:', 'yellow');
    log('   - Сохраните этот ключ в безопасном месте', 'red');
    log('   - Не делитесь ключом с другими', 'red');
    log('   - Ключ дает доступ к отправке сообщений от имени вашего бота', 'red');

    log('\n✓ Готово!\n', 'green');

  } catch (error) {
    log(`\n❌ Ошибка: ${error.message}`, 'red');
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Показать помощь
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  log('\n=== Создание API ключа ===\n', 'blue');
  log('Использование:', 'yellow');
  log('  node scripts/create-api-key.js [email] [password] [botId]\n', 'cyan');
  log('Параметры:', 'yellow');
  log('  email    - Email пользователя (по умолчанию: indrikis38@gmail.com)', 'cyan');
  log('  password - Пароль (по умолчанию: edgars1213)', 'cyan');
  log('  botId    - ID бота (опционально, будет выбран первый бот)\n', 'cyan');
  log('Примеры:', 'yellow');
  log('  node scripts/create-api-key.js', 'cyan');
  log('  node scripts/create-api-key.js user@example.com password123', 'cyan');
  log('  node scripts/create-api-key.js user@example.com password123 bot-uuid\n', 'cyan');
  process.exit(0);
}

createApiKey();
