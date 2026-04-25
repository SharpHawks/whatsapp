const axios = require('axios');
const io = require('socket.io-client');

const API_URL = 'http://localhost:3000';

async function testQRFlow() {
  console.log('🧪 Testing complete QR code flow...\n');

  try {
    // 1. Register and login
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    console.log('1️⃣  Registering user...');
    await axios.post(`${API_URL}/api/v1/auth/register`, {
      email: testEmail,
      password: testPassword,
    });

    console.log('2️⃣  Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
      email: testEmail,
      password: testPassword,
    });

    const accessToken = loginResponse.data.accessToken;
    console.log('✅ Logged in successfully\n');

    // 2. Connect to WebSocket
    console.log('3️⃣  Connecting to WebSocket...');
    const socket = io(API_URL, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('✅ WebSocket connected\n');
        resolve();
      });
      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error.message);
        reject(error);
      });
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
    });

    // 3. Listen for QR code event
    let qrReceived = false;
    socket.on('bot:qr', (data) => {
      console.log('📱 Received QR code via WebSocket!');
      console.log('   Bot ID:', data.botId);
      console.log('   QR code length:', data.qrCode?.length || 0);
      qrReceived = true;
    });

    socket.on('bot:status', (data) => {
      console.log('📊 Bot status update:', data.status);
    });

    // 4. Create bot
    console.log('4️⃣  Creating bot...');
    const botResponse = await axios.post(
      `${API_URL}/api/v1/bots`,
      {
        name: 'WebSocket Test Bot',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const botId = botResponse.data.bot.id;
    console.log('✅ Bot created:', botId);
    console.log('   Initial status:', botResponse.data.bot.status);

    // 5. Wait for QR code via WebSocket
    console.log('\n5️⃣  Waiting for QR code via WebSocket (10 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    if (qrReceived) {
      console.log('\n✅ QR code received via WebSocket!');
    } else {
      console.log('\n⚠️  QR code not received via WebSocket');
      
      // Try to fetch via HTTP as fallback
      console.log('\n6️⃣  Fetching QR code via HTTP...');
      const qrResponse = await axios.get(
        `${API_URL}/api/v1/bots/${botId}/qr`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          validateStatus: () => true,
        }
      );

      if (qrResponse.status === 200 && qrResponse.data.qrCode) {
        console.log('✅ QR code available via HTTP');
        console.log('   QR code length:', qrResponse.data.qrCode.length);
      } else {
        console.log('❌ QR code not available');
      }
    }

    // Cleanup
    socket.disconnect();
    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testQRFlow();
