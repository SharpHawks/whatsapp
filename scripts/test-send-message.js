const axios = require('axios');

const API_URL = 'http://localhost:3000';
const RECIPIENT_PHONE = '+37128344474';

async function testSendMessage() {
  console.log('📤 Testing message sending...\n');

  try {
    // 1. Use generated API key
    const botId = 'dd186384-e89c-43d6-8d18-fe640c898317'; // Connected bot
    const apiKey = 'sk_2a4629ce3d315468f33a6653906e7df94945afc722022ded8372d070826af33a';
    
    console.log('1️⃣  Using API key for bot:', botId);

    // 2. Send message
    console.log('2️⃣  Sending message...');
    console.log(`   To: ${RECIPIENT_PHONE}`);
    console.log(`   Message: "Hello from WhatsApp API Platform! 🚀"`);

    const messageResponse = await axios.post(
      `${API_URL}/api/v1/messages/send`,
      {
        to: RECIPIENT_PHONE,
        type: 'text',
        content: {
          text: 'Hello from WhatsApp API Platform! 🚀\n\nThis is a test message sent via the API.'
        }
      },
      {
        headers: {
          'X-API-Key': apiKey,
        },
        validateStatus: () => true,
      }
    );

    if (messageResponse.status === 200 || messageResponse.status === 201) {
      console.log('\n✅ Message sent successfully!');
      console.log('   Message ID:', messageResponse.data.messageId);
      console.log('   Status:', messageResponse.data.status);
      console.log('\n🎉 Check your WhatsApp for the message!');
    } else {
      console.log('\n❌ Failed to send message');
      console.log('   Status:', messageResponse.status);
      console.log('   Response:', JSON.stringify(messageResponse.data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSendMessage();
