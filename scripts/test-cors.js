#!/usr/bin/env node

/**
 * CORS Diagnostic Script
 * Tests Socket.IO connection and CORS configuration
 */

const io = require('socket.io-client');

// Get server URL from command line or use default
const serverUrl = process.argv[2] || 'http://localhost:3000';
const token = process.argv[3];

console.log('🔍 Testing Socket.IO connection...');
console.log('Server URL:', serverUrl);
console.log('Token provided:', token ? 'Yes' : 'No');
console.log('---');

if (!token) {
  console.error('❌ Error: No authentication token provided');
  console.log('\nUsage: node scripts/test-cors.js <server-url> <jwt-token>');
  console.log('Example: node scripts/test-cors.js https://yourdomain.com eyJhbGc...');
  process.exit(1);
}

const socket = io(serverUrl, {
  auth: {
    token: token,
  },
  transports: ['websocket', 'polling'],
  reconnection: false,
});

socket.on('connect', () => {
  console.log('✅ Socket connected successfully!');
  console.log('Socket ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('connected', (data) => {
  console.log('✅ Server welcome message received:', data);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('Error type:', error.type);
  console.error('Error description:', error.description);
  
  if (error.message.includes('CORS')) {
    console.log('\n🔧 CORS Issue Detected!');
    console.log('Possible fixes:');
    console.log('1. Check CORS_ORIGINS environment variable on server');
    console.log('2. Ensure your domain is in the allowed origins list');
    console.log('3. Verify Socket.IO CORS configuration matches Express CORS');
  }
  
  if (error.message.includes('Authentication')) {
    console.log('\n🔧 Authentication Issue Detected!');
    console.log('Possible fixes:');
    console.log('1. Check if JWT token is valid and not expired');
    console.log('2. Verify JWT_SECRET matches on server');
  }
  
  socket.disconnect();
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Connection timeout after 10 seconds');
  socket.disconnect();
  process.exit(1);
}, 10000);
