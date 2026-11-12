import { pool } from '../apps/api/src/repo/db';

async function main() {
  const res = await pool.query(`
    SELECT e.id, e.display_name, e.email, e.status, a.role, a.vertical, a.team_id, a.effective_from, a.effective_to
    FROM employees e
    LEFT JOIN assignments a ON a.employee_id = e.id
    ORDER BY e.id, a.role
  `);
  console.log('Total employee-assignment rows:', res.rows.length);
  for (const r of res.rows) {
    console.log(`${r.id.padEnd(10)} | ${(r.display_name || '').padEnd(25)} | ${(r.role || '').padEnd(6)} | ${(r.vertical || '').padEnd(12)} | ${(r.team_id || '').padEnd(25)} | ${r.status}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
