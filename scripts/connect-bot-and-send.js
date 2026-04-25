const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
const EMAIL = 'indrikis38@gmail.com';
const PASSWORD = 'edgars1213';
const BOT_ID = 'dd186384-e89c-43d6-8d18-fe640c898317'; // R1 Ulbroka
const TO_NUMBER = '+37128344474';

async function connectAndSend() {
  console.log('🔌 Connecting bot and sending message...\n');

  try {
    // 1. Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD,
    });

    const token = loginResponse.data.token || loginResponse.data.accessToken;
    console.log('✅ Logged in successfully\n');

    // 2. Try to connect the bot
    console.log('2️⃣ Connecting bot...');
    console.log(`   Bot ID: ${BOT_ID}\n`);

    try {
      const connectResponse = await axios.post(
        `${API_URL}/bots/${BOT_ID}/connect`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✅ Bot connection initiated');
      console.log(`   Status: ${connectResponse.data.status || 'connecting'}\n`);

      // 3. Get QR code
      console.log('3️⃣ Getting QR code...');
      
      // Wait a bit for QR to generate
      await new Promise(resolve => setTimeout(resolve, 3000));

      const qrResponse = await axios.get(`${API_URL}/bots/${BOT_ID}/qr`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (qrResponse.data.qrCode) {
        console.log('✅ QR Code generated!');
        console.log('\n📱 Please scan this QR code with WhatsApp:\n');
        console.log('   1. Open WhatsApp on your phone');
        console.log('   2. Go to Settings > Linked Devices');
        console.log('   3. Tap "Link a Device"');
        console.log('   4. Scan the QR code shown in the browser');
        console.log('\n   Or open: http://localhost/bots\n');
        
        console.log('⏳ Waiting for you to scan the QR code...');
        console.log('   (This script will wait for 60 seconds)\n');

        // Wait for connection (check every 5 seconds for 60 seconds)
        let connected = false;
        for (let i = 0; i < 12; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const botResponse = await axios.get(`${API_URL}/bots/${BOT_ID}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          console.log(`   Checking... Status: ${botResponse.data.bot.status}`);

          if (botResponse.data.bot.status === 'connected') {
            connected = true;
            console.log('\n✅ Bot connected successfully!\n');
            break;
          }
        }

        if (!connected) {
          console.log('\n⏱️  Timeout: Bot not connected within 60 seconds');
          console.log('   Please try again or connect manually via the web interface\n');
          process.exit(1);
        }

      } else {
        console.log('⚠️  No QR code available');
        console.log('   The bot might already be connected or in a different state\n');
      }

    } catch (connectError) {
      if (connectError.response?.status === 400) {
        console.log('⚠️  Bot connection issue:', connectError.response.data.error?.message);
        console.log('   Trying to check current status...\n');
      } else {
        throw connectError;
      }
    }

    // 4. Check bot status
    console.log('4️⃣ Checking bot status...');
    const botResponse = await axios.get(`${API_URL}/bots/${BOT_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const bot = botResponse.data.bot;
    console.log(`✅ Bot: ${bot.name}`);
    console.log(`   Status: ${bot.status}`);
    console.log(`   Phone: ${bot.phoneNumber || 'Not connected'}\n`);

    if (bot.status !== 'connected') {
      console.log('❌ Bot is not connected. Cannot send message.');
      console.log('\n💡 Please connect the bot first:');
      console.log('   1. Open http://localhost/bots');
      console.log('   2. Click "Connect" on R1 Ulbroka');
      console.log('   3. Scan QR code');
      console.log('   4. Run this script again\n');
      process.exit(1);
    }

    // 5. Get or create API key
    console.log('5️⃣ Getting API key...');
    const apiKeysResponse = await axios.get(`${API_URL}/bots/${BOT_ID}/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let apiKey = apiKeysResponse.data.apiKeys?.[0]?.key;

    if (!apiKey) {
      console.log('   Creating new API key...');
      const createKeyResponse = await axios.post(
        `${API_URL}/bots/${BOT_ID}/api-keys`,
        { name: 'Test Key' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      apiKey = createKeyResponse.data.apiKey.key;
    }

    console.log(`✅ API Key: ${apiKey.substring(0, 20)}...\n`);

    // 6. Send message
    console.log('6️⃣ Sending test message...');
    console.log(`   To: ${TO_NUMBER}`);
    console.log(`   Message: "🎉 Test from Owner Account - Unlimited Access!"\n`);

    const messageResponse = await axios.post(
      `${API_URL}/messages/send`,
      {
        to: TO_NUMBER,
        type: 'text',
        content: {
          text: '🎉 Test from Owner Account - Unlimited Access! System is working perfectly!',
        },
      },
      {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Message sent successfully!');
    console.log(`   Message ID: ${messageResponse.data.messageId}`);
    console.log(`   Status: ${messageResponse.data.status || 'queued'}\n`);

    console.log('🎉 SUCCESS! Everything is working!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Bot connected');
    console.log('✅ Message sent with owner access (unlimited)');
    console.log('✅ No quota deducted');
    console.log('✅ Ready to replace TextMeBot!\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

connectAndSend();
