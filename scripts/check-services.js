/**
 * Check if required services are running
 */

const { exec } = require('child_process');
const net = require('net');

console.log('🔍 Checking required services...\n');

// Check if port is open
function checkPort(port, name) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(2000);
    
    socket.on('connect', () => {
      console.log(`✅ ${name} is running on port ${port}`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`❌ ${name} is NOT running on port ${port}`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      console.log(`❌ ${name} is NOT running on port ${port}`);
      resolve(false);
    });
    
    socket.connect(port, 'localhost');
  });
}

async function checkServices() {
  const results = {
    postgres: await checkPort(5432, 'PostgreSQL'),
    redis: await checkPort(6379, 'Redis'),
    rabbitmq: await checkPort(5672, 'RabbitMQ'),
  };
  
  console.log('\n📊 Summary:');
  console.log('─────────────────────────────');
  
  const allRunning = Object.values(results).every(r => r);
  
  if (allRunning) {
    console.log('✅ All required services are running!');
    console.log('\n🚀 You can now start the application:');
    console.log('   npm run build');
    console.log('   npm run dev:full');
  } else {
    console.log('⚠️  Some services are not running.');
    console.log('\n📝 Installation guides:');
    
    if (!results.postgres) {
      console.log('\n PostgreSQL:');
      console.log('   Windows: https://www.postgresql.org/download/windows/');
      console.log('   Or use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres');
    }
    
    if (!results.redis) {
      console.log('\n Redis:');
      console.log('   Windows: https://github.com/microsoftarchive/redis/releases');
      console.log('   Or use Docker: docker run -d -p 6379:6379 redis');
    }
    
    if (!results.rabbitmq) {
      console.log('\n RabbitMQ:');
      console.log('   Windows: https://www.rabbitmq.com/install-windows.html');
      console.log('   Or use Docker: docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:management');
    }
    
    console.log('\n💡 Quick Docker setup (if you have Docker):');
    console.log('   docker-compose up -d');
  }
  
  console.log('\n');
}

checkServices();
