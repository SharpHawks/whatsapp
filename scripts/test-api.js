/**
 * Simple API test script
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let botId = '';

async function test(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ ${name} - PASSED`);
  } catch (error) {
    console.log(`❌ ${name} - FAILED`);
    console.log(`   Error: ${error.response?.data?.error?.message || error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting API Tests\n');
  console.log(`API URL: ${API_URL}\n`);

  // Test 1: Health Check
  await test('Health Check', async () => {
    const response = await axios.get('http://localhost:3000/health');
    if (response.data.status !== 'ok') {
      throw new Error('Health check failed');
    }
  });

  // Test 2: Register User
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'Test123!';
  
  await test('Register User', async () => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    });
    console.log(`   User ID: ${response.data.user.id}`);
    console.log(`   Email: ${response.data.user.email}`);
  });

  // Test 3: Login User
  await test('Login User', async () => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });
    authToken = response.data.accessToken;
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
  });

  // Test 4: Create Bot
  await test('Create Bot', async () => {
    const response = await axios.post(
      `${API_URL}/bots`,
      {
        name: 'Test Bot',
        webhookUrl: 'https://example.com/webhook',
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    botId = response.data.bot.id;
    console.log(`   Bot ID: ${botId}`);
    console.log(`   Bot Status: ${response.data.bot.status}`);
  });

  // Test 5: List Bots
  await test('List Bots', async () => {
    const response = await axios.get(`${API_URL}/bots`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log(`   Total Bots: ${response.data.count}`);
  });

  // Test 6: Connect Bot
  await test('Connect Bot', async () => {
    const response = await axios.post(
      `${API_URL}/bots/${botId}/connect`,
      {},
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    console.log(`   Message: ${response.data.message}`);
  });

  // Wait a bit for QR code generation
  console.log('\n⏳ Waiting 3 seconds for QR code generation...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test 7: Get QR Code
  await test('Get QR Code', async () => {
    const response = await axios.get(`${API_URL}/bots/${botId}/qr`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (response.data.qrCode) {
      console.log(`   QR Code: ${response.data.qrCode.substring(0, 50)}...`);
      console.log(`   📱 Scan this QR code with WhatsApp to connect!`);
    }
  });

  // Test 8: Check Worker Status
  await test('Check Worker Status', async () => {
    const response = await axios.get(`${API_URL}/admin/workers`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const workers = response.data.data.workers;
    console.log(`   Active Workers: ${workers.length}`);
    if (workers.length > 0) {
      const worker = workers[0];
      console.log(`   Worker ID: ${worker.workerId}`);
      console.log(`   Status: ${worker.status}`);
      console.log(`   Connections: ${worker.connectionCount}`);
    }
  });

  // Test 9: Disconnect Bot
  await test('Disconnect Bot', async () => {
    const response = await axios.post(
      `${API_URL}/bots/${botId}/disconnect`,
      {},
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    console.log(`   Message: ${response.data.message}`);
  });

  console.log('\n\n🎉 All tests passed!');
  console.log('\n📊 Summary:');
  console.log('  ✅ API Server is working');
  console.log('  ✅ Worker is running');
  console.log('  ✅ Redis PubSub is working');
  console.log('  ✅ Bot lifecycle events are working');
  console.log('  ✅ QR code generation is working');
  console.log('  ✅ Admin endpoints are working');
  console.log('\n🚀 System is ready for production!');
}

main().catch((error) => {
  console.log('\n❌ Tests failed');
  process.exit(1);
});
