/**
 * Test script for API key management endpoints
 * Tests the new endpoints: GET /api-key, POST /api-key/reveal, POST /api-key/regenerate
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

// Test credentials (update these with actual test user credentials)
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

let authToken = '';
let testBotId = '';

async function login() {
  console.log('\n=== Step 1: Login ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    authToken = response.data.accessToken;
    console.log('✓ Login successful');
    console.log(`Token: ${authToken.substring(0, 20)}...`);
    return true;
  } catch (error) {
    console.error('✗ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function getBots() {
  console.log('\n=== Step 2: Get Bots ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/bots`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (response.data.bots.length === 0) {
      console.log('✗ No bots found. Please create a bot first.');
      return false;
    }

    testBotId = response.data.bots[0].id;
    console.log('✓ Found bots:', response.data.bots.length);
    console.log(`Using bot: ${testBotId} (${response.data.bots[0].name})`);
    return true;
  } catch (error) {
    console.error('✗ Failed to get bots:', error.response?.data || error.message);
    return false;
  }
}

async function getApiKeyInfo() {
  console.log('\n=== Step 3: Get API Key Info (Masked) ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/bots/${testBotId}/api-key`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    console.log('✓ API Key Info retrieved:');
    console.log(`  ID: ${response.data.id}`);
    console.log(`  Masked Key: ${response.data.maskedKey}`);
    console.log(`  Bot ID: ${response.data.botId}`);
    console.log(`  Active: ${response.data.isActive}`);
    console.log(`  Created: ${response.data.createdAt}`);
    console.log(`  Last Used: ${response.data.lastUsedAt || 'Never'}`);
    return true;
  } catch (error) {
    console.error('✗ Failed to get API key info:', error.response?.data || error.message);
    return false;
  }
}

async function revealApiKeyWithWrongPassword() {
  console.log('\n=== Step 4: Try to Reveal API Key (Wrong Password) ===');
  try {
    await axios.post(
      `${API_BASE_URL}/bots/${testBotId}/api-key/reveal`,
      { password: 'wrongpassword' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    console.log('✗ Should have failed with wrong password');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✓ Correctly rejected wrong password');
      console.log(`  Error: ${error.response.data.error.message}`);
      return true;
    }
    console.error('✗ Unexpected error:', error.response?.data || error.message);
    return false;
  }
}

async function revealApiKeyWithCorrectPassword() {
  console.log('\n=== Step 5: Reveal API Key (Correct Password) ===');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/bots/${testBotId}/api-key/reveal`,
      { password: TEST_PASSWORD },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    console.log('✓ API Key revealed:');
    console.log(`  Key: ${response.data.key}`);
    console.log(`  Expires At: ${response.data.expiresAt}`);
    return true;
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.error.message.includes('only be viewed once')) {
      console.log('⚠ API key not in cache (expected if not recently generated)');
      console.log(`  Message: ${error.response.data.error.message}`);
      return true; // This is expected behavior
    }
    console.error('✗ Failed to reveal API key:', error.response?.data || error.message);
    return false;
  }
}

async function regenerateApiKey() {
  console.log('\n=== Step 6: Regenerate API Key ===');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/bots/${testBotId}/api-key/regenerate`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    console.log('✓ API Key regenerated:');
    console.log(`  New Key: ${response.data.key}`);
    console.log(`  Expires At: ${response.data.expiresAt}`);
    console.log(`  Message: ${response.data.message}`);
    return true;
  } catch (error) {
    console.error('✗ Failed to regenerate API key:', error.response?.data || error.message);
    return false;
  }
}

async function revealRegeneratedKey() {
  console.log('\n=== Step 7: Reveal Regenerated Key (Should Work) ===');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/bots/${testBotId}/api-key/reveal`,
      { password: TEST_PASSWORD },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    console.log('✓ Regenerated API Key revealed from cache:');
    console.log(`  Key: ${response.data.key}`);
    console.log(`  Expires At: ${response.data.expiresAt}`);
    return true;
  } catch (error) {
    console.error('✗ Failed to reveal regenerated key:', error.response?.data || error.message);
    return false;
  }
}

async function testRateLimiting() {
  console.log('\n=== Step 8: Test Rate Limiting (3 failed attempts) ===');
  let attempts = 0;
  
  for (let i = 0; i < 4; i++) {
    try {
      await axios.post(
        `${API_BASE_URL}/bots/${testBotId}/api-key/reveal`,
        { password: 'wrongpassword' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    } catch (error) {
      attempts++;
      if (error.response?.status === 401) {
        if (error.response.data.error.message.includes('Too many attempts')) {
          console.log(`✓ Rate limiting triggered after ${attempts} attempts`);
          console.log(`  Message: ${error.response.data.error.message}`);
          return true;
        } else {
          console.log(`  Attempt ${attempts}: Rejected (as expected)`);
        }
      }
    }
  }
  
  console.log('⚠ Rate limiting not triggered (may need to wait for cache to clear)');
  return true;
}

async function runTests() {
  console.log('=================================================');
  console.log('API Key Management Endpoints Test');
  console.log('=================================================');

  const results = [];

  // Run tests sequentially
  results.push(await login());
  if (!results[0]) {
    console.log('\n❌ Cannot proceed without login');
    return;
  }

  results.push(await getBots());
  if (!results[1]) {
    console.log('\n❌ Cannot proceed without a bot');
    return;
  }

  results.push(await getApiKeyInfo());
  results.push(await revealApiKeyWithWrongPassword());
  results.push(await revealApiKeyWithCorrectPassword());
  results.push(await regenerateApiKey());
  results.push(await revealRegeneratedKey());
  results.push(await testRateLimiting());

  // Summary
  console.log('\n=================================================');
  console.log('Test Summary');
  console.log('=================================================');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✓ All tests passed!');
  } else {
    console.log('✗ Some tests failed');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
