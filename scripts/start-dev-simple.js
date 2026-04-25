/**
 * Simple Development Startup Script
 * 
 * This script starts the server in a single process with nodemon.
 * The server will restart on any code change, which means bots will
 * disconnect and need to reconnect.
 * 
 * Use this mode when:
 * - You want the simplest setup
 * - You're doing quick iterations and don't mind reconnecting bots
 * - You're not actively testing bot connections
 * 
 * For stable bot connections during development, use: npm run dev
 * 
 * Usage: npm run dev:simple
 */

const { spawn } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

console.log('\n' + colors.cyan + colors.bright + '🚀 Starting WhatsApp API Platform in SIMPLE mode...' + colors.reset + '\n');
console.log(colors.yellow + '⚠️  Note: Bots will reconnect on each server restart' + colors.reset);
console.log(colors.yellow + '💡 For stable connections, use: npm run dev' + colors.reset + '\n');

const server = spawn('npx', ['nodemon'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    WORKER_ENABLED: 'false',
    PORT: process.env.PORT || '3000',
  },
  stdio: 'inherit',
  shell: true,
});

server.on('error', (error) => {
  console.error(colors.yellow + '❌ Server error:' + colors.reset, error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(colors.yellow + `\n🛑 Server exited with code ${code}` + colors.reset);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(colors.yellow + '\n\n🛑 Shutting down...' + colors.reset);
  server.kill('SIGTERM');
  process.exit(0);
});

console.log(colors.cyan + '✅ Server starting...' + colors.reset);
console.log(colors.cyan + '📝 API Server: http://localhost:' + (process.env.PORT || '3000') + colors.reset);
console.log(colors.cyan + '📝 Press Ctrl+C to stop' + colors.reset + '\n');
