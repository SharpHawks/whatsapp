const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
let authToken = '';

async function testIntegration() {
  console.log('🧪 Testing Frontend-Backend Integration\n');

  try {
    // Test 1: Login
    console.log('1️⃣ Testing Login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'test1762809426766@example.com',
      password: 'password123'
    });
    authToken = loginResponse.data.accessToken;
    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);

    // Test 2: Get Bots
    console.log('\n2️⃣ Testing Get Bots...');
    const botsResponse = await axios.get(`${API_URL}/bots`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Bots fetched successfully');
    console.log(`   Total bots: ${botsResponse.data.bots.length}`);

    // Test 3: Get Balance
    console.log('\n3️⃣ Testing Get Balance...');
    const balanceResponse = await axios.get(`${API_URL}/billing/balance`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Balance fetched successfully');
    console.log(`   Balance: ${balanceResponse.data.balance.amount} ${balanceResponse.data.balance.currency}`);

    // Test 4: Get Transactions
    console.log('\n4️⃣ Testing Get Transactions...');
    const transactionsResponse = await axios.get(`${API_URL}/billing/transactions`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Transactions fetched successfully');
    console.log(`   Total transactions: ${transactionsResponse.data.transactions.length}`);

    // Test 5: Get Messages
    console.log('\n5️⃣ Testing Get Messages...');
    const messagesResponse = await axios.get(`${API_URL}/messages`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Messages fetched successfully');
    console.log(`   Total messages: ${messagesResponse.data.total}`);

    console.log('\n🎉 All integration tests passed!');
    console.log('\n📊 Summary:');
    console.log(`   ✅ Authentication: Working`);
    console.log(`   ✅ Bots API: Working`);
    console.log(`   ✅ Billing API: Working`);
    console.log(`   ✅ Messages API: Working`);
    console.log('\n🚀 Frontend is ready to use these APIs!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testIntegration();
