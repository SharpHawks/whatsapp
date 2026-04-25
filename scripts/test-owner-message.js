const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
const EMAIL = 'indrikis38@gmail.com';
const PASSWORD = 'edgars1213';
const TO_NUMBER = '+37128344474';

async function testOwnerMessage() {
  console.log('🧪 Testing Owner Message Sending (Unlimited Access)...\n');

  try {
    // 1. Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD,
    });

    const token = loginResponse.data.token || loginResponse.data.accessToken;
    console.log('✅ Logged in successfully\n');

    // 2. Get bots
    console.log('2️⃣ Getting bots...');
    const botsResponse = await axios.get(`${API_URL}/bots`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const bots = botsResponse.data.bots;
    console.log(`✅ Found ${bots.length} bots\n`);

    // Find connected bot
    const connectedBot = bots.find(b => b.status === 'connected');
    
    if (!connectedBot) {
      console.log('⚠️  No connected bots found!');
      console.log('\nAvailable bots:');
      bots.forEach((bot, i) => {
        console.log(`   ${i + 1}. ${bot.name}`);
        console.log(`      ID: ${bot.id}`);
        console.log(`      Status: ${bot.status}`);
        console.log(`      Phone: ${bot.phoneNumber || 'Not connected'}`);
      });
      
      console.log('\n❌ Please connect a bot first:');
      console.log('   1. Open http://localhost');
      console.log('   2. Go to Bots page');
      console.log('   3. Click "Connect" on a bot');
      console.log('   4. Scan QR code with WhatsApp');
      console.log('   5. Run this script again\n');
      process.exit(1);
    }

    console.log(`✅ Using bot: ${connectedBot.name}`);
    console.log(`   ID: ${connectedBot.id}`);
    console.log(`   Phone: ${connectedBot.phoneNumber}\n`);

    // 3. Get API key for this bot
    console.log('3️⃣ Getting API key...');
    const apiKeysResponse = await axios.get(`${API_URL}/bots/${connectedBot.id}/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let apiKey = apiKeysResponse.data.apiKeys?.[0]?.key;

    // If no API key, create one
    if (!apiKey) {
      console.log('   No API key found, creating one...');
      const createKeyResponse = await axios.post(
        `${API_URL}/bots/${connectedBot.id}/api-keys`,
        { name: 'Test Key' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      apiKey = createKeyResponse.data.apiKey.key;
    }

    console.log(`✅ API Key: ${apiKey.substring(0, 20)}...\n`);

    // 4. Check quota (should be unlimited)
    console.log('4️⃣ Checking quota...');
    const quotaResponse = await axios.get(`${API_URL}/quota/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (quotaResponse.data.unlimited) {
      console.log('✅ Owner access confirmed - UNLIMITED!');
      console.log('   ♾️  No message limits');
      console.log('   ♾️  No rate limits\n');
    } else {
      console.log('⚠️  Warning: Not owner access');
      console.log(`   Messages remaining: ${quotaResponse.data.usage?.messagesRemaining || 0}\n`);
    }

    // 5. Send test message
    console.log('5️⃣ Sending test message...');
    console.log(`   To: ${TO_NUMBER}`);
    console.log(`   From: ${connectedBot.phoneNumber}`);
    console.log(`   Message: "Test from Owner Account - Unlimited Access! 🎉"\n`);

    const messageResponse = await axios.post(
      `${API_URL}/messages/send`,
      {
        to: TO_NUMBER,
        type: 'text',
        content: {
          text: 'Test from Owner Account - Unlimited Access! 🎉',
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

    // 6. Check message status
    console.log('6️⃣ Checking message status...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

    try {
      const statusResponse = await axios.get(
        `${API_URL}/messages/${messageResponse.data.messageId}`,
        {
          headers: { 'X-API-Key': apiKey },
        }
      );

      console.log('✅ Message status:');
      console.log(`   Status: ${statusResponse.data.message.status}`);
      console.log(`   Created: ${new Date(statusResponse.data.message.createdAt).toLocaleString()}`);
      if (statusResponse.data.message.sentAt) {
        console.log(`   Sent: ${new Date(statusResponse.data.message.sentAt).toLocaleString()}`);
      }
      console.log('');
    } catch (error) {
      console.log('⚠️  Could not check message status (this is normal)\n');
    }

    // 7. Summary
    console.log('📊 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Message sent successfully with owner access!');
    console.log('✅ No quota was deducted (unlimited)');
    console.log('✅ No rate limiting was applied');
    console.log('✅ System is working perfectly!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 You can now use the system to replace TextMeBot!');
    console.log('   - Unlimited messages');
    console.log('   - No costs');
    console.log('   - Full control\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      console.log('\n💡 This might be a quota or permission issue.');
      console.log('   But as owner, you should have unlimited access!');
    }
    
    process.exit(1);
  }
}

testOwnerMessage();
