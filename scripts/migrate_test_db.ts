import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

import { ensureBootstrapFixtures } from '../database/bootstrap-fixtures';

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  console.error('TEST_DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: testDbUrl });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
    );
    const files = readdirSync('database/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file]
      );
      if (rowCount) {
        console.log(`[test-db] skip  ${file}`);
        continue;
      }
      await ensureBootstrapFixtures(client);
      const sql = readFileSync(resolve('database/migrations', file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[test-db] apply ${file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    await ensureBootstrapFixtures(client);
  } finally {
    client.release();
    await pool.end();
  }
}

run()
  .then(() => console.log('[test-db] ALL MIGRATIONS APPLIED TO TEST DB'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
