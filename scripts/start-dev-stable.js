/**
 * Stable Development Startup Script
 * 
 * This script starts the API server and worker in separate processes.
 * The API server restarts on code changes (via nodemon), while the worker
 * process remains stable, keeping bot connections alive.
 * 
 * Benefits:
 * - Bot connections stay active during development
 * - No need to reconnect bots after code changes
 * - Better development experience
 * 
 * Usage: npm run dev
 */

const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${color}${colors.bright}${prefix}${colors.reset} ${message}`);
}

console.log('\n' + colors.cyan + colors.bright + '🚀 Starting WhatsApp API Platform in STABLE mode...' + colors.reset + '\n');
console.log(colors.yellow + '📝 Note: API server will restart on code changes, but bots will stay connected!' + colors.reset + '\n');

let apiProcess = null;
let workerProcess = null;
let isShuttingDown = false;

// Start API Server with nodemon
function startAPI() {
  log(colors.blue, '📡 [API]', 'Starting API Server with nodemon...');
  
  apiProcess = spawn('npx', ['nodemon'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      WORKER_ENABLED: 'false',
      PORT: process.env.PORT || '3000',
    },
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  apiProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${colors.blue}[API]${colors.reset} ${line}`);
      }
    });
  });

  apiProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${colors.red}[API ERROR]${colors.reset} ${line}`);
      }
    });
  });

  apiProcess.on('error', (error) => {
    log(colors.red, '❌ [API]', `Error: ${error.message}`);
  });

  apiProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      log(colors.red, '📡 [API]', `Exited with code ${code}`);
      shutdown(code);
    }
  });
}

// Start Worker Process with ts-node-dev
function startWorker() {
  log(colors.green, '⚙️  [WORKER]', 'Starting Worker Process...');
  
  workerProcess = spawn(
    'npx',
    [
      'ts-node-dev',
      '--respawn',
      '--transpile-only',
      '--watch', 'src/workers',
      '--watch', 'src/services/worker-baileys.manager.ts',
      'src/workers/message.worker.ts'
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: 'development',
        WORKER_ENABLED: 'true',
      },
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    }
  );

  workerProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${colors.green}[WORKER]${colors.reset} ${line}`);
      }
    });
  });

  workerProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${colors.red}[WORKER ERROR]${colors.reset} ${line}`);
      }
    });
  });

  workerProcess.on('error', (error) => {
    log(colors.red, '❌ [WORKER]', `Error: ${error.message}`);
  });

  workerProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      log(colors.red, '⚙️  [WORKER]', `Exited with code ${code}`);
      shutdown(code);
    }
  });
}

// Graceful shutdown
function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n' + colors.yellow + colors.bright + '🛑 Shutting down gracefully...' + colors.reset + '\n');

  // Kill processes
  if (apiProcess) {
    log(colors.blue, '📡 [API]', 'Stopping...');
    apiProcess.kill('SIGTERM');
  }

  if (workerProcess) {
    log(colors.green, '⚙️  [WORKER]', 'Stopping...');
    workerProcess.kill('SIGTERM');
  }

  // Force exit after 10 seconds
  setTimeout(() => {
    log(colors.red, '⚠️', 'Force shutdown after timeout');
    process.exit(exitCode);
  }, 10000);

  // Wait a bit for graceful shutdown
  setTimeout(() => {
    log(colors.green, '✅', 'Shutdown complete');
    process.exit(exitCode);
  }, 2000);
}

// Handle signals
process.on('SIGINT', () => {
  log(colors.yellow, '⚠️', 'Received SIGINT (Ctrl+C)');
  shutdown(0);
});

process.on('SIGTERM', () => {
  log(colors.yellow, '⚠️', 'Received SIGTERM');
  shutdown(0);
});

// Start both processes
startAPI();

// Wait 2 seconds before starting worker to ensure API is ready
setTimeout(() => {
  startWorker();
  
  console.log('\n' + colors.green + colors.bright + '✅ Services started successfully!' + colors.reset);
  console.log(colors.cyan + '📝 API Server: http://localhost:' + (process.env.PORT || '3000') + colors.reset);
  console.log(colors.cyan + '📝 Worker: Managing bot connections' + colors.reset);
  console.log(colors.yellow + '📝 Press Ctrl+C to stop all services' + colors.reset + '\n');
}, 2000);
