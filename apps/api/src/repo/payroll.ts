import { Pool } from 'pg';
import { env } from '../config';
import type {
  CreateCompensationPlanInput,
  CompensationPlanRecord,
  CompensationAuditRecord,
  PayrollCycleRecord,
  PayrollPreviewQuery,
  PayrollPreviewItem,
  PayrollPreviewResponse,
  FinalizePayrollInput,
  DivisorFormulaPolicy,
} from '@finverse/contracts';

const pool = new Pool({ connectionString: env.DATABASE_URL });

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface ActorSession {
  employeeId: string;
  role: string;
  verticalGrants: string[];
  teamGrants?: string[];
  displayName?: string;
}

export const AUTHORIZED_PAYROLL_ROLES = ['HR', 'CFO', 'SA', 'CEO'];

export function assertPayrollAccess(actor: ActorSession): void {
  if (!AUTHORIZED_PAYROLL_ROLES.includes(actor.role)) {
    const err: any = new Error(
      `Access to employee compensation plans and payroll preview engine is restricted to authorized HR and Executive Finance roles. Role '${actor.role}' is not authorized.`
    );
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
}

// ============================================================================
// 1. Compensation Plans & Audit History
// ============================================================================

export async function getCompensationPlans(
  actor: ActorSession,
  filter?: { employee_id?: string; vertical?: string; active_only?: boolean }
): Promise<CompensationPlanRecord[]> {
  assertPayrollAccess(actor);
  const client = await pool.connect();
  try {
    let sql = `
      SELECT 
        cp.id,
        cp.employee_id,
        e.display_name AS employee_name,
        a.role,
        a.vertical,
        t.name AS team_name,
        TO_CHAR(COALESCE(e.joining_date, '2026-01-01'::date), 'YYYY-MM-DD') AS joining_date,
        TO_CHAR(cp.effective_from, 'YYYY-MM-DD') AS effective_from,
        TO_CHAR(cp.effective_to, 'YYYY-MM-DD') AS effective_to,
        cp.currency,
        cp.monthly_ctc::numeric::float AS monthly_ctc,
        cp.basic_pay::numeric::float AS basic_pay,
        cp.hra::numeric::float AS hra,
        cp.special_allowance::numeric::float AS special_allowance,
        cp.statutory_pf_employee::numeric::float AS statutory_pf_employee,
        cp.statutory_pf_employer::numeric::float AS statutory_pf_employer,
        cp.professional_tax::numeric::float AS professional_tax,
        cp.tds_estimate::numeric::float AS tds_estimate,
        cp.notes,
        cp.created_by_employee_id,
        cp.created_at::text AS created_at,
        cp.record_version
      FROM employee_compensation_plans cp
      JOIN employees e ON e.id = cp.employee_id
      LEFT JOIN assignments a ON a.employee_id = cp.employee_id AND a.effective_to IS NULL
      LEFT JOIN teams t ON t.id = a.team_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter?.employee_id) {
      params.push(filter.employee_id);
      sql += ` AND cp.employee_id = $${params.length}`;
    }
    if (filter?.vertical && filter.vertical !== 'all') {
      params.push(filter.vertical);
      sql += ` AND a.vertical = $${params.length}`;
    }
    if (filter?.active_only) {
      sql += ` AND (cp.effective_to IS NULL OR cp.effective_to >= CURRENT_DATE)`;
    }

    sql += ` ORDER BY cp.employee_id ASC, cp.effective_from DESC`;
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

export async function getCompensationPlanById(
  actor: ActorSession,
  id: string
): Promise<CompensationPlanRecord | null> {
  assertPayrollAccess(actor);
  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      SELECT 
        cp.id,
        cp.employee_id,
        e.display_name AS employee_name,
        a.role,
        a.vertical,
        t.name AS team_name,
        TO_CHAR(COALESCE(e.joining_date, '2026-01-01'::date), 'YYYY-MM-DD') AS joining_date,
        TO_CHAR(cp.effective_from, 'YYYY-MM-DD') AS effective_from,
        TO_CHAR(cp.effective_to, 'YYYY-MM-DD') AS effective_to,
        cp.currency,
        cp.monthly_ctc::numeric::float AS monthly_ctc,
        cp.basic_pay::numeric::float AS basic_pay,
        cp.hra::numeric::float AS hra,
        cp.special_allowance::numeric::float AS special_allowance,
        cp.statutory_pf_employee::numeric::float AS statutory_pf_employee,
        cp.statutory_pf_employer::numeric::float AS statutory_pf_employer,
        cp.professional_tax::numeric::float AS professional_tax,
        cp.tds_estimate::numeric::float AS tds_estimate,
        cp.notes,
        cp.created_by_employee_id,
        cp.created_at::text AS created_at,
        cp.record_version
      FROM employee_compensation_plans cp
      JOIN employees e ON e.id = cp.employee_id
      LEFT JOIN assignments a ON a.employee_id = cp.employee_id AND a.effective_to IS NULL
      LEFT JOIN teams t ON t.id = a.team_id
      WHERE cp.id = $1
      `,
      [id]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getCompensationAuditHistory(
  actor: ActorSession,
  employeeId?: string
): Promise<CompensationAuditRecord[]> {
  assertPayrollAccess(actor);
  const client = await pool.connect();
  try {
    let sql = `
      SELECT 
        cl.id,
        cl.plan_id,
        cl.employee_id,
        cl.changed_by_employee_id,
        cb.display_name AS changed_by_name,
        cl.action,
        cl.previous_state,
        cl.new_state,
        cl.reason,
        cl.created_at::text AS created_at
      FROM compensation_change_logs cl
      LEFT JOIN employees cb ON cb.id = cl.changed_by_employee_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (employeeId) {
      params.push(employeeId);
      sql += ` AND cl.employee_id = $${params.length}`;
    }
    sql += ` ORDER BY cl.created_at DESC LIMIT 100`;
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

export async function createOrUpdateCompensationPlan(
  actor: ActorSession,
  input: CreateCompensationPlanInput
): Promise<CompensationPlanRecord> {
  assertPayrollAccess(actor);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify target employee exists
    const empRes = await client.query('SELECT id, display_name FROM employees WHERE id = $1', [
      input.employee_id,
    ]);
    if (empRes.rows.length === 0) {
      const err: any = new Error(`Employee '${input.employee_id}' not found.`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 2. Find currently active plan for this employee
    const activeRes = await client.query(
      `SELECT * FROM employee_compensation_plans 
       WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= $2)
       ORDER BY effective_from DESC LIMIT 1`,
      [input.employee_id, input.effective_from]
    );

    let action: 'created' | 'revised' = 'created';
    let previousState: any = null;

    if (activeRes.rows.length > 0) {
      action = 'revised';
      const prev = activeRes.rows[0];
      previousState = {
        id: prev.id,
        monthly_ctc: Number(prev.monthly_ctc),
        basic_pay: Number(prev.basic_pay),
        hra: Number(prev.hra),
        special_allowance: Number(prev.special_allowance),
        effective_from: prev.effective_from,
        effective_to: prev.effective_to,
      };

      // Close the previous plan with effective_to = day before new effective_from, guaranteed >= effective_from
      await client.query(
        `UPDATE employee_compensation_plans 
         SET effective_to = GREATEST(effective_from, ($2::date - interval '1 day')::date),
             record_version = record_version + 1
         WHERE id = $1`,
        [prev.id, input.effective_from]
      );
    }

    // 3. Insert new effective-dated compensation plan
    const newId = `PLAN-${input.employee_id}-${makeId()}`;
    await client.query(
      `INSERT INTO employee_compensation_plans (
        id, employee_id, effective_from, effective_to, currency,
        monthly_ctc, basic_pay, hra, special_allowance,
        statutory_pf_employee, statutory_pf_employer, professional_tax, tds_estimate,
        notes, created_by_employee_id
      ) VALUES ($1, $2, $3, $4, 'INR', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        newId,
        input.employee_id,
        input.effective_from,
        input.effective_to || null,
        input.monthly_ctc,
        input.basic_pay,
        input.hra,
        input.special_allowance,
        input.statutory_pf_employee ?? 1800,
        input.statutory_pf_employer ?? 1800,
        input.professional_tax ?? 200,
        input.tds_estimate ?? 0,
        input.notes || null,
        actor.employeeId,
      ]
    );

    // 4. Record audit change log
    const newState = {
      id: newId,
      monthly_ctc: input.monthly_ctc,
      basic_pay: input.basic_pay,
      hra: input.hra,
      special_allowance: input.special_allowance,
      effective_from: input.effective_from,
      effective_to: input.effective_to || null,
    };
    const logId = `LOG-${makeId()}`;
    await client.query(
      `INSERT INTO compensation_change_logs (
        id, plan_id, employee_id, changed_by_employee_id, action, previous_state, new_state, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        logId,
        newId,
        input.employee_id,
        actor.employeeId,
        action,
        previousState ? JSON.stringify(previousState) : null,
        JSON.stringify(newState),
        input.reason,
      ]
    );

    await client.query('COMMIT');

    const created = await getCompensationPlanById(actor, newId);
    return created!;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// 2. Payroll Cycles
// ============================================================================

export async function getPayrollCycles(actor: ActorSession): Promise<PayrollCycleRecord[]> {
  assertPayrollAccess(actor);
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        id,
        cycle_code,
        cycle_label,
        TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
        TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
        total_calendar_days,
        status,
        is_initial_joiner_cycle,
        unresolved_policy_gates,
        policy_block_notes,
        created_at::text AS created_at
      FROM payroll_cycles
      ORDER BY period_start_date DESC
    `);
    return res.rows;
  } finally {
    client.release();
  }
}

export async function getPayrollCycleByCode(
  actor: ActorSession,
  cycleCode: string
): Promise<PayrollCycleRecord | null> {
  assertPayrollAccess(actor);
  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      SELECT 
        id,
        cycle_code,
        cycle_label,
        TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
        TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
        total_calendar_days,
        status,
        is_initial_joiner_cycle,
        unresolved_policy_gates,
        policy_block_notes,
        created_at::text AS created_at
      FROM payroll_cycles
      WHERE cycle_code = $1
      `,
      [cycleCode]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

// ============================================================================
// 3. Calculation Preview Engine
// ============================================================================

export async function calculatePayrollPreview(
  actor: ActorSession,
  query: PayrollPreviewQuery
): Promise<PayrollPreviewResponse> {
  assertPayrollAccess(actor);
  const client = await pool.connect();
  try {
    // 1. Resolve payroll cycle
    const cycle = await getPayrollCycleByCode(actor, query.cycle_code);
    if (!cycle) {
      const err: any = new Error(`Payroll cycle '${query.cycle_code}' not found.`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const divisorPolicy: DivisorFormulaPolicy = query.divisor_policy || '30_day_fixed';

    // 2. Fetch target employees with their effective compensation plan for this cycle
    let empSql = `
      SELECT 
        e.id AS employee_id,
        e.display_name AS employee_name,
        e.work_location_id,
        wl.name AS work_location_name,
        wl.weekly_off_days,
        TO_CHAR(COALESCE(e.joining_date, '2026-01-01'::date), 'YYYY-MM-DD') AS joining_date,
        a.role,
        a.vertical,
        t.name AS team_name,
        cp.id AS plan_id,
        cp.monthly_ctc::numeric::float AS monthly_ctc,
        cp.basic_pay::numeric::float AS basic_pay,
        cp.hra::numeric::float AS hra,
        cp.special_allowance::numeric::float AS special_allowance,
        cp.statutory_pf_employee::numeric::float AS statutory_pf_employee,
        cp.statutory_pf_employer::numeric::float AS statutory_pf_employer,
        cp.professional_tax::numeric::float AS professional_tax,
        cp.tds_estimate::numeric::float AS tds_estimate
      FROM employees e
      LEFT JOIN work_locations wl ON wl.id = e.work_location_id
      LEFT JOIN assignments a ON a.employee_id = e.id AND a.effective_to IS NULL
      LEFT JOIN teams t ON t.id = a.team_id
      JOIN LATERAL (
        SELECT * FROM employee_compensation_plans 
        WHERE employee_id = e.id 
          AND effective_from <= $2::date
          AND (effective_to IS NULL OR effective_to >= $1::date)
        ORDER BY effective_from DESC
        LIMIT 1
      ) cp ON true
      WHERE e.status = 'active'
    `;
    const params: any[] = [cycle.period_start_date, cycle.period_end_date];

    if (query.vertical && query.vertical !== 'all') {
      params.push(query.vertical);
      empSql += ` AND a.vertical = $${params.length}`;
    }
    if (query.team_id) {
      params.push(query.team_id);
      empSql += ` AND a.team_id = $${params.length}`;
    }
    if (query.employee_id) {
      params.push(query.employee_id);
      empSql += ` AND e.id = $${params.length}`;
    }

    empSql += ` ORDER BY a.vertical ASC, a.role ASC, e.display_name ASC`;
    const empRows = (await client.query(empSql, params)).rows;

    const startDate = new Date(cycle.period_start_date);
    const endDate = new Date(cycle.period_end_date);
    const cycleTotalCalendarDays = cycle.total_calendar_days;

    const previewItems: PayrollPreviewItem[] = [];
    let midCycleJoinersCount = 0;
    let totalGrossPayable = 0;
    let totalStatutoryDeductions = 0;
    let totalNetPayable = 0;

    for (const emp of empRows) {
      const joiningDate = new Date(emp.joining_date);
      const isMidCycleJoiner = cycle.is_initial_joiner_cycle || (joiningDate > startDate && joiningDate <= endDate);
      if (isMidCycleJoiner) {
        midCycleJoinersCount++;
      }

      // Calculate effective active span for this employee in this cycle
      const effectiveStart = isMidCycleJoiner ? joiningDate : startDate;
      const effectiveEnd = endDate;

      // Active calendar days inclusive
      const diffTime = effectiveEnd.getTime() - effectiveStart.getTime();
      const activeEmploymentDays = Math.max(
        0,
        Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
      );

      // Query attendance records in active range
      const attRes = await client.query(
        `SELECT work_date, work_mode, status, is_offline_work
         FROM attendance_records
         WHERE employee_id = $1 AND work_date >= $2 AND work_date <= $3`,
        [emp.employee_id, effectiveStart.toISOString().slice(0, 10), effectiveEnd.toISOString().slice(0, 10)]
      );
      // Confirmed or pending attendance records count as attended
      const attendedDays = attRes.rows.filter((r) =>
        ['confirmed', 'pending_confirmation'].includes(r.status)
      ).length;

      // Query approved leave requests
      const leaveRes = await client.query(
        `SELECT leave_type, total_days, start_date, end_date
         FROM employee_leave_requests
         WHERE employee_id = $1 
           AND status = 'approved'
           AND start_date <= $3 
           AND end_date >= $2`,
        [emp.employee_id, effectiveStart.toISOString().slice(0, 10), effectiveEnd.toISOString().slice(0, 10)]
      );
      let approvedPaidLeaveDays = 0;
      let unpaidLeaveDays = 0;
      for (const l of leaveRes.rows) {
        const days = Number(l.total_days);
        if (l.leave_type === 'unpaid') {
          unpaidLeaveDays += days;
        } else {
          approvedPaidLeaveDays += days;
        }
      }

      // Count weekly offs and location statutory holidays within active span
      const weeklyOffDaysSet = new Set<number>(emp.weekly_off_days || [0, 6]);
      let weeklyOffCount = 0;
      let weekdayCount = 0;
      const cur = new Date(effectiveStart);
      while (cur <= effectiveEnd) {
        const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
        if (weeklyOffDaysSet.has(dayOfWeek)) {
          weeklyOffCount++;
        } else {
          weekdayCount++;
        }
        cur.setDate(cur.getDate() + 1);
      }

      // Query location statutory holidays
      const holRes = await client.query(
        `SELECT ch.holiday_date, ch.holiday_name
         FROM calendar_holidays ch
         JOIN holiday_calendars hc ON hc.id = ch.calendar_id
         WHERE hc.work_location_id = $1 
           AND ch.holiday_date >= $2 
           AND ch.holiday_date <= $3`,
        [emp.work_location_id || 'LOC-MUM', effectiveStart.toISOString().slice(0, 10), effectiveEnd.toISOString().slice(0, 10)]
      );
      // Only count holidays on weekdays (not already counting as weekly off)
      let holidayCount = 0;
      for (const h of holRes.rows) {
        const hDate = new Date(h.holiday_date);
        if (!weeklyOffDaysSet.has(hDate.getDay())) {
          holidayCount++;
        }
      }

      // Scheduled working days in active span
      const scheduledWorkingDays = Math.max(1, weekdayCount - holidayCount);

      // Invariant: Never silently turn missing CRM updates or WFH into an automatic deduction.
      // Covered payable days = active calendar days minus unexcused absence
      // If there are explicit unpaid leaves, reduce covered days; otherwise, employee is covered
      const unexcusedLopDays = unpaidLeaveDays;
      const coveredPayableDays = Math.max(0, activeEmploymentDays - unexcusedLopDays);

      // Calculate Pro-Rata Multiplier according to selected divisor formula policy
      let divisorUsed = 30;
      let proRataFactor = 1.0;

      if (divisorPolicy === '30_day_fixed') {
        divisorUsed = 30;
        proRataFactor = Math.min(1.0, Number((coveredPayableDays / 30).toFixed(6)));
      } else if (divisorPolicy === 'applicable_working_days') {
        divisorUsed = scheduledWorkingDays;
        const workedOrPaidDays = attendedDays + approvedPaidLeaveDays + holidayCount;
        proRataFactor = Math.min(
          1.0,
          Number((Math.min(scheduledWorkingDays, workedOrPaidDays || scheduledWorkingDays) / scheduledWorkingDays).toFixed(6))
        );
      } else if (divisorPolicy === 'calendar_days') {
        divisorUsed = cycleTotalCalendarDays;
        proRataFactor = Math.min(1.0, Number((coveredPayableDays / cycleTotalCalendarDays).toFixed(6)));
      }

      // Earned component calculations
      const basicRate = emp.basic_pay;
      const hraRate = emp.hra;
      const specialRate = emp.special_allowance;

      const earnedBasic = Number((basicRate * proRataFactor).toFixed(2));
      const earnedHra = Number((hraRate * proRataFactor).toFixed(2));
      const earnedSpecial = Number((specialRate * proRataFactor).toFixed(2));
      const grossPayable = Number((earnedBasic + earnedHra + earnedSpecial).toFixed(2));

      // Statutory deductions (pro-rated if applicable, standard caps)
      const pfDeduction = Number((emp.statutory_pf_employee || 1800).toFixed(2));
      const ptDeduction = Number((emp.professional_tax || 200).toFixed(2));
      const tdsEstimate = Number(((emp.tds_estimate || 0) * proRataFactor).toFixed(2));
      const totalDeductions = Number((pfDeduction + ptDeduction + tdsEstimate).toFixed(2));

      const netPayable = Math.max(0, Number((grossPayable - totalDeductions).toFixed(2)));

      totalGrossPayable += grossPayable;
      totalStatutoryDeductions += totalDeductions;
      totalNetPayable += netPayable;

      const calculationNotes: string[] = [
        `Base Monthly CTC: ₹${emp.monthly_ctc.toLocaleString('en-IN')}`,
        `Divisor formula policy: '${divisorPolicy}' (divisor used: ${divisorUsed})`,
        `Covered payable days: ${coveredPayableDays} of ${activeEmploymentDays} active days (pro-rata factor: ${(proRataFactor * 100).toFixed(2)}%)`,
        `Attended: ${attendedDays}d, Approved paid leave: ${approvedPaidLeaveDays}d, Holidays: ${holidayCount}d, Weekly offs: ${weeklyOffCount}d`,
        `No deduction applied for missing CRM updates or WFH (offline work protected under policy)`,
      ];

      const policyWarnings: string[] = [];
      if (isMidCycleJoiner) {
        policyWarnings.push(
          `Mid-Cycle Joiner: Joined on ${emp.joining_date}. Initial period spans ${emp.joining_date} to ${cycle.period_end_date} (${activeEmploymentDays} inclusive calendar days). Earned wages cannot be held until 28 February [Deck P320 Category 4].`
        );
      }
      policyWarnings.push(
        `First-pay date and 30-day divisor vs working-day formula are pending executive policy confirmation [Deck P320]. Finalization and bank payment export are locked.`
      );

      previewItems.push({
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        role: emp.role || 'Unassigned',
        vertical: emp.vertical || 'corporate',
        team_name: emp.team_name || 'General Operations',
        work_location: emp.work_location_name || 'Mumbai Main Campus',
        joining_date: emp.joining_date,
        is_mid_cycle_joiner: isMidCycleJoiner,
        active_employment_days_in_cycle: activeEmploymentDays,
        cycle_calendar_days: cycleTotalCalendarDays,
        scheduled_working_days: scheduledWorkingDays,
        attended_days: attendedDays,
        approved_paid_leave_days: approvedPaidLeaveDays,
        holiday_days: holidayCount,
        weekly_off_days: weeklyOffCount,
        covered_payable_days: coveredPayableDays,
        unexcused_lop_days: unexcusedLopDays,
        selected_divisor_policy: divisorPolicy,
        divisor_used: divisorUsed,
        pro_rata_factor: proRataFactor,
        monthly_ctc: emp.monthly_ctc,
        basic_pay_rate: basicRate,
        hra_rate: hraRate,
        special_allowance_rate: specialRate,
        earned_basic: earnedBasic,
        earned_hra: earnedHra,
        earned_special_allowance: earnedSpecial,
        gross_payable: grossPayable,
        statutory_deductions: {
          pf_employee: pfDeduction,
          professional_tax: ptDeduction,
          tds_estimate: tdsEstimate,
          total_deductions: totalDeductions,
        },
        net_payable_preview: netPayable,
        calculation_notes: calculationNotes,
        policy_warnings: policyWarnings,
      });
    }

    return {
      cycle,
      selected_divisor_policy: divisorPolicy,
      items: previewItems,
      summary: {
        total_employees: previewItems.length,
        mid_cycle_joiners_count: midCycleJoinersCount,
        total_gross_payable: Number(totalGrossPayable.toFixed(2)),
        total_statutory_deductions: Number(totalStatutoryDeductions.toFixed(2)),
        total_net_payable: Number(totalNetPayable.toFixed(2)),
      },
      policy_gates: {
        finalization_allowed: false,
        payment_export_allowed: false,
        gate_reasons: [
          'First-payment deadline for mid-cycle joiners (e.g., 10 Jan) requires client executive policy confirmation [Deck P320 Category 4].',
          'Payable-day pro-rata divisor formula (30-day fixed vs working-days vs calendar-days) requires statutory legal sign-off [Deck P320 Category 2].',
          'Statutory deduction schedules and leave-pay rules require board ratification [Deck P320 Category 3].',
          'Payment disbursement file generation and finalization are blocked until policies are confirmed.',
        ],
      },
    };
  } finally {
    client.release();
  }
}

// ============================================================================
// 4. Policy-Blocked Finalization Endpoint
// ============================================================================

export async function finalizePayrollCycle(
  actor: ActorSession,
  input: FinalizePayrollInput
): Promise<PayrollCycleRecord> {
  assertPayrollAccess(actor);

  // Strict Policy Gate: Block finalization until client executive legal confirmation token is supplied
  if (!input.legal_confirmation_token || !input.confirmed_first_pay_date || !input.confirmed_divisor_policy) {
    const err: any = new Error(
      `Payroll finalization and payment export are blocked pending executive legal confirmation of the first lawful payment date and statutory pro-rata divisor [Deck P320]. Client policy decisions are not yet confirmed.`
    );
    err.status = 422;
    err.code = 'UNRESOLVED_POLICY_GATES';
    err.details = {
      first_payment_date_confirmed: Boolean(input.confirmed_first_pay_date),
      divisor_formula_confirmed: Boolean(input.confirmed_divisor_policy),
      legal_token_present: Boolean(input.legal_confirmation_token),
      required_policy_categories: [
        'Deck P320 Category 4: Targets and periods (first lawful payout date)',
        'Deck P320 Category 2: Commercial events (statutory pro-rata divisor formula)',
        'Deck P320 Category 3: Approvals and limits (board ratification)',
      ],
    };
    throw err;
  }

  const client = await pool.connect();
  try {
    const cycle = await getPayrollCycleByCode(actor, input.cycle_code);
    if (!cycle) {
      const err: any = new Error(`Payroll cycle '${input.cycle_code}' not found.`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    await client.query(
      `UPDATE payroll_cycles 
       SET status = 'locked',
           unresolved_policy_gates = '{
             "first_payment_date_confirmed": true,
             "divisor_formula_confirmed": true,
             "statutory_rules_confirmed": true,
             "leave_pay_rules_confirmed": true
           }'::jsonb
       WHERE cycle_code = $1`,
      [input.cycle_code]
    );

    const updated = await getPayrollCycleByCode(actor, input.cycle_code);
    return updated!;
  } finally {
    client.release();
  }
}
