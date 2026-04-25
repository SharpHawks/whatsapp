const amqp = require('amqplib');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = process.env.RABBITMQ_QUEUE_NAME || 'whatsapp_messages';

async function purgeQueue() {
  let connection;
  let channel;

  try {
    console.log('🔌 Connecting to RabbitMQ...');
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    console.log(`🗑️  Purging queue: ${QUEUE_NAME}`);
    const result = await channel.purgeQueue(QUEUE_NAME);
    
    console.log(`✅ Purged ${result.messageCount} messages from queue`);

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (channel) await channel.close();
    if (connection) await connection.close();
    process.exit(1);
  }
}

purgeQueue();
