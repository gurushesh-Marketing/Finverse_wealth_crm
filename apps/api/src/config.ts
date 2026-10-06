import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const isTest = process.env.NODE_ENV === 'test' || process.argv.some((a) => a.includes('test'));
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const rawDatabaseUrl = isTest ? (testDatabaseUrl || process.env.DATABASE_URL || '') : required('DATABASE_URL');


export function assertTestDatabaseGuard(dbUrl: string): void {
  try {
    const parsed = new URL(dbUrl);
    const dbName = parsed.pathname.replace(/^\//, '');
    const demoDb = process.env.POSTGRES_DB || 'finverse_crm';
    if (dbName === demoDb) {
      throw new Error(`TEST GUARD BLOCKED: Automated tests and cleanup cannot target the demo database ('${dbName}'). Must use a dedicated test database (e.g. TEST_DATABASE_URL).`);
    }
  } catch (err: any) {
    if (err?.message?.startsWith('TEST GUARD BLOCKED:')) throw err;
    if (dbUrl.includes('/finverse_crm')) {
      throw new Error(`TEST GUARD BLOCKED: Automated tests and cleanup cannot target the demo database ('finverse_crm'). Must use a dedicated test database.`);
    }
  }
}

if (isTest) {
  assertTestDatabaseGuard(rawDatabaseUrl);
}

export const env = {
  DATABASE_URL: rawDatabaseUrl,
  // Reserved for future cookie signing; opaque DB-backed sessions do not use it.
  SESSION_SECRET: process.env.SESSION_SECRET ?? '',
  API_PORT: Number(process.env.API_PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};

