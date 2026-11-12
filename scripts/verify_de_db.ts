import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://finverse:mPXSxTCBd50QMJYgGND2UpHZ98fK13qn@localhost:5433/finverse_test'
  });
  try {
    const dbs = await pool.query('SELECT datname FROM pg_database');
    console.log('Databases:', dbs.rows.map(r => r.datname));
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
