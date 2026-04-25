/**
 * Development startup script
 * Starts API server and worker in separate processes
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting WhatsApp API Platform in development mode...\n');

// Start API Server
console.log('📡 Starting API Server...');
const apiServer = spawn('node', ['dist/index.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    WORKER_ENABLED: 'false',
    PORT: '3000',
  },
  stdio: 'inherit',
  shell: true,
});

// Wait a bit before starting worker
setTimeout(() => {
  console.log('\n⚙️  Starting Message Worker...');
  const worker = spawn('node', ['dist/workers/message.worker.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      WORKER_ENABLED: 'true',
    },
    stdio: 'inherit',
    shell: true,
  });

  worker.on('error', (error) => {
    console.error('❌ Worker error:', error);
  });

  worker.on('exit', (code) => {
    console.log(`⚙️  Worker exited with code ${code}`);
    process.exit(code);
  });
}, 2000);

apiServer.on('error', (error) => {
  console.error('❌ API Server error:', error);
});

apiServer.on('exit', (code) => {
  console.log(`📡 API Server exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  apiServer.kill('SIGTERM');
  process.exit(0);
});

console.log('\n✅ Services starting...');
console.log('📝 API Server: http://localhost:3000');
console.log('📝 Press Ctrl+C to stop\n');
