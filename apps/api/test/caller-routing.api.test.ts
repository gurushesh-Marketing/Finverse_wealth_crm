process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';
import { allocateCallerForVertical } from '../src/repo/data-entry';
import { listLeads } from '../src/repo/leads';
import { reconcileFormerCallerLeads, redistributeFormerCallerLeads } from '../src/repo/caller-reassignment';
import { grantScope, offboardEmployee } from '../src/repo/superadmin';

test('bulk-sized round robin stays within one team and a departing caller transfers open work with history', async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  const db = new Pool({ connectionString: env.DATABASE_URL });
  const client = await db.connect();
  const suffix = randomUUID().slice(0, 8);
  const team = `TEAM-ROUTING-${suffix}`;
  const callers = [0, 1, 2].map((n) => `EMP-ROUTING-${suffix}-${n}`);
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO teams (id, name, vertical) VALUES ($1, 'Routing test team', 'real_estate')`, [team]);
    for (const [index, callerId] of callers.entries()) {
      await client.query(
        `INSERT INTO employees (id, email, password_hash, display_name, status)
         VALUES ($1, $2, 'unusable-test-hash', $3, 'active')`,
        [callerId, `routing-${suffix}-${index}@example.test`, `Routing ${index}`]
      );
      await client.query(
        `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
         VALUES ($1, $2, 'SC', 'real_estate', $3, CURRENT_DATE)`,
        [`ASG-ROUTING-${suffix}-${index}`, callerId, team]
      );
    }

    const selections: string[] = [];
    for (let n = 0; n < 8; n++) {
      const allocation = await allocateCallerForVertical(client, 'real_estate', team);
      assert.equal(allocation.teamId, team);
      selections.push(allocation.callerId!);
    }
    const counts = callers.map((id) => selections.filter((selected) => selected === id).length);
    assert.deepEqual(counts, [3, 3, 2], 'Eight leads across three callers must differ by at most one');

    const departing = callers[0]!;
    const leadIds = [0, 1, 2].map((n) => `LEAD-ROUTING-${suffix}-${n}`);
    for (const [index, leadId] of leadIds.entries()) {
      await client.query(
        `INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product,
                            source, stage, owner_employee_id, team_id, record_version)
         VALUES ($1, 'real_estate', $2, $3, 'English', 'Advisory', 'Test', 'new', $4, $5, 1)`,
        [leadId, `Routing prospect ${index}`, `9110000${suffix.slice(0, 3)}${index}`, departing, team]
      );
      await client.query(
        `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
         VALUES ($1, $2, $3, 'call', 'Initial outreach', now() + interval '1 day', 'high', 'open')`,
        [`TASK-ROUTING-${suffix}-${index}`, leadId, departing]
      );
    }
    await client.query(
      `UPDATE assignments SET effective_to = CURRENT_DATE - 1 WHERE employee_id = $1`,
      [departing]
    );

    const actor = await client.query(
      `SELECT employee_id FROM assignments WHERE role = 'SA' LIMIT 1`
    );
    assert.ok(actor.rows[0], 'Test database needs its seeded Super Admin');
    const result = await redistributeFormerCallerLeads(
      client, departing, actor.rows[0].employee_id, 'test promotion'
    );
    assert.deepEqual(result, { reassigned: 3, held: 0 });

    const reassigned = await client.query(
      `SELECT l.id, l.team_id, l.owner_employee_id, l.record_version,
              t.owner_employee_id AS task_owner, oe.from_owner_employee_id,
              oe.to_owner_employee_id, oe.reason
         FROM leads l JOIN lead_tasks t ON t.lead_id = l.id
         JOIN lead_ownership_events oe ON oe.lead_id = l.id
        WHERE l.id = ANY($1::text[]) ORDER BY l.id`,
      [leadIds]
    );
    assert.equal(reassigned.rows.length, 3);
    assert.deepEqual(
      callers.slice(1).map((id) => reassigned.rows.filter((row) => row.owner_employee_id === id).length).sort(),
      [1, 2],
      'The remaining same-team callers must receive the three reassigned leads fairly'
    );
    for (const row of reassigned.rows) {
      assert.equal(row.team_id, team);
      assert.equal(row.task_owner, row.owner_employee_id);
      assert.equal(row.from_owner_employee_id, departing);
      assert.equal(row.to_owner_employee_id, row.owner_employee_id);
      assert.match(row.reason, /Automatic same-team caller reassignment/);
      assert.equal(row.record_version, 2);
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await db.end();
  }
});

test('ten callers in one team divide 23 new leads with at most one lead of difference', async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  const db = new Pool({ connectionString: env.DATABASE_URL });
  const client = await db.connect();
  const suffix = randomUUID().slice(0, 8);
  const team = `TEAM-TEN-${suffix}`;
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO teams (id, name, vertical) VALUES ($1, 'Ten-caller test team', 'real_estate')`, [team]);
    const counts = new Map<string, number>();
    for (let n = 0; n < 10; n++) {
      const id = `EMP-TEN-${suffix}-${n}`;
      counts.set(id, 0);
      await client.query(
        `INSERT INTO employees (id, email, password_hash, display_name, status)
         VALUES ($1, $2, 'unusable-test-hash', $3, 'active')`,
        [id, `ten-${suffix}-${n}@example.test`, `Caller ${n}`]
      );
      await client.query(
        `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
         VALUES ($1, $2, 'SC', 'real_estate', $3, CURRENT_DATE)`,
        [`ASG-TEN-${suffix}-${n}`, id, team]
      );
    }
    for (let n = 0; n < 23; n++) {
      const assigned = await allocateCallerForVertical(client, 'real_estate', team);
      assert.equal(assigned.teamId, team);
      counts.set(assigned.callerId!, (counts.get(assigned.callerId!) ?? 0) + 1);
    }
    assert.deepEqual([...counts.values()].sort(), [2, 2, 2, 2, 2, 2, 2, 3, 3, 3]);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await db.end();
  }
});

test('offboarding moves the former caller\'s lead and open task to another caller on the same team', async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  const db = new Pool({ connectionString: env.DATABASE_URL });
  const suffix = randomUUID().slice(0, 8);
  const team = `TEAM-OFFBOARD-${suffix}`;
  const former = `EMP-OFFBOARD-${suffix}-0`;
  const recipient = `EMP-OFFBOARD-${suffix}-1`;
  const lead = `LEAD-OFFBOARD-${suffix}`;
  const task = `TASK-OFFBOARD-${suffix}`;
  try {
    const actor = await db.query(`SELECT employee_id FROM assignments WHERE role = 'SA' LIMIT 1`);
    assert.ok(actor.rows[0]);
    await db.query(`INSERT INTO teams (id, name, vertical) VALUES ($1, 'Offboard test team', 'real_estate')`, [team]);
    for (const [n, employeeId] of [former, recipient].entries()) {
      await db.query(
        `INSERT INTO employees (id, email, password_hash, display_name, status)
         VALUES ($1, $2, 'unusable-test-hash', $3, 'active')`,
        [employeeId, `offboard-${suffix}-${n}@example.test`, `Offboard ${n}`]
      );
      await db.query(
        `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
         VALUES ($1, $2, 'SC', 'real_estate', $3, CURRENT_DATE)`,
        [`ASG-OFFBOARD-${suffix}-${n}`, employeeId, team]
      );
    }
    await db.query(
      `INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product,
                          source, stage, owner_employee_id, team_id)
       VALUES ($1, 'real_estate', 'Offboard prospect', '91990001234', 'English', 'Advisory', 'Test', 'new', $2, $3)`,
      [lead, former, team]
    );
    await db.query(
      `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
       VALUES ($1, $2, $3, 'call', 'Initial outreach', now() + interval '1 day', 'high', 'open')`,
      [task, lead, former]
    );

    await offboardEmployee({
      employeeId: former, reason: 'Approved test departure', effectiveTime: new Date().toISOString(),
      revokeAllSessions: true, handoffSupervisedQueue: true,
    }, actor.rows[0].employee_id);

    const check = await db.query(
      `SELECT l.owner_employee_id, l.team_id, t.owner_employee_id AS task_owner,
              oe.from_owner_employee_id, oe.to_owner_employee_id
         FROM leads l JOIN lead_tasks t ON t.lead_id = l.id
         JOIN lead_ownership_events oe ON oe.lead_id = l.id WHERE l.id = $1`,
      [lead]
    );
    assert.equal(check.rows.length, 1);
    assert.equal(check.rows[0].owner_employee_id, recipient);
    assert.equal(check.rows[0].team_id, team);
    assert.equal(check.rows[0].task_owner, recipient);
    assert.equal(check.rows[0].from_owner_employee_id, former);
    assert.equal(check.rows[0].to_owner_employee_id, recipient);
    const inbox = await listLeads({
      employeeId: recipient, displayName: 'Offboard 1', role: 'SC',
      assignmentId: `ASG-OFFBOARD-${suffix}-1`, verticals: ['real_estate'], teams: [team],
    }, { search: lead });
    assert.equal(inbox[0]?.reassignedFromName, 'Offboard 0');
  } finally {
    await db.query(`DELETE FROM lead_ownership_events WHERE lead_id = $1`, [lead]);
    await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [lead]);
    await db.query(`DELETE FROM lead_tasks WHERE lead_id = $1`, [lead]);
    await db.query(`DELETE FROM holding_queues WHERE source_employee_id = $1`, [former]);
    await db.query(`DELETE FROM leads WHERE id = $1`, [lead]);
    await db.query(`DELETE FROM round_robin_cursors WHERE team_id = $1`, [team]);
    await db.query(`DELETE FROM system_audit_logs WHERE entity_id = $1`, [former]);
    await db.query(`DELETE FROM assignments WHERE employee_id IN ($1, $2)`, [former, recipient]);
    await db.query(`DELETE FROM employees WHERE id IN ($1, $2)`, [former, recipient]);
    await db.query(`DELETE FROM teams WHERE id = $1`, [team]);
    await db.end();
  }
});

test('date-effective reconciliation holds a lead when its team has no remaining caller', async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  const db = new Pool({ connectionString: env.DATABASE_URL });
  const suffix = randomUUID().slice(0, 8);
  const team = `TEAM-HOLD-${suffix}`;
  const former = `EMP-HOLD-${suffix}`;
  const replacement = `EMP-HOLD-${suffix}-NEW`;
  const lead = `LEAD-HOLD-${suffix}`;
  const task = `TASK-HOLD-${suffix}`;
  try {
    await db.query(`INSERT INTO teams (id, name, vertical) VALUES ($1, 'Hold test team', 'real_estate')`, [team]);
    await db.query(
      `INSERT INTO employees (id, email, password_hash, display_name, status)
       VALUES ($1, $2, 'unusable-test-hash', 'Former caller', 'active')`,
      [former, `hold-${suffix}@example.test`]
    );
    await db.query(
      `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
       VALUES ($1, $2, 'SC', 'real_estate', $3, CURRENT_DATE - 4, CURRENT_DATE - 1)`,
      [`ASG-HOLD-${suffix}`, former, team]
    );
    await db.query(
      `INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product,
                          source, stage, owner_employee_id, team_id)
       VALUES ($1, 'real_estate', 'Held prospect', '91990004321', 'English', 'Advisory', 'Test', 'new', $2, $3)`,
      [lead, former, team]
    );
    await db.query(
      `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
       VALUES ($1, $2, $3, 'call', 'Initial outreach', now() + interval '1 day', 'high', 'open')`,
      [task, lead, former]
    );

    assert.deepEqual(await reconcileFormerCallerLeads(former), { reassigned: 0, held: 1 });
    assert.deepEqual(await reconcileFormerCallerLeads(former), { reassigned: 0, held: 0 }, 'Reconciliation must be idempotent');
    const check = await db.query(
      `SELECT l.owner_employee_id, l.team_id, t.status AS task_status,
              oe.from_owner_employee_id, oe.to_owner_employee_id,
              (SELECT count(*)::int FROM holding_queues WHERE item_id = l.id AND status = 'in_holding') AS holding_count
         FROM leads l JOIN lead_tasks t ON t.lead_id = l.id
         JOIN lead_ownership_events oe ON oe.lead_id = l.id WHERE l.id = $1`,
      [lead]
    );
    assert.equal(check.rows[0].owner_employee_id, null);
    assert.equal(check.rows[0].team_id, team);
    assert.equal(check.rows[0].task_status, 'cancelled');
    assert.equal(check.rows[0].from_owner_employee_id, former);
    assert.equal(check.rows[0].to_owner_employee_id, null);
    assert.equal(check.rows[0].holding_count, 1);

    await db.query(
      `INSERT INTO employees (id, email, password_hash, display_name, status)
       VALUES ($1, $2, 'unusable-test-hash', 'Replacement caller', 'active')`,
      [replacement, `hold-replacement-${suffix}@example.test`]
    );
    await db.query(
      `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
       VALUES ($1, $2, 'SC', 'real_estate', $3, CURRENT_DATE)`,
      [`ASG-HOLD-${suffix}-NEW`, replacement, team]
    );
    assert.deepEqual(await reconcileFormerCallerLeads(former), { reassigned: 1, held: 0 });
    assert.deepEqual(await reconcileFormerCallerLeads(former), { reassigned: 0, held: 0 });
    const restored = await db.query(
      `SELECT l.owner_employee_id, h.status AS holding_status,
              (SELECT count(*)::int FROM lead_tasks t WHERE t.lead_id = l.id
                 AND t.owner_employee_id = $2 AND t.status = 'open') AS open_tasks
         FROM leads l JOIN holding_queues h ON h.item_id = l.id
        WHERE l.id = $1`,
      [lead, replacement]
    );
    assert.equal(restored.rows[0].owner_employee_id, replacement);
    assert.equal(restored.rows[0].holding_status, 'reassigned');
    assert.equal(restored.rows[0].open_tasks, 1);
  } finally {
    await db.query(`DELETE FROM holding_queues WHERE item_id = $1`, [lead]);
    await db.query(`DELETE FROM lead_ownership_events WHERE lead_id = $1`, [lead]);
    await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [lead]);
    await db.query(`DELETE FROM lead_tasks WHERE lead_id = $1`, [lead]);
    await db.query(`DELETE FROM leads WHERE id = $1`, [lead]);
    await db.query(`DELETE FROM round_robin_cursors WHERE team_id = $1`, [team]);
    await db.query(`DELETE FROM assignments WHERE employee_id IN ($1, $2)`, [former, replacement]);
    await db.query(`DELETE FROM employees WHERE id IN ($1, $2)`, [former, replacement]);
    await db.query(`DELETE FROM teams WHERE id = $1`, [team]);
    await db.end();
  }
});

test('promoting a caller to Relationship Manager reassigns their open lead within the former team', async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  const db = new Pool({ connectionString: env.DATABASE_URL });
  const suffix = randomUUID().slice(0, 8);
  const team = `TEAM-PROMOTE-${suffix}`;
  const former = `EMP-PROMOTE-${suffix}-0`;
  const recipient = `EMP-PROMOTE-${suffix}-1`;
  const lead = `LEAD-PROMOTE-${suffix}`;
  try {
    const actor = await db.query(`SELECT employee_id FROM assignments WHERE role = 'SA' LIMIT 1`);
    await db.query(`INSERT INTO teams (id, name, vertical) VALUES ($1, 'Promotion test team', 'real_estate')`, [team]);
    for (const [n, employeeId] of [former, recipient].entries()) {
      await db.query(
        `INSERT INTO employees (id, email, password_hash, display_name, status)
         VALUES ($1, $2, 'unusable-test-hash', $3, 'active')`,
        [employeeId, `promote-${suffix}-${n}@example.test`, `Promote ${n}`]
      );
      await db.query(
        `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
         VALUES ($1, $2, 'SC', 'real_estate', $3, CURRENT_DATE)`,
        [`ASG-PROMOTE-${suffix}-${n}`, employeeId, team]
      );
    }
    await db.query(
      `INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product,
                          source, stage, owner_employee_id, team_id)
       VALUES ($1, 'real_estate', 'Promotion prospect', '91990005678', 'English', 'Advisory', 'Test', 'new', $2, $3)`,
      [lead, former, team]
    );
    const today = (await db.query(`SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today`)).rows[0].today;
    await grantScope({
      employeeId: former, role: 'REL', vertical: 'real_estate', allowedTeamIds: [team],
      effectiveFrom: today, effectiveTo: null, approverReference: 'AUTH-TEST-PROMOTION',
    }, actor.rows[0].employee_id);

    const check = await db.query(
      `SELECT l.owner_employee_id, l.team_id, oe.from_owner_employee_id,
              oe.to_owner_employee_id, a.role AS former_current_role
         FROM leads l JOIN lead_ownership_events oe ON oe.lead_id = l.id
         JOIN assignments a ON a.employee_id = $2 AND a.effective_to IS NULL
        WHERE l.id = $1`,
      [lead, former]
    );
    assert.equal(check.rows[0].owner_employee_id, recipient);
    assert.equal(check.rows[0].team_id, team);
    assert.equal(check.rows[0].from_owner_employee_id, former);
    assert.equal(check.rows[0].to_owner_employee_id, recipient);
    assert.equal(check.rows[0].former_current_role, 'REL');
  } finally {
    await db.query(`DELETE FROM lead_ownership_events WHERE lead_id = $1`, [lead]);
    await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [lead]);
    await db.query(`DELETE FROM leads WHERE id = $1`, [lead]);
    await db.query(`DELETE FROM round_robin_cursors WHERE team_id = $1`, [team]);
    await db.query(`DELETE FROM system_audit_logs WHERE entity_id = $1`, [former]);
    await db.query(`DELETE FROM assignments WHERE employee_id IN ($1, $2)`, [former, recipient]);
    await db.query(`DELETE FROM employees WHERE id IN ($1, $2)`, [former, recipient]);
    await db.query(`DELETE FROM teams WHERE id = $1`, [team]);
    await db.end();
  }
});

test('seven uploaded Real Estate rows are published 4/3 across active callers without crossing verticals', async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  const db = new Pool({ connectionString: env.DATABASE_URL });
  const server = createApp().listen(0);
  const suffix = randomUUID().slice(0, 8);
  let jobId: string | null = null;
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 4000}`;
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'deepa@finverse.demo', password: 'demo1234' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
    const post = (path: string, body: unknown) => fetch(`${base}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    });
    const rows = Array.from({ length: 7 }, (_, n) => ({
      name: `Routing import ${suffix} ${n}`,
      mobile: `98${String(Date.now() % 100000000 + n).padStart(8, '0')}`,
      email: `routing-import-${suffix}-${n}@example.test`,
    }));
    const created = await post('/api/data-entry/bulk-import/jobs', {
      vertical: 'real_estate', fileName: `routing-${suffix}.csv`, sourceType: 'paste', rows,
    });
    assert.equal(created.status, 201);
    jobId = (await created.json() as { id: string }).id;
    const processed = await post(`/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, { chunkSize: 10 });
    assert.equal(processed.status, 200);
    assert.equal((await processed.json() as { assignedCount: number }).assignedCount, 7);
    const report = await fetch(`${base}/api/data-entry/bulk-import/jobs/${jobId}/rows`, { headers: { cookie } });
    assert.equal(report.status, 200);
    const assigned = (await report.json() as { rows: Array<{ status: string; assignedEmployeeId: string }> }).rows;
    assert.equal(assigned.length, 7);
    assert.ok(assigned.every((row: any) => row.status === 'assigned'));
    const counts = ['EMP-026', 'EMP-031'].map((id) =>
      assigned.filter((row: any) => row.assignedEmployeeId === id).length
    ).sort();
    assert.deepEqual(counts, [3, 4]);
    const scoped = await db.query(
      `SELECT l.vertical, l.team_id, a.role, a.vertical AS caller_vertical, a.team_id AS caller_team
         FROM leads l JOIN assignments a ON a.employee_id = l.owner_employee_id
        WHERE l.import_id = $1 AND a.role = 'SC'
          AND a.effective_from <= CURRENT_DATE AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)`,
      [jobId]
    );
    assert.equal(scoped.rows.length, 7);
    assert.ok(scoped.rows.every((row) => row.vertical === 'real_estate'
      && row.caller_vertical === 'real_estate' && row.team_id === row.caller_team));
  } finally {
    if (jobId) {
      const leads = await db.query(`SELECT id FROM leads WHERE import_id = $1`, [jobId]);
      const ids = leads.rows.map((row) => row.id);
      await db.query(`UPDATE prospect_import_rows SET canonical_lead_id = NULL WHERE job_id = $1`, [jobId]);
      if (ids.length) {
        await db.query(`DELETE FROM reminders WHERE task_id IN (SELECT id FROM lead_tasks WHERE lead_id = ANY($1::text[]))`, [ids]);
        await db.query(`DELETE FROM lead_tasks WHERE lead_id = ANY($1::text[])`, [ids]);
        await db.query(`DELETE FROM lead_ownership_events WHERE lead_id = ANY($1::text[])`, [ids]);
        await db.query(`DELETE FROM lead_events WHERE lead_id = ANY($1::text[])`, [ids]);
        await db.query(`DELETE FROM lead_audit WHERE lead_id = ANY($1::text[])`, [ids]);
        await db.query(`DELETE FROM leads WHERE id = ANY($1::text[])`, [ids]);
      }
      await db.query(`DELETE FROM prospect_import_rows WHERE job_id = $1`, [jobId]);
      await db.query(`DELETE FROM prospect_import_jobs WHERE id = $1`, [jobId]);
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.end();
  }
});
