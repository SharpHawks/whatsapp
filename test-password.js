const bcrypt = require('bcrypt');

const password = 'edgars1213'; // Пароль, который вы вводите
const hash = '$2b$10$jGnboVNi5OYOft1HBxSAruadx4bUKYJLzNWKH9.UGVbNKy1Yb3ruy'; // Хеш из базы

bcrypt.compare(password, hash, (err, result) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('Password match:', result);
  if (result) {
    console.log('✅ Password is CORRECT');
  } else {
    console.log('❌ Password is INCORRECT');
  }
});
