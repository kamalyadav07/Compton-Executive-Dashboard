/**
 * server/db/migrate.js
 * -----------------------------------------------------------------------
 * Lightweight PostgreSQL Migration Runner.
 * Executes migrations in server/db/migrations/ sequentially and tracks
 * execution status in the `schema_migrations` table.
 *
 * Usage:
 *   node server/db/migrate.js
 *   npm run db:migrate
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function runMigrations() {
  console.log('🚀 Starting PostgreSQL Database Migration...');
  const client = await pool.connect();

  try {
    // 1. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Discover all .sql migration files
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('❌ Migrations directory not found:', migrationsDir);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration file(s) in server/db/migrations/`);

    // 3. Fetch already-applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM schema_migrations');
    const appliedSet = new Set(appliedRows.map(r => r.name));

    let appliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ⏭️  Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`  ▶️  Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      const startTime = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        const duration = Date.now() - startTime;
        console.log(`  ✅ Successfully applied: ${file} (${duration}ms)`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Failed applying ${file}:`, err.message);
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log('✨ Database is already up to date. No new migrations to apply.');
    } else {
      console.log(`🎉 Successfully applied ${appliedCount} migration(s).`);
    }
  } catch (err) {
    console.error('💥 Migration process aborted:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
