import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const urls = [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL].filter(Boolean) as string[];
  for (const url of urls) {
    const pool = new Pool({ connectionString: url });
    await pool.query(`
      UPDATE sales_finance_handoffs SET created_at = '2026-05-15 10:00:00+00' WHERE id = 'SFH-001';
      UPDATE sales_finance_handoffs SET created_at = '2026-07-15 10:00:00+00' WHERE id = 'SFH-002';
      UPDATE finance_ledger_entries SET created_at = '2026-05-15 11:00:00+00' WHERE id IN ('ENT-001', 'ENT-002');
      UPDATE receipt_invoice_matches SET allocation_date = '2026-05-15 12:00:00+00' WHERE id IN ('RIM-001', 'RIM-002');
    `);
    await pool.end();
  }
  console.log('Successfully updated baseline dates');
}

main().catch(console.error);
