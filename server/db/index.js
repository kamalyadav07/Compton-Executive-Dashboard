/**
 * server/db/index.js
 * -----------------------------------------------------------------------
 * PostgreSQL connection pool with pgvector and SSL support.
 * Configured for managed providers (Supabase / Neon) and local Postgres.
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Ensure environment variables are loaded
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../../.env');
  const serverEnvPath = path.resolve(__dirname, '../.env');
  
  [envPath, serverEnvPath].forEach(p => {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
        }
      });
    }
  });
}

const connectionString = (process.env.DATABASE_URL || '').trim();
const hasExplicitHost = Boolean(process.env.DB_HOST && process.env.DB_USER);
const isDatabaseConfigured = Boolean(connectionString || hasExplicitHost);

// Detect if SSL is required (Supabase, Neon, AWS RDS, etc.)
const isRemoteDatabase = connectionString.includes('supabase.co') || 
                         connectionString.includes('neon.tech') || 
                         connectionString.includes('pooler.supabase.com') ||
                         process.env.DB_SSL === 'true';

let pool;

if (isDatabaseConfigured) {
  const poolConfig = {
    connectionString: connectionString || undefined,
    ssl: isRemoteDatabase ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  };

  if (!connectionString) {
    poolConfig.user = process.env.DB_USER;
    poolConfig.host = process.env.DB_HOST;
    poolConfig.database = process.env.DB_NAME;
    poolConfig.password = process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : '';
    poolConfig.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
  }

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('[Postgres Pool Error]:', err.message);
  });
} else {
  // Safe stub pool when PostgreSQL is not configured
  const notConfiguredError = () => {
    const err = new Error('DATABASE_NOT_CONFIGURED: Set DATABASE_URL in your environment to enable PostgreSQL storage.');
    err.code = 'DATABASE_NOT_CONFIGURED';
    return err;
  };

  pool = {
    query: async () => { throw notConfiguredError(); },
    connect: async () => { throw notConfiguredError(); },
    on: () => {},
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0
  };
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  isDatabaseConfigured: () => isDatabaseConfigured
};
