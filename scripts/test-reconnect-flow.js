const axios = require('axios');

const API_URL = 'http://localhost:3000';
const BOT_ID = '034ee70d-767d-4d61-a464-6206ffe7628a';

async function testReconnectFlow() {
  console.log('🔄 Testing reconnect flow...\n');

  try {
    // Register new user
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    console.log('1️⃣  Registering test user...');
    await axios.post(`${API_URL}/api/v1/auth/register`, {
      email,
      password,
    });

    console.log('2️⃣  Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
      email,
      password,
    });

    const accessToken = loginResponse.data.accessToken;
    console.log('✅ Logged in\n');

    // Try to connect the existing bot (this will fail because it's not our bot)
    console.log('3️⃣  Attempting to connect bot (will fail - not our bot)...');
    const connectResponse = await axios.post(
      `${API_URL}/api/v1/bots/${BOT_ID}/connect`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        validateStatus: () => true,
      }
    );

    console.log(`   Status: ${connectResponse.status}`);
    if (connectResponse.status !== 200) {
      console.log('   Expected - bot belongs to another user\n');
    }

    // Create our own bot
    console.log('4️⃣  Creating new bot...');
    const botResponse = await axios.post(
      `${API_URL}/api/v1/bots`,
      {
        name: 'Test Reconnect Bot',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const newBotId = botResponse.data.bot.id;
    console.log(`✅ Bot created: ${newBotId}`);
    console.log(`   Status: ${botResponse.data.bot.status}\n`);

    // Wait for QR
    console.log('5️⃣  Waiting 3 seconds for QR generation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get QR
    console.log('6️⃣  Fetching QR code...');
    const qrResponse = await axios.get(
      `${API_URL}/api/v1/bots/${newBotId}/qr`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        validateStatus: () => true,
      }
    );

    if (qrResponse.status === 200 && qrResponse.data.qrCode) {
      console.log('✅ QR code available!');
      console.log(`   Length: ${qrResponse.data.qrCode.length} characters`);
    } else {
      console.log('❌ QR code not available');
      console.log(`   Status: ${qrResponse.status}`);
      console.log(`   Response:`, qrResponse.data);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testReconnectFlow();
