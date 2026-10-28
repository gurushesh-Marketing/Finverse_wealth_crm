const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://finverse:mPXSxTCBd50QMJYgGND2UpHZ98fK13qn@127.0.0.1:5433/finverse_crm' });

async function main() {
  const res = await p.query(`
    SELECT h.id, h.lead_id, l.display_name, h.caller_employee_id, h.rel_employee_id, e.display_name as rel_name, h.status
    FROM lead_handoffs h
    JOIN leads l ON h.lead_id = l.id
    JOIN employees e ON h.rel_employee_id = e.id
    ORDER BY h.created_at DESC LIMIT 5
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await p.end();
}

main().catch(console.error);
