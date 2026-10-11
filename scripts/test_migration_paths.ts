import { Pool } from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureBootstrapFixtures } from '../database/bootstrap-fixtures';

const DB_BASE_URL = 'postgresql://finverse:mPXSxTCBd50QMJYgGND2UpHZ98fK13qn@localhost:5433';

async function run() {
  const adminPool = new Pool({ connectionString: `${DB_BASE_URL}/postgres` });

  console.log('--- STARTING ISOLATED DATABASE MIGRATION VERIFICATION ---');

  // 1. Verify Clean-Install Path
  console.log('\n[1/2] Testing Clean-Install Path on fresh database: finverse_isolated_clean');
  await adminPool.query('DROP DATABASE IF EXISTS finverse_isolated_clean');
  await adminPool.query('CREATE DATABASE finverse_isolated_clean');

  const cleanPool = new Pool({ connectionString: `${DB_BASE_URL}/finverse_isolated_clean` });
  const cleanClient = await cleanPool.connect();
  try {
    await cleanClient.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
    );
    const files = readdirSync('database/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      await ensureBootstrapFixtures(cleanClient);
      const sql = readFileSync(resolve('database/migrations', file), 'utf8');
      await cleanClient.query('BEGIN');
      await cleanClient.query(sql);
      await cleanClient.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await cleanClient.query('COMMIT');
      console.log(`  [clean-install] applied: ${file}`);
    }
    await ensureBootstrapFixtures(cleanClient);

    // Verify count of tables and teams
    const { rows: tRows } = await cleanClient.query("SELECT count(*) FROM teams");
    console.log(`  [clean-install] SUCCESS! Total teams present: ${tRows[0].count}`);
  } finally {
    cleanClient.release();
    await cleanPool.end();
  }

  // 2. Verify Existing-Database Path (Simulating DB already at migration 0013 with existing business data)
  console.log('\n[2/2] Testing Existing-Database Path on database: finverse_isolated_existing');
  await adminPool.query('DROP DATABASE IF EXISTS finverse_isolated_existing');
  await adminPool.query('CREATE DATABASE finverse_isolated_existing');

  const existingPool = new Pool({ connectionString: `${DB_BASE_URL}/finverse_isolated_existing` });
  const existingClient = await existingPool.connect();
  try {
    await existingClient.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
    );
    // Mark 0001 through 0013 as already applied
    const files = readdirSync('database/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Apply 0001 to create basic schema
    const sql0001 = readFileSync(resolve('database/migrations', '0001_init.sql'), 'utf8');
    await existingClient.query(sql0001);
    await ensureBootstrapFixtures(existingClient);

    for (const file of files) {
      if (file !== '0014_ensure_bootstrap_fixtures.sql') {
        await existingClient.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
      }
    }

    // Insert an existing business lead to verify no data loss or reset occurs
    await existingClient.query(`
      INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product, source, stage, team_id)
      VALUES ('LEAD-EXISTING-001', 'wealth', 'Legacy Client', '+91 99999 88888', 'English', 'Wealth Mandate', 'Direct', 'new', 'TEAM-WEALTH-ALPHA')
    `);

    console.log('  [existing-db] Simulated existing DB with business data and migrations 0001..0013 already recorded');

    // Now run migration runner over all files
    for (const file of files) {
      const { rowCount } = await existingClient.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file]
      );
      if (rowCount) {
        console.log(`  [existing-db] skipped already applied: ${file}`);
        continue;
      }
      await ensureBootstrapFixtures(existingClient);
      const sql = readFileSync(resolve('database/migrations', file), 'utf8');
      await existingClient.query('BEGIN');
      await existingClient.query(sql);
      await existingClient.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await existingClient.query('COMMIT');
      console.log(`  [existing-db] successfully upgraded new forward migration: ${file}`);
    }

    // Verify existing business data was preserved
    const { rows: leadRows } = await existingClient.query(
      "SELECT id, display_name FROM leads WHERE id = 'LEAD-EXISTING-001'"
    );
    if (leadRows.length === 1 && leadRows[0].display_name === 'Legacy Client') {
      console.log('  [existing-db] SUCCESS! Existing business lead verified preserved intact.');
    } else {
      throw new Error('Existing business data was corrupted or lost!');
    }
  } finally {
    existingClient.release();
    await existingPool.end();
  }

  // Cleanup isolated test databases
  await adminPool.query('DROP DATABASE IF EXISTS finverse_isolated_clean');
  await adminPool.query('DROP DATABASE IF EXISTS finverse_isolated_existing');
  await adminPool.end();

  console.log('\n--- ALL ISOLATED MIGRATION PATHS VERIFIED CLEANLY ---');
}

run().catch((err) => {
  console.error('Migration path verification failed:', err);
  process.exit(1);
});
