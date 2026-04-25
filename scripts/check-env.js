const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

require('dotenv').config();

const checks = {
  nodejs: { name: 'Node.js', required: true },
  npm: { name: 'npm', required: true },
  postgres: { name: 'PostgreSQL', required: true },
  redis: { name: 'Redis', required: false },
  git: { name: 'Git', required: true },
};

async function checkCommand(command) {
  try {
    await execAsync(`${command} --version`);
    return true;
  } catch {
    return false;
  }
}

async function checkPostgres() {
  try {
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: 'postgres',
    });
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function checkRedis() {
  try {
    const redis = require('redis');
    const client = redis.createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
    });
    await client.connect();
    await client.quit();
    return true;
  } catch {
    return false;
  }
}

async function checkEnvironment() {
  console.log('🔍 Checking environment...\n');

  const results = {};

  // Check Node.js
  results.nodejs = await checkCommand('node');
  console.log(`${results.nodejs ? '✅' : '❌'} Node.js ${results.nodejs ? '(installed)' : '(missing)'}`);

  // Check npm
  results.npm = await checkCommand('npm');
  console.log(`${results.npm ? '✅' : '❌'} npm ${results.npm ? '(installed)' : '(missing)'}`);

  // Check Git
  results.git = await checkCommand('git');
  console.log(`${results.git ? '✅' : '❌'} Git ${results.git ? '(installed)' : '(missing)'}`);

  // Check PostgreSQL
  results.postgres = await checkPostgres();
  console.log(`${results.postgres ? '✅' : '❌'} PostgreSQL ${results.postgres ? '(running)' : '(not running or wrong credentials)'}`);

  // Check Redis (optional)
  results.redis = await checkRedis();
  console.log(`${results.redis ? '✅' : '⚠️ '} Redis ${results.redis ? '(running)' : '(not running - optional)'}`);

  // Check .env file
  const envExists = fs.existsSync(path.join(__dirname, '../.env'));
  console.log(`${envExists ? '✅' : '❌'} .env file ${envExists ? '(exists)' : '(missing)'}`);

  // Check frontend .env
  const frontendEnvExists = fs.existsSync(path.join(__dirname, '../frontend/.env'));
  console.log(`${frontendEnvExists ? '✅' : '⚠️ '} frontend/.env ${frontendEnvExists ? '(exists)' : '(missing - will use defaults)'}`);

  // Check node_modules
  const nodeModulesExists = fs.existsSync(path.join(__dirname, '../node_modules'));
  console.log(`${nodeModulesExists ? '✅' : '❌'} node_modules ${nodeModulesExists ? '(installed)' : '(missing - run npm install)'}`);

  // Check frontend node_modules
  const frontendNodeModulesExists = fs.existsSync(path.join(__dirname, '../frontend/node_modules'));
  console.log(`${frontendNodeModulesExists ? '✅' : '❌'} frontend/node_modules ${frontendNodeModulesExists ? '(installed)' : '(missing - run cd frontend && npm install)'}`);

  console.log('\n📋 Summary:');
  
  const allRequired = results.nodejs && results.npm && results.postgres && results.git && envExists && nodeModulesExists;
  
  if (allRequired) {
    console.log('✅ All required dependencies are installed!');
    console.log('\n🚀 Ready to start:');
    console.log('  1. Run database setup: npm run setup:db');
    console.log('  2. Start backend: npm run dev');
    console.log('  3. Start frontend: cd frontend && npm run dev');
  } else {
    console.log('❌ Some required dependencies are missing');
    console.log('\n📝 Action items:');
    
    if (!results.nodejs || !results.npm) {
      console.log('  - Install Node.js from https://nodejs.org/');
    }
    if (!results.git) {
      console.log('  - Install Git from https://git-scm.com/');
    }
    if (!results.postgres) {
      console.log('  - Install PostgreSQL from https://www.postgresql.org/download/');
      console.log('  - Or check your database credentials in .env');
    }
    if (!envExists) {
      console.log('  - Create .env file (copy from .env.example or SETUP.md)');
    }
    if (!nodeModulesExists) {
      console.log('  - Run: npm install');
    }
    if (!frontendNodeModulesExists) {
      console.log('  - Run: cd frontend && npm install');
    }
  }

  if (!results.redis) {
    console.log('\n⚠️  Redis is not running (optional):');
    console.log('  - Install Redis for caching (improves performance)');
    console.log('  - Or the app will work without it');
  }

  process.exit(allRequired ? 0 : 1);
}

checkEnvironment().catch(console.error);
