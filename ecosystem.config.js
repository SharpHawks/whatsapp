/**
 * PM2 Configuration for WhatsApp API Platform
 * 
 * This configuration runs two separate processes:
 * 1. api-server: Main API process (WORKER_ENABLED=false)
 *    - Handles HTTP/WebSocket requests
 *    - Coordinates bot actions via Redis events
 *    - Runs in cluster mode with 2 instances
 * 
 * 2. message-worker: Worker process (WORKER_ENABLED=true)
 *    - Manages all WhatsApp connections
 *    - Processes message queue
 *    - Handles connection lifecycle
 *    - Runs in fork mode with 1 instance
 * 
 * Process Management Commands:
 * - Start all: pm2 start ecosystem.config.js
 * - Start API only: pm2 start ecosystem.config.js --only api-server
 * - Start worker only: pm2 start ecosystem.config.js --only message-worker
 * - Stop all: pm2 stop all
 * - Restart all: pm2 restart all
 * - View logs: pm2 logs
 * - Monitor: pm2 monit
 */
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: 'dist/index.js',
      instances: 2, // Run 2 instances for load balancing
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        WORKER_ENABLED: 'false', // Main API mode - no Baileys connections
      },
      env_development: {
        NODE_ENV: 'development',
        WORKER_ENABLED: 'false',
      },
      error_file: 'logs/api-server-error.log',
      out_file: 'logs/api-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'message-worker',
      script: 'dist/workers/message.worker.js',
      instances: 1, // Single worker instance to avoid connection conflicts
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_ENABLED: 'true', // Worker mode - manages all Baileys connections
      },
      env_development: {
        NODE_ENV: 'development',
        WORKER_ENABLED: 'true',
      },
      error_file: 'logs/message-worker-error.log',
      out_file: 'logs/message-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 60000, // 60 seconds for graceful shutdown
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],
};
