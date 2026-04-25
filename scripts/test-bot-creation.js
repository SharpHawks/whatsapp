const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testBotCreation() {
  console.log('Testing bot creation and QR code generation...\n');

  try {
    // First, register and login
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    console.log('1. Registering user...');
    await axios.post(`${API_URL}/api/v1/auth/register`, {
      email: testEmail,
      password: testPassword,
    });

    console.log('2. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
      email: testEmail,
      password: testPassword,
    });

    const accessToken = loginResponse.data.accessToken;
    console.log('✅ Logged in successfully\n');

    // Create a bot
    console.log('3. Creating bot...');
    const botResponse = await axios.post(
      `${API_URL}/api/v1/bots`,
      {
        name: 'Test Bot',
        phoneNumber: '+1234567890',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('✅ Bot created:', botResponse.data);
    const botId = botResponse.data.bot.id;

    // Wait a bit for QR generation
    console.log('\n4. Waiting 3 seconds for QR code generation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to get QR code
    console.log('5. Fetching QR code...');
    const qrResponse = await axios.get(
      `${API_URL}/api/v1/bots/${botId}/qr`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        validateStatus: () => true,
      }
    );

    console.log(`   Status: ${qrResponse.status}`);
    
    if (qrResponse.status === 200) {
      console.log('✅ QR code received!');
      console.log('   Response:', JSON.stringify(qrResponse.data, null, 2));
      console.log('   QR code length:', qrResponse.data.qrCode?.length || 0);
    } else {
      console.log('❌ QR code not available');
      console.log('   Response:', JSON.stringify(qrResponse.data, null, 2));
    }

    // Check bot status
    console.log('\n6. Checking bot status...');
    const statusResponse = await axios.get(
      `${API_URL}/api/v1/bots/${botId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('   Bot status:', statusResponse.data.bot.status);
    console.log('   Connection status:', statusResponse.data.bot.connectionStatus);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testBotCreation();
