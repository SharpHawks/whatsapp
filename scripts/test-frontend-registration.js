const axios = require('axios');

const FRONTEND_URL = 'http://localhost';

async function testRegistration() {
  console.log('Testing registration through frontend nginx proxy...\n');

  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  try {
    console.log(`1. Attempting to register user: ${testEmail}`);
    console.log(`   URL: ${FRONTEND_URL}/api/v1/auth/register`);
    
    const response = await axios.post(`${FRONTEND_URL}/api/v1/auth/register`, {
      email: testEmail,
      password: testPassword,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Don't throw on any status
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));

    if (response.status === 201 || response.status === 200) {
      console.log('\n✅ Registration successful!');
      
      // Try to login
      console.log(`\n2. Attempting to login with: ${testEmail}`);
      console.log(`   URL: ${FRONTEND_URL}/api/v1/auth/login`);
      
      const loginResponse = await axios.post(`${FRONTEND_URL}/api/v1/auth/login`, {
        email: testEmail,
        password: testPassword,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      });

      console.log(`   Status: ${loginResponse.status}`);
      console.log(`   Response:`, JSON.stringify(loginResponse.data, null, 2));

      if (loginResponse.status === 200 && loginResponse.data.accessToken) {
        console.log('\n✅ Login successful!');
        console.log('\n🎉 Frontend API proxy is working correctly!');
      } else {
        console.log('\n❌ Login failed');
      }
    } else {
      console.log('\n❌ Registration failed');
      console.log('Response data:', response.data);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Frontend is not accessible. Make sure Docker containers are running.');
    }
  }
}

testRegistration();
