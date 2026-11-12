import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';

loadEnv();

const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.SUPABASE_STAGING_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  throw new Error('Set DATABASE_URL and SUPABASE_STAGING_DATABASE_URL in the local environment');
}
if (sourceUrl === targetUrl) {
  throw new Error('Source and staging target must differ');
}

const source = new Pool({ connectionString: sourceUrl, connectionTimeoutMillis: 5000 });
const target = new Pool({ connectionString: targetUrl, connectionTimeoutMillis: 5000 });

type Snapshot = { migrations: string[]; counts: Map<string, number>; schemas: string[] };

async function snapshot(pool: Pool): Promise<Snapshot> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const schemas = (await client.query<{ schema_name: string }>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('auth', 'storage') ORDER BY schema_name"
    )).rows.map((r) => r.schema_name);
    const migrations = (await client.query<{ version: string }>(
      'SELECT version FROM public.schema_migrations ORDER BY version'
    )).rows.map((r) => r.version);
    const tables = (await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations' ORDER BY table_name"
    )).rows.map((r) => r.table_name);
    const counts = new Map<string, number>();
    for (const table of tables) {
      // Table identifiers come only from PostgreSQL's own catalogue; quote defensively.
      const quoted = table.replaceAll('"', '""');
      const result = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM public."${quoted}"`);
      counts.set(table, Number(result.rows[0].count));
    }
    await client.query('COMMIT');
    return { schemas, migrations, counts };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
try {
  const [before, after] = await Promise.all([snapshot(source), snapshot(target)]);
  const failures: string[] = [];
  if (!after.schemas.includes('auth') || !after.schemas.includes('storage')) {
    failures.push('Target lacks expected Supabase internal schemas');
  }
  if (before.migrations.join('\n') !== after.migrations.join('\n')) {
    failures.push(`Migration ledger differs (source ${before.migrations.length}, target ${after.migrations.length})`);
  }
  for (const [name, count] of before.counts) {
    const restored = after.counts.get(name);
    if (restored !== count) failures.push(`${name}: source ${count}, target ${restored ?? 'missing'}`);
  }
  for (const name of after.counts.keys()) {
    if (!before.counts.has(name)) failures.push(`${name}: present only on target`);
  }
  if (failures.length) {
    console.error(`FAIL: ${failures.length} schema/data differences`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${before.migrations.length} migrations and ${before.counts.size} CRM tables have matching row counts; Supabase schemas present`);
  }
} finally {
  await Promise.all([source.end(), target.end()]);
}
}

main().catch((error: unknown) => {
  console.error(`Supabase migration verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
