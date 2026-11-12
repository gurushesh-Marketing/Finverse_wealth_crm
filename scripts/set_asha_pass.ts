import { pool } from '../apps/api/src/repo/db';
import { hashPassword } from '../database/password';

async function main() {
  const hash = hashPassword('demo1234');
  await pool.query(`UPDATE employees SET password_hash = $1 WHERE id = 'EMP-001'`, [hash]);
  console.log('Successfully set Asha Rao password to demo1234');
  await pool.end();
}

main().catch(console.error);
