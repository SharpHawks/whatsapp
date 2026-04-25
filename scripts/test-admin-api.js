const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

async function testAdminAPI() {
  try {
    console.log('Testing admin API endpoints...\n');

    // First, login to get token
    console.log('1. Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'indrikis38@gmail.com',
      password: 'your_password_here', // Replace with actual password
    });

    const token = loginRes.data.accessToken;
    console.log('✓ Logged in successfully\n');

    // Decode token to check role
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    console.log('Token payload:', {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });
    console.log('');

    // Test admin stats endpoint
    console.log('2. Getting admin stats...');
    const statsRes = await axios.get(`${API_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✓ Admin stats:', JSON.stringify(statsRes.data, null, 2));
    console.log('');

    // Test system health endpoint
    console.log('3. Getting system health...');
    const healthRes = await axios.get(`${API_URL}/admin/system-health`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✓ System health:', JSON.stringify(healthRes.data, null, 2));
    console.log('');

    // Test connections endpoint
    console.log('4. Getting active connections...');
    const connectionsRes = await axios.get(`${API_URL}/admin/connections`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✓ Active connections:', JSON.stringify(connectionsRes.data, null, 2));
    console.log('');

    console.log('=== All tests passed! ===');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testAdminAPI();
