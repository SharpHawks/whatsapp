// Скрипт для проверки JWT токена
// Использование: npx ts-node scripts/check-token.ts "YOUR_TOKEN_HERE"

const token = process.argv[2];

if (!token) {
  console.log('Usage: npx ts-node scripts/check-token.ts "YOUR_TOKEN_HERE"');
  process.exit(1);
}

try {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  console.log('\n=== JWT Token Payload ===');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n=== User Info ===');
  console.log(`User ID: ${payload.userId}`);
  console.log(`Email: ${payload.email || 'NOT IN TOKEN'}`);
  console.log(`Role: ${payload.role || 'NOT IN TOKEN'}`);
  console.log(`\nExpires: ${new Date(payload.exp * 1000).toLocaleString()}`);
} catch (error) {
  console.error('Error decoding token:', error);
  process.exit(1);
}
