import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { ensureBootstrapFixtures } from '../database/bootstrap-fixtures';

const testDatabaseUrl = 'postgresql://finverse:mPXSxTCBd50QMJYgGND2UpHZ98fK13qn@localhost:5433/finverse_test';
const MIGRATIONS_DIR = resolve(__dirname, '../database/migrations');

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: testDatabaseUrl });
  const client = await pool.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file]
      );
      if (rowCount) {
        console.log(`[migrate-test] skip   ${file}`);
        continue;
      }
      await ensureBootstrapFixtures(client);
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate-test] apply  ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    await ensureBootstrapFixtures(client);
    console.log('[migrate-test] done');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate-test] FAILED:', err);
  process.exit(1);
});
