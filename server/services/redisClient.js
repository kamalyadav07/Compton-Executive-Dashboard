/**
 * server/services/redisClient.js
 * -----------------------------------------------------------------------
 * Redis Connection & Distributed Lock Manager.
 *
 * Supports:
 *   - Upstash Redis / Standard Redis connection via ioredis
 *   - In-memory / Mock fallback for offline or local development
 *   - Atomic Distributed Mutex Locks (SET NX PX)
 *   - Key-value cache with TTL
 */

const Redis = require('ioredis');

let redisClient = null;
let isRedisAvailable = false;

// In-memory fallback map for offline mode
const memoryStore = new Map();
const memoryLocks = new Map();

function initRedis() {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

  if (redisUrl && redisUrl.startsWith('redis')) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('[redisClient] Redis unreachable after 3 attempts. Falling back to local memory store.');
            return null; // Stop retrying
          }
          return Math.min(times * 500, 2000);
        }
      });

      redisClient.on('connect', () => {
        isRedisAvailable = true;
        console.log('⚡ Connected to Redis successfully.');
      });

      redisClient.on('error', (err) => {
        isRedisAvailable = false;
        // Suppress repeated connection logs
      });
    } catch (err) {
      console.warn('[redisClient] Initialization notice, using memory fallback:', err.message);
      isRedisAvailable = false;
    }
  } else {
    // No Redis URL configured — use graceful in-memory storage
    isRedisAvailable = false;
  }
}

initRedis();

/**
 * Acquire an atomic distributed lock.
 *
 * @param {string} lockKey - e.g. "lock:bitrix_sync"
 * @param {number} [ttlMs=60000] - Lock expiration in milliseconds
 * @returns {Promise<boolean>} True if lock acquired, false if already held
 */
async function acquireLock(lockKey, ttlMs = 60000) {
  if (isRedisAvailable && redisClient) {
    try {
      const result = await redisClient.set(lockKey, 'locked', 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (_) {
      // Fall through to memory store
    }
  }

  // In-Memory Fallback
  const now = Date.now();
  const existingExpiry = memoryLocks.get(lockKey);
  if (existingExpiry && existingExpiry > now) {
    return false;
  }
  memoryLocks.set(lockKey, now + ttlMs);
  return true;
}

/**
 * Release an atomic distributed lock.
 */
async function releaseLock(lockKey) {
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.del(lockKey);
      return;
    } catch (_) {}
  }
  memoryLocks.delete(lockKey);
}

/**
 * Cache helpers
 */
async function getCache(key) {
  if (isRedisAvailable && redisClient) {
    try {
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : null;
    } catch (_) {}
  }

  const item = memoryStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return item.data;
}

async function setCache(key, data, ttlSeconds = 300) {
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
      return;
    } catch (_) {}
  }

  memoryStore.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

async function delCache(key) {
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (_) {}
  }
  memoryStore.delete(key);
}

module.exports = {
  acquireLock,
  releaseLock,
  getCache,
  setCache,
  delCache,
  isRedisAvailable: () => isRedisAvailable
};
