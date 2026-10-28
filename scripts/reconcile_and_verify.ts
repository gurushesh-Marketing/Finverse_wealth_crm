import { pool } from '../apps/api/src/repo/db';
import * as fs from 'fs';

async function main() {
  const result: any = {};

  // 1. All employees >= EMP-033
  const emp33 = await pool.query(`
    SELECT e.id, e.display_name, e.email, e.status, e.username, e.reporting_manager_id,
           a.role, a.vertical, a.team_id, a.effective_from, a.effective_to
    FROM employees e
    LEFT JOIN assignments a ON a.employee_id = e.id AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
    WHERE e.id >= 'EMP-033'
    ORDER BY e.id
  `);
  result.employees33 = emp33.rows;

  // Check EMP-049 specifically
  const emp49 = await pool.query(`SELECT * FROM employees WHERE id = 'EMP-049'`);
  result.emp49 = emp49.rows;
  const seq = await pool.query(`SELECT last_value FROM employee_id_seq`);
  result.seqLastValue = seq.rows[0];

  // 2. Superiors and roles: who are the managers and relationship managers?
  const superiors = await pool.query(`
    SELECT e.id, e.display_name, e.email, e.status, e.reporting_manager_id,
           a.role, a.vertical, a.team_id, a.effective_from, a.effective_to
    FROM employees e
    JOIN assignments a ON a.employee_id = e.id AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
    WHERE a.role IN ('TL', 'REL', 'MG', 'RM')
    ORDER BY a.vertical, a.role, e.id
  `);
  result.superiorsAndManagers = superiors.rows;

  // Check any remaining TL roles in assignments (active or historical)
  const tlAssignments = await pool.query(`
    SELECT a.*, e.display_name
    FROM assignments a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.role = 'TL'
    ORDER BY a.effective_from DESC
  `);
  result.tlAssignments = tlAssignments.rows;

  // Check specifically who Neel Verma, Kunal Shah, Manish Vyas, Vikramaditya Singhania are
  const fourSuperiors = await pool.query(`
    SELECT e.id, e.display_name, e.email, e.status,
           a.role, a.vertical, a.team_id, a.effective_from, a.effective_to
    FROM employees e
    LEFT JOIN assignments a ON a.employee_id = e.id AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
    WHERE e.id IN ('EMP-007', 'EMP-017', 'EMP-022', 'EMP-028')
  `);
  result.fourListedSuperiors = fourSuperiors.rows;

  // Check who the Relationship Managers are (role = 'REL')
  const relEmployees = await pool.query(`
    SELECT e.id, e.display_name, e.email, e.status,
           a.role, a.vertical, a.team_id, a.effective_from, a.effective_to
    FROM employees e
    JOIN assignments a ON a.employee_id = e.id AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
    WHERE a.role = 'REL'
    ORDER BY a.vertical, e.id
  `);
  result.relEmployees = relEmployees.rows;

  // 3. The 20 Callers (5 per vertical on Alpha teams)
  // Wealth: EMP-001, EMP-037, EMP-038, EMP-039, EMP-040
  // Banking: EMP-004, EMP-041, EMP-042, EMP-043, EMP-044
  // Markets: EMP-021, EMP-045, EMP-046, EMP-047, EMP-048
  // Real Estate: EMP-026, EMP-050, EMP-051, EMP-052, EMP-053
  const targetCallers = [
    'EMP-001', 'EMP-037', 'EMP-038', 'EMP-039', 'EMP-040',
    'EMP-004', 'EMP-041', 'EMP-042', 'EMP-043', 'EMP-044',
    'EMP-021', 'EMP-045', 'EMP-046', 'EMP-047', 'EMP-048',
    'EMP-026', 'EMP-050', 'EMP-051', 'EMP-052', 'EMP-053'
  ];

  const callersDetails = await pool.query(`
    SELECT e.id, e.display_name, e.email, e.username, e.status, e.reporting_manager_id,
           mgr.display_name as reporting_manager_name,
           a.role, a.vertical, a.team_id, a.effective_from, a.effective_to,
           COUNT(l.id) as lead_count
    FROM employees e
    JOIN assignments a ON a.employee_id = e.id AND a.role = 'SC' AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
    LEFT JOIN employees mgr ON mgr.id = e.reporting_manager_id
    LEFT JOIN leads l ON l.owner_employee_id = e.id
    WHERE e.id = ANY($1)
    GROUP BY e.id, e.display_name, e.email, e.username, e.status, e.reporting_manager_id, mgr.display_name,
             a.role, a.vertical, a.team_id, a.effective_from, a.effective_to
    ORDER BY a.vertical, a.team_id, e.id
  `, [targetCallers]);
  result.twentyCallers = callersDetails.rows;

  // Write output
  fs.writeFileSync('scripts/reconcile_output.json', JSON.stringify(result, null, 2));
  console.log('Saved reconcile_output.json successfully!');
  await pool.end();
}

main().catch(console.error);
