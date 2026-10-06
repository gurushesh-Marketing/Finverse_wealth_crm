import { resolve } from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { hashPassword } from '../database/password';

dotenv.config();

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  console.error('TEST_DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: testDbUrl });

async function main(): Promise<void> {
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
        `INSERT INTO teams (id, name, vertical)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = $2, vertical = $3`,
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
         ON CONFLICT (id) DO UPDATE SET password_hash = $3, email = $2, display_name = $4`,
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
    for (const [id, empId, role, vertical, teamId] of assignments) {
      await pool.query(
        `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
         ON CONFLICT (id) DO UPDATE SET role = $3, vertical = $4, team_id = $5`,
        [id, empId, role, vertical, teamId]
      );
    }

    console.log('[test-db] seeded teams, employees, and assignments with valid demo scrypt hashes');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[test-db] seed error:', err);
  process.exit(1);
});
