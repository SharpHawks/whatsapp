#!/bin/bash

# CORS Diagnostic Script for Production Server
# This script checks CORS headers and Socket.IO connectivity

SERVER_URL="${1:-http://localhost:3000}"
FRONTEND_ORIGIN="${2:-https://yourdomain.com}"

echo "🔍 Checking CORS configuration..."
echo "Server: $SERVER_URL"
echo "Frontend Origin: $FRONTEND_ORIGIN"
echo "---"

# Test 1: Check health endpoint
echo "Test 1: Health Check"
curl -i "$SERVER_URL/health" 2>&1 | head -20
echo ""

# Test 2: Check CORS headers with OPTIONS request
echo "Test 2: CORS Preflight (OPTIONS)"
curl -i -X OPTIONS "$SERVER_URL/api/v1/auth/login" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" 2>&1 | head -20
echo ""

# Test 3: Check Socket.IO endpoint
echo "Test 3: Socket.IO Endpoint"
curl -i "$SERVER_URL/socket.io/?EIO=4&transport=polling" \
  -H "Origin: $FRONTEND_ORIGIN" 2>&1 | head -20
echo ""

echo "---"
echo "✅ Diagnostic complete!"
echo ""
echo "Look for these headers in the responses:"
echo "  - Access-Control-Allow-Origin: $FRONTEND_ORIGIN"
echo "  - Access-Control-Allow-Credentials: true"
echo ""
echo "If headers are missing, check:"
echo "  1. CORS_ORIGINS environment variable on server"
echo "  2. Socket.IO CORS configuration"
echo "  3. Nginx/reverse proxy configuration"
