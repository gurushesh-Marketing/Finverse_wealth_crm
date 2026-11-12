import { pool } from '../apps/api/src/repo/db';
import * as hrRepo from '../apps/api/src/repo/hr';
import * as saRepo from '../apps/api/src/repo/superadmin';
import { hashPassword } from '../database/password';

interface NewCallerSpec {
  fullName: string;
  email: string;
  mobile: string;
  vertical: 'wealth' | 'banking' | 'markets' | 'real_estate';
  teamId: string;
  superiorId: string;
}

const CALLERS_TO_ONBOARD: NewCallerSpec[] = [
  // 1. Wealth Alpha (Need 3 more to make 5 with EMP-001 Asha Rao, EMP-037 Aarav Sen)
  {
    fullName: 'Rohan Joshi',
    email: 'rohan.joshi@finverse.demo',
    mobile: '+91 9811100001',
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-ALPHA',
    superiorId: 'EMP-007', // Neel Verma
  },
  {
    fullName: 'Megha Desai',
    email: 'megha.desai@finverse.demo',
    mobile: '+91 9811100002',
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-ALPHA',
    superiorId: 'EMP-007',
  },
  {
    fullName: 'Arjun Nair',
    email: 'arjun.nair@finverse.demo',
    mobile: '+91 9811100003',
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-ALPHA',
    superiorId: 'EMP-007',
  },

  // 2. Banking Alpha (Need 4 more to make 5 with EMP-004 Dev Kapoor)
  {
    fullName: 'Priya Sharma',
    email: 'priya.sharma.banking@finverse.demo',
    mobile: '+91 9822200001',
    vertical: 'banking',
    teamId: 'TEAM-BANKING-ALPHA',
    superiorId: 'EMP-017', // Kunal Shah
  },
  {
    fullName: 'Amit Patel',
    email: 'amit.patel@finverse.demo',
    mobile: '+91 9822200002',
    vertical: 'banking',
    teamId: 'TEAM-BANKING-ALPHA',
    superiorId: 'EMP-017',
  },
  {
    fullName: 'Sneha Kulkarni',
    email: 'sneha.kulkarni@finverse.demo',
    mobile: '+91 9822200003',
    vertical: 'banking',
    teamId: 'TEAM-BANKING-ALPHA',
    superiorId: 'EMP-017',
  },
  {
    fullName: 'Rajesh Verma',
    email: 'rajesh.verma@finverse.demo',
    mobile: '+91 9822200004',
    vertical: 'banking',
    teamId: 'TEAM-BANKING-ALPHA',
    superiorId: 'EMP-017',
  },

  // 3. Markets Alpha (Need 4 more to make 5 with EMP-021 Kabir Joshi)
  {
    fullName: 'Vikram Singhal',
    email: 'vikram.singhal@finverse.demo',
    mobile: '+91 9833300001',
    vertical: 'markets',
    teamId: 'TEAM-MARKETS-ALPHA',
    superiorId: 'EMP-022', // Manish Vyas
  },
  {
    fullName: 'Ananya Iyer',
    email: 'ananya.iyer@finverse.demo',
    mobile: '+91 9833300002',
    vertical: 'markets',
    teamId: 'TEAM-MARKETS-ALPHA',
    superiorId: 'EMP-022',
  },
  {
    fullName: 'Karan Malhotra',
    email: 'karan.malhotra@finverse.demo',
    mobile: '+91 9833300003',
    vertical: 'markets',
    teamId: 'TEAM-MARKETS-ALPHA',
    superiorId: 'EMP-022',
  },
  {
    fullName: 'Ritu Saxena',
    email: 'ritu.saxena@finverse.demo',
    mobile: '+91 9833300004',
    vertical: 'markets',
    teamId: 'TEAM-MARKETS-ALPHA',
    superiorId: 'EMP-022',
  },

  // 4. Real Estate Alpha (Need 4 more to make 5 with EMP-026 Sameer Kulkarni)
  {
    fullName: 'Aditya Roy',
    email: 'aditya.roy@finverse.demo',
    mobile: '+91 9844400001',
    vertical: 'real_estate',
    teamId: 'TEAM-REALESTATE-ALPHA',
    superiorId: 'EMP-028', // Vikramaditya Singhania
  },
  {
    fullName: 'Pooja Hegde',
    email: 'pooja.hegde@finverse.demo',
    mobile: '+91 9844400002',
    vertical: 'real_estate',
    teamId: 'TEAM-REALESTATE-ALPHA',
    superiorId: 'EMP-028',
  },
  {
    fullName: 'Varun Kapoor',
    email: 'varun.kapoor@finverse.demo',
    mobile: '+91 9844400003',
    vertical: 'real_estate',
    teamId: 'TEAM-REALESTATE-ALPHA',
    superiorId: 'EMP-028',
  },
  {
    fullName: 'Divya Menon',
    email: 'divya.menon@finverse.demo',
    mobile: '+91 9844400004',
    vertical: 'real_estate',
    teamId: 'TEAM-REALESTATE-ALPHA',
    superiorId: 'EMP-028',
  },
];

async function main() {
  console.log('=== ONBOARDING 15 MISSING CALLERS THROUGH HR -> SA PIPELINE ===');
  const hrActorId = 'EMP-014'; // Pooja Sharma
  const saActorId = 'EMP-013'; // Alok Verma

  const onboardedProfiles: any[] = [];

  for (const c of CALLERS_TO_ONBOARD) {
    const existing = await pool.query('SELECT id FROM employees WHERE lower(email) = lower($1)', [c.email]);
    if (existing.rows.length > 0) {
      console.log(`\nCaller ${c.fullName} (${c.email}) already onboarded as ${existing.rows[0].id}. Skipping.`);
      onboardedProfiles.push({
        employeeId: existing.rows[0].id,
        name: c.fullName,
        email: c.email,
        role: 'SC',
        vertical: c.vertical,
        teamId: c.teamId,
        superiorId: c.superiorId,
      });
      continue;
    }

    // 1. HR submits onboarding proposal
    console.log(`\n[HR Submission] Submitting joiner proposal for ${c.fullName} (${c.email}) in ${c.vertical} -> ${c.teamId}...`);
    const hrRes = await hrRepo.submitOnboarding(
      {
        fullName: c.fullName,
        primaryMobile: c.mobile,
        whatsappNumber: c.mobile,
        email: c.email,
        proposedRole: 'SC',
        proposedVertical: c.vertical,
        proposedTeamId: c.teamId,
        proposedSuperiorId: c.superiorId,
      },
      hrActorId
    );
    console.log(`  -> HR submitted request ${hrRes.requestId}. Generated Employee ID: ${hrRes.employeeId}`);

    // 2. Super Admin reviews and approves onboarding
    console.log(`[SA Approval] Approving request ${hrRes.requestId} for ${hrRes.employeeId}...`);
    const saRes = await saRepo.approveOnboardingRequest(
      {
        requestId: hrRes.requestId,
        role: 'SC',
        vertical: c.vertical,
        teamId: c.teamId,
        reportingManagerId: c.superiorId,
        username: hrRes.employeeId,
      },
      saActorId
    );
    console.log(`  -> SA approved and activated ${saRes.employeeId}. Login username: ${saRes.username}, Temp Password: ${saRes.temporaryPassword}`);

    // Set demo password so caller can be used in test logins without manual password changes
    const demoHash = hashPassword('demo1234');
    await pool.query(
      `UPDATE employees SET password_hash = $1, must_change_password = false WHERE id = $2`,
      [demoHash, saRes.employeeId]
    );

    onboardedProfiles.push({
      employeeId: saRes.employeeId,
      name: c.fullName,
      email: c.email,
      role: 'SC',
      vertical: c.vertical,
      teamId: c.teamId,
      superiorId: c.superiorId,
    });
  }

  console.log('\n=== ALL 15 CALLERS ONBOARDED SUCCESSFULLY ===');
  console.log(JSON.stringify(onboardedProfiles, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error('ONBOARDING ERROR:', err);
  process.exit(1);
});
