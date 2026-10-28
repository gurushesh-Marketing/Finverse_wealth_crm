import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { allocateCallerForVertical } from './data-entry';
import { pool } from './db';

const ROUTING_ACTOR_ID = 'EMP-SYSTEM-ROUTING';

export interface CallerReassignmentResult {
  reassigned: number;
  held: number;
}

/** Move only open leads whose owner no longer has a current SC grant for that lead's team. */
export async function redistributeFormerCallerLeads(
  client: PoolClient,
  formerCallerId: string,
  actorId: string,
  reason: string
): Promise<CallerReassignmentResult> {
  const { rows: leads } = await client.query<{
    id: string;
    vertical: string;
    team_id: string | null;
    record_version: number;
  }>(
    `SELECT l.id, l.vertical, l.team_id, l.record_version
       FROM leads l
      WHERE l.owner_employee_id = $1
        AND l.stage NOT IN ('converted', 'lost')
        AND NOT (l.rel_owner_id IS NOT NULL AND l.rel_owner_id = l.owner_employee_id AND l.handoff_status = 'accepted')
        AND EXISTS (
          SELECT 1 FROM assignments prior
           WHERE prior.employee_id = l.owner_employee_id
             AND prior.role = 'SC' AND prior.team_id = l.team_id
             AND (prior.vertical = l.vertical OR REPLACE(prior.vertical, '-', '_') = l.vertical)
        )
        AND NOT EXISTS (
          SELECT 1 FROM assignments a JOIN employees e ON e.id = a.employee_id
           WHERE a.employee_id = l.owner_employee_id
             AND a.role = 'SC' AND e.status = 'active'
             AND a.team_id = l.team_id
             AND (a.vertical = l.vertical OR REPLACE(a.vertical, '-', '_') = l.vertical)
             AND a.effective_from <= CURRENT_DATE
             AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
        )
      ORDER BY l.team_id, l.created_at, l.id
      FOR UPDATE OF l`,
    [formerCallerId]
  );

  const result = { reassigned: 0, held: 0 };
  for (const lead of leads) {
    const next = lead.team_id
      ? await allocateCallerForVertical(client, lead.vertical, lead.team_id)
      : null;
    const nextCallerId = next?.teamId === lead.team_id ? next.callerId : null;
    const eventReason = `Automatic same-team caller reassignment: ${reason}`;

    await client.query(
      `UPDATE leads SET owner_employee_id = $2, assigned_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END,
                        updated_at = now(), record_version = record_version + 1
        WHERE id = $1`,
      [lead.id, nextCallerId]
    );
    await client.query(
      `INSERT INTO lead_ownership_events
         (id, lead_id, from_owner_employee_id, to_owner_employee_id,
          actor_employee_id, actor_role, actor_team_id, kind, reason, record_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'transfer', $8, $9)`,
      [`OE-${randomUUID()}`, lead.id, formerCallerId, nextCallerId, actorId,
        actorId === ROUTING_ACTOR_ID ? 'SYSTEM' : 'SA', lead.team_id, eventReason, lead.record_version + 1]
    );
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note)
       VALUES ($1, $2, $3, 'assignment-changed', $4)`,
      [`EV-${randomUUID()}`, lead.id, actorId,
        `${eventReason}. Previous caller ${formerCallerId}; ${nextCallerId ? `new caller ${nextCallerId}` : 'held for supervised allocation'}.`]
    );
    const { rows: importRows } = await client.query<{ job_id: string }>(
      `UPDATE prospect_import_rows
          SET assigned_employee_id = $2,
              assigned_team_id = $3,
              status = CASE WHEN $2::text IS NULL THEN 'unassigned_exception' ELSE 'assigned' END,
              rejection_reason = CASE WHEN $2::text IS NULL THEN $4 ELSE NULL END,
              updated_at = now()
        WHERE canonical_lead_id = $1
        RETURNING job_id`,
      [lead.id, nextCallerId, lead.team_id, nextCallerId ? null : eventReason]
    );
    await client.query(
      `UPDATE intake_rows
          SET status = CASE WHEN $2::text IS NULL THEN 'unassigned_exception' ELSE 'published' END,
              updated_at = now()
        WHERE published_lead_id = $1`,
      [lead.id, nextCallerId]
    );

    if (nextCallerId) {
      await client.query(
        `UPDATE lead_tasks SET owner_employee_id = $3
          WHERE lead_id = $1 AND owner_employee_id = $2 AND status = 'open'`,
        [lead.id, formerCallerId, nextCallerId]
      );
      result.reassigned++;
    } else {
      for (const importRow of importRows) {
        await client.query(
          `UPDATE prospect_import_jobs
              SET assigned_count = GREATEST(0, assigned_count - 1),
                  unassigned_exception_count = unassigned_exception_count + 1,
                  updated_at = now()
            WHERE id = $1`,
          [importRow.job_id]
        );
      }
      await client.query(
        `UPDATE reminders SET status = 'cancelled'
          WHERE status = 'scheduled' AND task_id IN
            (SELECT id FROM lead_tasks WHERE lead_id = $1 AND owner_employee_id = $2 AND status = 'open')`,
        [lead.id, formerCallerId]
      );
      await client.query(
        `UPDATE lead_tasks SET status = 'cancelled'
          WHERE lead_id = $1 AND owner_employee_id = $2 AND status = 'open'`,
        [lead.id, formerCallerId]
      );
      await client.query(
        `INSERT INTO holding_queues
          (id, source_employee_id, item_type, item_id, supervised_by_employee_id, status, notes)
         VALUES ($1, $2, 'lead', $3, $4, 'in_holding', $5)`,
        [`HOLD-${randomUUID()}`, formerCallerId, lead.id, actorId, eventReason]
      );
      result.held++;
    }
  }
  return result;
}

/** Picks up future-dated promotions/transfers once their assignment dates take effect. */
export async function reconcileFormerCallerLeads(onlyEmployeeId?: string): Promise<CallerReassignmentResult> {
  const { rows: formerCallers } = await pool.query<{ owner_employee_id: string }>(
    `SELECT DISTINCT l.owner_employee_id
       FROM leads l
      WHERE l.owner_employee_id IS NOT NULL AND l.stage NOT IN ('converted', 'lost')
        AND ($1::text IS NULL OR l.owner_employee_id = $1)
        AND NOT (l.rel_owner_id IS NOT NULL AND l.rel_owner_id = l.owner_employee_id AND l.handoff_status = 'accepted')
        AND EXISTS (
          SELECT 1 FROM assignments prior
           WHERE prior.employee_id = l.owner_employee_id AND prior.role = 'SC'
             AND prior.team_id = l.team_id
             AND (prior.vertical = l.vertical OR REPLACE(prior.vertical, '-', '_') = l.vertical)
        )
        AND NOT EXISTS (
          SELECT 1 FROM assignments a JOIN employees e ON e.id = a.employee_id
           WHERE a.employee_id = l.owner_employee_id AND a.role = 'SC'
             AND e.status = 'active' AND a.team_id = l.team_id
             AND (a.vertical = l.vertical OR REPLACE(a.vertical, '-', '_') = l.vertical)
             AND a.effective_from <= CURRENT_DATE
             AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
        )
      ORDER BY l.owner_employee_id LIMIT 25`,
    [onlyEmployeeId || null]
  );
  const total = { reassigned: 0, held: 0 };
  for (const row of formerCallers) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [row.owner_employee_id]);
      const moved = await redistributeFormerCallerLeads(
        client, row.owner_employee_id, ROUTING_ACTOR_ID, 'former caller assignment became inactive'
      );
      await client.query('COMMIT');
      total.reassigned += moved.reassigned;
      total.held += moved.held;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  total.reassigned += await resumeHeldCallerLeads(onlyEmployeeId);
  return total;
}

/** Retry only leads held by this routing workflow when a same-team caller becomes available. */
async function resumeHeldCallerLeads(onlyEmployeeId?: string): Promise<number> {
  const client = await pool.connect();
  let recovered = 0;
  try {
    await client.query('BEGIN');
    const { rows: held } = await client.query<{
      holding_id: string;
      lead_id: string;
      former_id: string;
      vertical: string;
      team_id: string;
      is_priority: boolean;
      record_version: number;
    }>(
      `SELECT h.id AS holding_id, l.id AS lead_id, h.source_employee_id AS former_id,
              l.vertical, l.team_id, l.is_priority, l.record_version
         FROM holding_queues h JOIN leads l ON l.id = h.item_id
        WHERE h.item_type = 'lead' AND h.status = 'in_holding'
          AND h.notes LIKE 'Automatic same-team caller reassignment:%'
          AND ($1::text IS NULL OR h.source_employee_id = $1)
          AND l.owner_employee_id IS NULL AND l.team_id IS NOT NULL
          AND l.stage NOT IN ('converted', 'lost')
        ORDER BY h.created_at, h.id LIMIT 100
        FOR UPDATE OF h, l SKIP LOCKED`,
      [onlyEmployeeId || null]
    );
    for (const item of held) {
      const next = await allocateCallerForVertical(client, item.vertical, item.team_id);
      if (!next.callerId || next.teamId !== item.team_id) continue;
      const reason = 'Automatic same-team caller reassignment: capacity restored';
      await client.query(
        `UPDATE leads SET owner_employee_id = $2, assigned_at = now(),
                          updated_at = now(), record_version = record_version + 1
          WHERE id = $1`,
        [item.lead_id, next.callerId]
      );
      await client.query(
        `INSERT INTO lead_ownership_events
           (id, lead_id, from_owner_employee_id, to_owner_employee_id,
            actor_employee_id, actor_role, actor_team_id, kind, reason, record_version)
         VALUES ($1, $2, $3, $4, $5, 'SYSTEM', $6, 'transfer', $7, $8)`,
        [`OE-${randomUUID()}`, item.lead_id, item.former_id, next.callerId,
          ROUTING_ACTOR_ID, item.team_id, reason, item.record_version + 1]
      );
      await client.query(
        `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note)
         VALUES ($1, $2, $3, 'assignment-changed', $4)`,
        [`EV-${randomUUID()}`, item.lead_id, ROUTING_ACTOR_ID,
          `${reason}. Previous caller ${item.former_id}; new caller ${next.callerId}.`]
      );
      await client.query(
        `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, priority, status, due_at)
         VALUES ($1, $2, $3, 'call', 'Initial outreach after reassignment', $4, 'open', now() + interval '24 hours')`,
        [`TSK-${randomUUID()}`, item.lead_id, next.callerId, item.is_priority ? 'urgent' : 'high']
      );
      const { rows: importRows } = await client.query<{ job_id: string }>(
        `UPDATE prospect_import_rows
            SET status = 'assigned', assigned_employee_id = $2, assigned_team_id = $3,
                rejection_reason = NULL, updated_at = now()
          WHERE canonical_lead_id = $1 RETURNING job_id`,
        [item.lead_id, next.callerId, item.team_id]
      );
      for (const importRow of importRows) {
        await client.query(
          `UPDATE prospect_import_jobs
              SET assigned_count = assigned_count + 1,
                  unassigned_exception_count = GREATEST(0, unassigned_exception_count - 1),
                  updated_at = now()
            WHERE id = $1`,
          [importRow.job_id]
        );
      }
      await client.query(
        `UPDATE intake_rows SET status = 'published', updated_at = now()
          WHERE published_lead_id = $1`,
        [item.lead_id]
      );
      await client.query(
        `UPDATE holding_queues SET status = 'reassigned', reassigned_at = now()
          WHERE id = $1`,
        [item.holding_id]
      );
      recovered++;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return recovered;
}
