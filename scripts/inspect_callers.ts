import { pool } from '../apps/api/src/repo/db';

async function main() {
  const { rows } = await pool.query(`
    SELECT e.id, e.display_name, e.email, e.username, e.status, e.reporting_manager_id,
           a.role, a.vertical, a.team_id, t.name as team_name,
           mgr.display_name as manager_name
      FROM employees e
      JOIN assignments a ON a.employee_id = e.id
      LEFT JOIN teams t ON t.id = a.team_id
      LEFT JOIN employees mgr ON mgr.id = e.reporting_manager_id
     WHERE a.role = 'SC'
       AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
     ORDER BY a.vertical, a.team_id, e.id
  `);
  console.log('=== Current Sales Callers (SC) ===');
  console.table(rows);

  const { rows: teams } = await pool.query(`
    SELECT t.id, t.name, t.vertical
      FROM teams t
     ORDER BY t.vertical, t.id
  `);
  console.log('=== Teams ===');
  console.table(teams);

  const { rows: mgrs } = await pool.query(`
    SELECT e.id, e.display_name, a.role, a.vertical, a.team_id
      FROM employees e
      JOIN assignments a ON a.employee_id = e.id
     WHERE a.role IN ('TL', 'MG', 'REL', 'RM')
       AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
     ORDER BY a.vertical, a.team_id, a.role, e.id
  `);
  console.log('=== Potential Superiors (TL/MG/REL) ===');
  console.table(mgrs);

  await pool.end();
}

main().catch(console.error);
