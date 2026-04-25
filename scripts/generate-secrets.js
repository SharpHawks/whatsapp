#!/usr/bin/env node

/**
 * Generate secure random secrets for JWT and other configurations
 * Usage: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('\n=== Security Secrets Generator ===\n');
console.log('Copy these values to your .env file:\n');

console.log('# JWT Secrets (64 bytes = 128 hex characters)');
console.log(`JWT_SECRET=${crypto.randomBytes(64).toString('hex')}`);
console.log(`JWT_REFRESH_SECRET=${crypto.randomBytes(64).toString('hex')}`);

console.log('\n# Redis Password (32 bytes = 64 hex characters)');
console.log(`REDIS_PASSWORD=${crypto.randomBytes(32).toString('hex')}`);

console.log('\n# Database Password (generate a strong password)');
const dbPassword = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
console.log(`DB_PASSWORD=${dbPassword}`);

console.log('\n# API Key Salt (for additional security)');
console.log(`API_KEY_SALT=${crypto.randomBytes(32).toString('hex')}`);

console.log('\n=== IMPORTANT ===');
console.log('1. Never commit these secrets to version control');
console.log('2. Use different secrets for development and production');
console.log('3. Store production secrets in a secure vault (e.g., AWS Secrets Manager)');
console.log('4. Rotate secrets regularly (every 90 days recommended)');
console.log('5. Update docker-compose.yml with the new REDIS_PASSWORD\n');
