const { pool } = require('./apps/api/dist/repo/db');
(async () => {
  const res = await pool.query(`
    SELECT e.id, e.display_name, e.email, e.status, a.role, a.vertical, a.team_id, a.effective_from, a.effective_to
    FROM employees e
    LEFT JOIN assignments a ON a.employee_id = e.id
    ORDER BY e.id, a.role
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
