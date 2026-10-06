import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { hashPassword } from '../database/password';

loadEnv({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(
    `UPDATE employees SET password_hash = $1 WHERE email LIKE '%@finverse.demo'`,
    [hashPassword('demo1234')]
  );
  console.log('updated', res.rowCount);
  await pool.end();
}
void main();
