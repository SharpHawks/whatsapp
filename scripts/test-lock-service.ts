import { lockService } from '../src/services/lock.service';
import { logger } from '../src/utils/logger';

async function testLockService() {
  try {
    logger.info('Starting lock service test...');

    // Connect to Redis
    await lockService.connect();
    logger.info('Connected to Redis');

    // Test 1: Acquire lock
    logger.info('\n=== Test 1: Acquire Lock ===');
    const lockId1 = await lockService.acquireLock('test:resource:1', 10000);
    if (lockId1) {
      logger.info(`✓ Lock acquired successfully: ${lockId1}`);
    } else {
      logger.error('✗ Failed to acquire lock');
    }

    // Test 2: Try to acquire same lock (should fail)
    logger.info('\n=== Test 2: Try to Acquire Same Lock ===');
    const lockId2 = await lockService.acquireLock('test:resource:1', 10000);
    if (!lockId2) {
      logger.info('✓ Correctly prevented duplicate lock acquisition');
    } else {
      logger.error('✗ Should not have acquired lock');
    }

    // Test 3: Check if locked
    logger.info('\n=== Test 3: Check Lock Status ===');
    const isLocked = await lockService.isLocked('test:resource:1');
    if (isLocked) {
      logger.info('✓ Lock status correctly reported as locked');
    } else {
      logger.error('✗ Lock status should be locked');
    }

    // Test 4: Extend lock
    logger.info('\n=== Test 4: Extend Lock ===');
    if (lockId1) {
      const extended = await lockService.extendLock('test:resource:1', lockId1, 15000);
      if (extended) {
        logger.info('✓ Lock extended successfully');
      } else {
        logger.error('✗ Failed to extend lock');
      }
    }

    // Test 5: Release lock
    logger.info('\n=== Test 5: Release Lock ===');
    if (lockId1) {
      const released = await lockService.releaseLock('test:resource:1', lockId1);
      if (released) {
        logger.info('✓ Lock released successfully');
      } else {
        logger.error('✗ Failed to release lock');
      }
    }

    // Test 6: Verify lock is released
    logger.info('\n=== Test 6: Verify Lock Released ===');
    const isStillLocked = await lockService.isLocked('test:resource:1');
    if (!isStillLocked) {
      logger.info('✓ Lock correctly released');
    } else {
      logger.error('✗ Lock should be released');
    }

    // Test 7: Acquire lock again (should succeed now)
    logger.info('\n=== Test 7: Acquire Lock Again ===');
    const lockId3 = await lockService.acquireLock('test:resource:1', 10000);
    if (lockId3) {
      logger.info(`✓ Lock re-acquired successfully: ${lockId3}`);
      await lockService.releaseLock('test:resource:1', lockId3);
    } else {
      logger.error('✗ Should have acquired lock');
    }

    // Test 8: Multiple locks
    logger.info('\n=== Test 8: Multiple Locks ===');
    const lock1 = await lockService.acquireLock('test:resource:a', 10000);
    const lock2 = await lockService.acquireLock('test:resource:b', 10000);
    const lock3 = await lockService.acquireLock('test:resource:c', 10000);
    
    if (lock1 && lock2 && lock3) {
      logger.info('✓ Multiple locks acquired successfully');
      const heldLocks = lockService.getHeldLocks();
      logger.info(`  Held locks: ${heldLocks.length}`);
      
      // Release all
      await lockService.releaseAllLocks();
      const remainingLocks = lockService.getHeldLocks();
      if (remainingLocks.length === 0) {
        logger.info('✓ All locks released successfully');
      } else {
        logger.error('✗ Some locks were not released');
      }
    } else {
      logger.error('✗ Failed to acquire multiple locks');
    }

    // Test 9: Health check
    logger.info('\n=== Test 9: Health Check ===');
    const healthy = await lockService.healthCheck();
    if (healthy) {
      logger.info('✓ Lock service is healthy');
    } else {
      logger.error('✗ Lock service health check failed');
    }

    logger.info('\n=== All Tests Completed ===');

    // Cleanup
    await lockService.disconnect();
    logger.info('Disconnected from Redis');

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

testLockService();
