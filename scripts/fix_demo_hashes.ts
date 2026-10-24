import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { like } from 'drizzle-orm';
import { employees } from '../apps/api/src/db/schema/auth';
import { hashPassword } from '../database/password';

loadEnv({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const res = await db
    .update(employees)
    .set({ passwordHash: hashPassword('demo1234') })
    .where(like(employees.email, '%@finverse.demo'))
    .returning();
  console.log('updated', res.length);
  await pool.end();
}
void main();
