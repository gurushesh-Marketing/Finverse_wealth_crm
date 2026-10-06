import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { hashPassword } from './password';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

function daysFromNow(days: number, hours = 0): Date {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const demoHash = hashPassword('demo1234');

    const teams: Array<[string, string, string]> = [
      ['TEAM-WEALTH-ALPHA', 'Wealth Alpha', 'wealth'],
      ['TEAM-WEALTH-BETA', 'Wealth Beta', 'wealth'],
      ['TEAM-BANKING-ALPHA', 'Banking Alpha', 'banking'],
      ['TEAM-WEALTH-GAMMA', 'Wealth Gamma', 'wealth'],
    ];
    for (const [id, name, vertical] of teams) {
      await pool.query(
        'INSERT INTO teams (id, name, vertical) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [id, name, vertical]
      );
    }

    const employees: Array<[string, string, string]> = [
      ['EMP-001', 'asha@finverse.demo', 'Asha Rao'],
      ['EMP-002', 'ravi@finverse.demo', 'Ravi Menon'],
      ['EMP-003', 'tara@finverse.demo', 'Tara Iyer'],
      ['EMP-004', 'dev@finverse.demo', 'Dev Kapoor'],
      ['EMP-005', 'meera@finverse.demo', 'Meera Nair'],
      ['EMP-006', 'karan@finverse.demo', 'Karan Shah'],
      ['EMP-007', 'neel@finverse.demo', 'Neel Verma'],
      ['EMP-008', 'kavita@finverse.demo', 'Kavita Rao'],
      ['EMP-009', 'vikram@finverse.demo', 'Vikram Malhotra'],
      ['EMP-010', 'rajiv@finverse.demo', 'Rajiv Mehta'],
      ['EMP-011', 'ananya@finverse.demo', 'Ananya Roy'],
    ];
    for (const [id, email, displayName] of employees) {
      await pool.query(
        `INSERT INTO employees (id, email, password_hash, display_name, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [id, email, demoHash, displayName]
      );
    }

    const assignments: Array<[string, string, string, string, string]> = [
      ['ASG-WEALTH-001', 'EMP-001', 'SC', 'wealth', 'TEAM-WEALTH-ALPHA'],
      ['ASG-WEALTH-002', 'EMP-002', 'SC', 'wealth', 'TEAM-WEALTH-BETA'],
      ['ASG-WEALTH-003A', 'EMP-003', 'TL', 'wealth', 'TEAM-WEALTH-ALPHA'],
      ['ASG-WEALTH-003B', 'EMP-003', 'TL', 'wealth', 'TEAM-WEALTH-BETA'],
      ['ASG-BANK-001', 'EMP-004', 'SC', 'banking', 'TEAM-BANKING-ALPHA'],
      ['ASG-WEALTH-005', 'EMP-005', 'TL', 'wealth', 'TEAM-WEALTH-GAMMA'],
      ['ASG-WEALTH-006', 'EMP-006', 'SC', 'wealth', 'TEAM-WEALTH-GAMMA'],
      ['ASG-WEALTH-MG-A', 'EMP-007', 'MG', 'wealth', 'TEAM-WEALTH-ALPHA'],
      ['ASG-WEALTH-MG-B', 'EMP-007', 'MG', 'wealth', 'TEAM-WEALTH-BETA'],
      ['ASG-WEALTH-MG-C', 'EMP-007', 'MG', 'wealth', 'TEAM-WEALTH-GAMMA'],
      ['ASG-WEALTH-RM-A', 'EMP-008', 'RM', 'wealth', 'TEAM-WEALTH-ALPHA'],
      ['ASG-WEALTH-RM-B', 'EMP-008', 'RM', 'wealth', 'TEAM-WEALTH-BETA'],
      ['ASG-WEALTH-RM-C', 'EMP-008', 'RM', 'wealth', 'TEAM-WEALTH-GAMMA'],
      ['ASG-WEALTH-NM-A', 'EMP-009', 'NM', 'wealth', 'TEAM-WEALTH-ALPHA'],
      ['ASG-WEALTH-NM-B', 'EMP-009', 'NM', 'wealth', 'TEAM-WEALTH-BETA'],
      ['ASG-WEALTH-NM-C', 'EMP-009', 'NM', 'wealth', 'TEAM-WEALTH-GAMMA'],
      ['ASG-EXEC-CEO-W', 'EMP-010', 'CEO', 'wealth', 'TEAM-WEALTH-ALPHA'],
      ['ASG-EXEC-CEO-B', 'EMP-010', 'CEO', 'banking', 'TEAM-BANKING-ALPHA'],
      ['ASG-EXEC-CFO-W', 'EMP-011', 'CFO', 'wealth', 'TEAM-WEALTH-ALPHA'],
      ['ASG-EXEC-CFO-B', 'EMP-011', 'CFO', 'banking', 'TEAM-BANKING-ALPHA'],
    ];
    for (const [id, employeeId, role, vertical, teamId] of assignments) {
      await pool.query(
        `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NULL) ON CONFLICT (id) DO NOTHING`,
        [id, employeeId, role, vertical, teamId]
      );
    }

    const leads: Array<{
      id: string; vertical: string; name: string; email: string | null; phone: string;
      product: string; source: string; stage: string; owner: string; team: string;
    }> = [
      { id: 'FV-1001', vertical: 'wealth', name: 'Prospect A', email: 'prospect.a@example.test', phone: '+91 98765 40001', product: 'V1 Wealth Portfolio', source: 'Website', stage: 'contacted', owner: 'EMP-001', team: 'TEAM-WEALTH-ALPHA' },
      { id: 'FV-1002', vertical: 'wealth', name: 'Prospect B', email: null, phone: '+91 98765 40002', product: 'V1 Wealth Portfolio', source: 'Campaign C12', stage: 'not-contacted', owner: 'EMP-001', team: 'TEAM-WEALTH-ALPHA' },
      { id: 'FV-1003', vertical: 'wealth', name: 'Prospect C', email: 'prospect.c@example.test', phone: '+91 98765 40003', product: 'V1 Savings Plus', source: 'Employee referral', stage: 'new', owner: 'EMP-001', team: 'TEAM-WEALTH-ALPHA' },
      { id: 'FV-1004', vertical: 'wealth', name: 'Prospect D', email: null, phone: '+91 98765 40004', product: 'V1 Wealth Portfolio', source: 'Website', stage: 'contacted', owner: 'EMP-002', team: 'TEAM-WEALTH-BETA' },
      { id: 'FV-1005', vertical: 'wealth', name: 'Prospect E', email: 'prospect.e@example.test', phone: '+91 98765 40005', product: 'V1 Savings Plus', source: 'Campaign C12', stage: 'not-contacted', owner: 'EMP-002', team: 'TEAM-WEALTH-BETA' },
      { id: 'FV-2001', vertical: 'banking', name: 'Prospect F', email: null, phone: '+91 98765 40006', product: 'V1 Current Account', source: 'Website', stage: 'contacted', owner: 'EMP-004', team: 'TEAM-BANKING-ALPHA' },
      { id: 'FV-2002', vertical: 'banking', name: 'Prospect G', email: 'prospect.g@example.test', phone: '+91 98765 40007', product: 'V1 Current Account', source: 'Employee referral', stage: 'new', owner: 'EMP-004', team: 'TEAM-BANKING-ALPHA' },
      { id: 'FV-1101', vertical: 'wealth', name: 'Prospect H', email: 'prospect.h@example.test', phone: '+91 98765 40011', product: 'V1 Wealth Portfolio', source: 'Website', stage: 'contacted', owner: 'EMP-006', team: 'TEAM-WEALTH-GAMMA' },
      { id: 'FV-1102', vertical: 'wealth', name: 'Prospect I', email: null, phone: '+91 98765 40012', product: 'V1 Savings Plus', source: 'Campaign C12', stage: 'not-contacted', owner: 'EMP-006', team: 'TEAM-WEALTH-GAMMA' },
      { id: 'FV-1103', vertical: 'wealth', name: 'Prospect J', email: 'prospect.j@example.test', phone: '+91 98765 40013', product: 'V1 Wealth Portfolio', source: 'Employee referral', stage: 'new', owner: 'EMP-006', team: 'TEAM-WEALTH-GAMMA' },
      { id: 'FV-1104', vertical: 'wealth', name: 'Prospect K', email: null, phone: '+91 98765 40014', product: 'V1 Savings Plus', source: 'Campaign C12', stage: 'new', owner: null as unknown as string, team: 'TEAM-WEALTH-GAMMA' },
    ];
    for (const l of leads) {
      await pool.query(
        `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
         VALUES ($1, $2, $3, $4, $5, 'English', $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
        [l.id, l.vertical, l.name, l.email, l.phone, l.product, l.source, l.stage, l.owner, l.team]
      );
    }

    let taskSeq = 0;
    const tasks: Array<[string, string, string, string, string, Date, string]> = [
      ['FV-1001', 'EMP-001', 'voice-call', 'Confirm documents', daysFromNow(-1), 'normal'],
      ['FV-1002', 'EMP-001', 'voice-call', 'Introduction call', daysFromNow(0, 4), 'high'],
      ['FV-1004', 'EMP-002', 'whatsapp', 'Share brochure', daysFromNow(2), 'normal'],
      ['FV-2001', 'EMP-004', 'email', 'Send account opening kit', daysFromNow(1), 'normal'],
    ].map((t) => [t[0] as string, t[1] as string, t[2] as string, t[3] as string, t[4] as string, t[5] as Date, t[6] as string]) as Array<[string, string, string, string, string, Date, string]>;

    for (const [leadId, owner, action, purpose, dueAt, priority] of tasks) {
      taskSeq += 1;
      await pool.query(
        `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'open') ON CONFLICT (id) DO NOTHING`,
        [`TASK-SEED-${taskSeq}`, leadId, owner, action, purpose, dueAt, priority]
      );
    }

    let eventSeq = 0;
    const events: Array<[string, string, string, string]> = [
      ['FV-1001', 'EMP-001', 'note', 'Enquiry received via Website. Synthetic demo note.'],
      ['FV-1001', 'EMP-001', 'note', 'Introductory call completed. Synthetic demo note.'],
      ['FV-1002', 'EMP-001', 'note', 'Enquiry received via Campaign C12. Synthetic demo note.'],
      ['FV-1003', 'EMP-001', 'note', 'Enquiry received via Employee referral. Synthetic demo note.'],
      ['FV-1004', 'EMP-002', 'note', 'Enquiry received via Website. Synthetic demo note.'],
      ['FV-1005', 'EMP-002', 'note', 'Enquiry received via Campaign C12. Synthetic demo note.'],
      ['FV-2001', 'EMP-004', 'note', 'Enquiry received via Website. Synthetic demo note.'],
      ['FV-2002', 'EMP-004', 'note', 'Enquiry received via Employee referral. Synthetic demo note.'],
    ];
    for (const [leadId, actor, kind, note] of events) {
      eventSeq += 1;
      await pool.query(
        `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [`EVT-SEED-${eventSeq}`, leadId, actor, kind, note]
      );
    }

    await pool.query(
      `INSERT INTO availability_changes (id, employee_id, status, note)
       VALUES ('AVL-SEED-1', 'EMP-001', 'available', 'Synthetic demo availability') ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO reviews (id, employee_id, reviewer_employee_id, period, scorecard, commitments)
       VALUES ('REV-SEED-1', 'EMP-001', 'EMP-003', 'September', '{"contactRate": 0.62, "followUps": 18, "note": "Synthetic demo scorecard"}', '[]')
       ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO reviews (id, employee_id, reviewer_employee_id, period, scorecard, commitments)
       VALUES ('REV-SEED-2', 'EMP-002', 'EMP-003', 'September', '{"contactRate": 0.55, "followUps": 14, "note": "Synthetic demo scorecard"}', '[]')
       ON CONFLICT (id) DO NOTHING`
    );

    for (const table of ['teams', 'employees', 'assignments', 'leads', 'lead_tasks', 'lead_events']) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
      console.log(`[seed] ${table}: ${rows[0].n} rows`);
    }
    console.log('[seed] done (synthetic demo data only; demo password: demo1234)');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
