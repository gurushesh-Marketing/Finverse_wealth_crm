const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://finverse:mPXSxTCBd50QMJYgGND2UpHZ98fK13qn@127.0.0.1:5433/finverse_test' });
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync('database/migrations/0051_hr_onboarding_and_account_activation.sql', 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (version) VALUES ('0051_hr_onboarding_and_account_activation.sql') ON CONFLICT DO NOTHING");
    await client.query('COMMIT');
    console.log('[migrate_test_db] 0051 successfully applied to finverse_test');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate_test_db] ERROR:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
