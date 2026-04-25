const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

async function testWebSocket() {
  console.log('🧪 Testing WebSocket Real-time Updates\n');

  try {
    // Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'test1762809426766@example.com',
      password: 'password123'
    });
    const token = loginResponse.data.accessToken;
    console.log('✅ Logged in successfully\n');

    const headers = { Authorization: `Bearer ${token}` };

    // Test 1: Bot Status Update
    console.log('2️⃣ Testing Bot Status Update...');
    console.log('   👀 Watch your browser - bot status should update!');
    await axios.post(`${API_URL}/test/socket/bot-status`, {
      botId: 'test-bot-123',
      status: 'connected',
      phoneNumber: '+1234567890'
    }, { headers });
    console.log('✅ Bot status event sent\n');
    await sleep(2000);

    // Test 2: New Message Notification
    console.log('3️⃣ Testing New Message Notification...');
    console.log('   👀 Watch for toast notification!');
    await axios.post(`${API_URL}/test/socket/new-message`, {
      botId: 'test-bot-123',
      message: {
        from: '+1234567890',
        to: '+0987654321',
        content: 'Hello! This is a real-time test message 🚀',
        type: 'text'
      }
    }, { headers });
    console.log('✅ New message event sent\n');
    await sleep(2000);

    // Test 3: Balance Update
    console.log('4️⃣ Testing Balance Update...');
    console.log('   👀 Watch balance change in real-time!');
    await axios.post(`${API_URL}/test/socket/balance-update`, {
      balance: 45.50,
      change: -5.00
    }, { headers });
    console.log('✅ Balance update event sent\n');
    await sleep(2000);

    // Test 4: Low Balance Warning
    console.log('5️⃣ Testing Low Balance Warning...');
    console.log('   👀 Watch for red warning toast!');
    await axios.post(`${API_URL}/test/socket/low-balance`, {
      balance: 8.50,
      threshold: 10.00
    }, { headers });
    console.log('✅ Low balance warning sent\n');
    await sleep(2000);

    // Test 5: Multiple rapid updates
    console.log('6️⃣ Testing Multiple Rapid Updates...');
    console.log('   👀 Watch for multiple notifications!');
    for (let i = 1; i <= 3; i++) {
      await axios.post(`${API_URL}/test/socket/new-message`, {
        botId: 'test-bot-123',
        message: {
          from: '+1234567890',
          content: `Rapid message #${i}`,
          type: 'text'
        }
      }, { headers });
      console.log(`   ✅ Message ${i}/3 sent`);
      await sleep(500);
    }
    console.log('✅ All rapid messages sent\n');

    console.log('🎉 All WebSocket tests completed!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Bot status updates');
    console.log('   ✅ New message notifications');
    console.log('   ✅ Balance updates');
    console.log('   ✅ Low balance warnings');
    console.log('   ✅ Multiple rapid updates');
    console.log('\n💡 Check your browser to see all the real-time updates!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testWebSocket();
