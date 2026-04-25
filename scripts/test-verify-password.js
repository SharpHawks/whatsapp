const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testVerifyPassword() {
  try {
    console.log('Testing password verification endpoint...\n');

    // First, login to get a token
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
      email: process.argv[2] || 'indrikis38@gmail.com',
      password: process.argv[3] || 'edgars1213',
    });

    const token = loginResponse.data.accessToken;
    console.log('✓ Login successful\n');

    // Test 1: Verify with correct password
    console.log('2. Testing with correct password...');
    const correctResponse = await axios.post(
      `${API_URL}/api/v1/auth/verify-password`,
      {
        password: process.argv[3] || 'password123',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log('✓ Correct password verified:', correctResponse.data);
    console.log('');

    // Test 2: Verify with incorrect password
    console.log('3. Testing with incorrect password...');
    try {
      await axios.post(
        `${API_URL}/api/v1/auth/verify-password`,
        {
          password: 'wrongpassword',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log('✗ Should have failed with incorrect password');
    } catch (error) {
      console.log('✓ Correctly rejected incorrect password:', error.response?.data?.error?.message);
    }
    console.log('');

    // Test 3: Rate limiting (3 attempts)
    console.log('4. Testing rate limiting (3 failed attempts)...');
    for (let i = 1; i <= 4; i++) {
      try {
        await axios.post(
          `${API_URL}/api/v1/auth/verify-password`,
          {
            password: 'wrongpassword',
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (error) {
        console.log(`   Attempt ${i}: ${error.response?.data?.error?.message}`);
      }
    }

    console.log('\n✓ All tests completed!');
  } catch (error) {
    console.error('✗ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testVerifyPassword();
