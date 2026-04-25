/**
 * Test API through frontend nginx proxy
 */

const axios = require('axios');

const API_URL = 'http://localhost/api/v1';
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
    if (error.response?.data) {
      console.log(`   Response:`, error.response.data);
    }
    throw error;
  }
}

async function main() {
  console.log('🚀 Testing API through Frontend Nginx Proxy\n');
  console.log(`API URL: ${API_URL}\n`);

  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'Test123!';

  // Test 1: Register
  await test('Register User', async () => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    });
    console.log(`   User ID: ${response.data.user.id}`);
  });

  // Test 2: Login
  await test('Login User', async () => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });
    authToken = response.data.accessToken;
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
  });

  // Test 3: Create Bot
  await test('Create Bot', async () => {
    const response = await axios.post(
      `${API_URL}/bots`,
      { name: 'Docker Test Bot' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    botId = response.data.bot.id;
    console.log(`   Bot ID: ${botId}`);
  });

  // Test 4: Connect Bot
  await test('Connect Bot', async () => {
    const response = await axios.post(
      `${API_URL}/bots/${botId}/connect`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log(`   ${response.data.message}`);
  });

  // Wait for QR
  console.log('\n⏳ Waiting 3 seconds for QR code...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test 5: Get QR Code
  await test('Get QR Code', async () => {
    const response = await axios.get(`${API_URL}/bots/${botId}/qr`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log(`   QR Code: ${response.data.qrCode.substring(0, 50)}...`);
    console.log(`\n   📱 Scan this QR code with WhatsApp!`);
    console.log(`   Bot ID: ${botId}`);
  });

  console.log('\n\n🎉 All frontend API tests passed!');
  console.log('\n📊 Summary:');
  console.log('  ✅ Frontend is accessible at http://localhost');
  console.log('  ✅ API proxy through nginx is working');
  console.log('  ✅ Bot creation and connection working');
  console.log('  ✅ QR code generation working');
  console.log('\n🚀 Open http://localhost in your browser and login!');
  console.log(`   Email: ${testEmail}`);
  console.log(`   Password: ${testPassword}`);
}

main().catch((error) => {
  console.log('\n❌ Tests failed');
  process.exit(1);
});
