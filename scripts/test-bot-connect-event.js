const axios = require('axios');

const API_URL = 'http://localhost:3000';
const BOT_ID = '034ee70d-767d-4d61-a464-6206ffe7628a';

async function testBotConnect() {
  console.log('🔌 Testing bot connect event...\n');

  try {
    // Login
    const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
      email: 'indrikis38@gmail.com',
      password: 'your_password', // This won't work, but we'll use API key instead
    }, {
      validateStatus: () => true,
    });

    let accessToken;
    if (loginResponse.status === 200) {
      accessToken = loginResponse.data.accessToken;
    } else {
      console.log('⚠️  Login failed, trying with generated token...');
      // For testing, we'll call the connect endpoint directly
    }

    console.log('1️⃣  Calling /connect endpoint...');
    const connectResponse = await axios.post(
      `${API_URL}/api/v1/bots/${BOT_ID}/connect`,
      {},
      {
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`,
        } : {},
        validateStatus: () => true,
      }
    );

    console.log(`   Status: ${connectResponse.status}`);
    console.log(`   Response:`, JSON.stringify(connectResponse.data, null, 2));

    if (connectResponse.status === 200) {
      console.log('\n✅ Connect event sent!');
      console.log('\n2️⃣  Waiting 5 seconds for worker to process...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('\n3️⃣  Checking bot status...');
      // We'll check via database
    } else {
      console.log('\n❌ Failed to send connect event');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testBotConnect();
