import { Pool } from 'pg';
import { env } from '../config';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});
