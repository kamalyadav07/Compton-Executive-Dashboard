# Compton Dashboard Database & Migrations Guide

This guide explains how to set up **PostgreSQL with pgvector** using a free managed cloud provider (Supabase or Neon) or local PostgreSQL, and run schema migrations.

---

## 1. Quick Setup: Provisioning a Free Managed Postgres with `pgvector`

### Option A: Supabase (Recommended - Free Tier)
Supabase provides a generous free PostgreSQL instance (500MB storage, unlimited API calls) with `pgvector` enabled out of the box.

1. Go to [https://supabase.com](https://supabase.com) and create a free project (e.g. `compton-dashboard`).
2. Go to **Project Settings** → **Database** → **Connection String**.
3. Under **URI**, select **Transaction Pooler** (Port `6543`) or **Direct Connection** (Port `5432`).
4. Copy the connection URI:
   ```env
   DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
   ```
5. Paste this `DATABASE_URL` into your `server/.env` (and root `.env` if desired).

### Option B: Neon (Alternative - Free Tier)
Neon provides a serverless PostgreSQL instance with `pgvector` pre-installed.

1. Go to [https://neon.tech](https://neon.tech) and create a free database.
2. On the Neon Console dashboard, copy the **Connection string** (Pooled or Direct):
   ```env
   DATABASE_URL="postgresql://[user]:[password]@[endpoint-pooler].neon.tech/[dbname]?sslmode=require"
   ```
3. Paste this `DATABASE_URL` into your `server/.env`.

### Option C: Local PostgreSQL (with Docker)
If you prefer running PostgreSQL with `pgvector` locally:

```bash
docker run -d \
  --name compton-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=compton_db \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

Then in `server/.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compton_db"
```

---

## 2. Environment Configuration

Ensure your `server/.env` contains the `DATABASE_URL`:

```env
# PostgreSQL Database Connection String
DATABASE_URL="postgresql://postgres:password@your-host:5432/postgres?sslmode=require"
```

---

## 3. Running Database Migrations

### Run Migrations via npm
From the project root:
```bash
npm run db:migrate
```

Or from the `server/` directory:
```bash
cd server
npm run db:migrate
```

### Direct Migration CLI Execution
```bash
node server/db/migrate.js
```

### What Happens During Migration:
1. Connects to PostgreSQL using SSL automatically if a remote provider (Supabase/Neon) is detected.
2. Verifies / creates the `schema_migrations` tracking table.
3. Automatically enables extensions:
   - `uuid-ossp` (UUID generators)
   - `vector` (pgvector for semantic search)
   - `pg_trgm` (Trigram fuzzy text search)
4. Executes all unapplied `.sql` scripts in `server/db/migrations/` sequentially inside ACID transactions.
5. Sets up the HNSW index on `document_chunks (embedding vector_cosine_ops)`.
6. Attaches automatic `updated_at` timestamp triggers to all mutable tables.

---

## 4. Directory Structure

```
server/db/
├── index.js                     # PostgreSQL connection pool with SSL detection
├── migrate.js                   # Migration runner script with execution tracking
├── SCHEMA.md                    # Complete ERD diagram and data dictionary
├── README.md                    # Setup and operational instructions
└── migrations/
    └── 001_initial_schema.sql   # Complete DDL for all 18 core tables & indexes
```

---

## 5. Adding New Migrations

To add a new migration in the future:
1. Create a new file in `server/db/migrations/` following the naming convention:
   `002_add_new_feature_table.sql`
2. Write your standard PostgreSQL DDL statements.
3. Run `npm run db:migrate`. The runner will detect the new file, execute it inside a transaction, and record it in `schema_migrations`.
