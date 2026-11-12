import { mkdirSync, readFileSync, existsSync, createWriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import type {
  MetricInspection,
  PerformanceReport,
  ReportExportRecord,
  ReportPeriod,
  ReviewRecord,
  ReviewResponseInput,
} from '@finverse/contracts';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';

const EXPORT_ROOT = resolve(__dirname, '../../../.uploads/exports');
const METRIC_VERSION = 'wealth-metrics-v1';
const PERIOD_TZ = 'Asia/Kolkata (fixed offset +05:30) [ASSUMPTION]';

export const METRIC_VERSION_ID = METRIC_VERSION;

function periodBounds(period: ReportPeriod): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  switch (period) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      break;
    case 'weekly': {
      const day = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'monthly':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'half-year':
      start.setMonth(start.getMonth() < 6 ? 0 : 6, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start, end };
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

export async function computePerformance(scope: Scope, period: ReportPeriod): Promise<PerformanceReport> {
  const { start, end } = periodBounds(period);
  const p = [scope.employeeId, start, end];
  const verifiedCalls = await count(
    `SELECT count(*) AS n FROM calls WHERE actor_employee_id = $1 AND started_at BETWEEN $2 AND $3 AND evidence_status = 'provider-verified'`, p);
  const simulatedCalls = await count(
    `SELECT count(*) AS n FROM calls WHERE actor_employee_id = $1 AND started_at BETWEEN $2 AND $3 AND evidence_status = 'simulated' AND direction = 'outbound'`, p);
  const manualActivities = await count(
    `SELECT count(*) AS n FROM calls WHERE actor_employee_id = $1 AND started_at BETWEEN $2 AND $3 AND evidence_status = 'manual'`, p);
  const followUpsCompleted = await count(
    `SELECT count(*) AS n FROM lead_tasks WHERE owner_employee_id = $1 AND completed_at BETWEEN $2 AND $3 AND status = 'completed'`, p);
  const followUpsDue = await count(
    `SELECT count(*) AS n FROM lead_tasks WHERE owner_employee_id = $1 AND due_at BETWEEN $2 AND $3 AND status = 'open'`, p);
  const qualified = await count(
    `SELECT count(*) AS n FROM qualifications WHERE actor_employee_id = $1 AND created_at BETWEEN $2 AND $3`, p);
  const losses = await count(
    `SELECT count(*) AS n FROM loss_records WHERE actor_employee_id = $1 AND created_at BETWEEN $2 AND $3`, p);
  const conversionsPending = await count(
    `SELECT count(*) AS n FROM outcome_requests WHERE actor_employee_id = $1 AND created_at BETWEEN $2 AND $3 AND type = 'conversion' AND status = 'pending'`, p);
  const conversionsApproved = await count(
    `SELECT count(*) AS n FROM outcome_requests WHERE actor_employee_id = $1 AND created_at BETWEEN $2 AND $3 AND type = 'conversion' AND status = 'approved'`, p);
  const totalTasks = followUpsCompleted + followUpsDue;

  const metrics: MetricInspection[] = [
    { key: 'verified-calls', label: 'Verified calls (provider)', value: verifiedCalls, numerator: verifiedCalls, denominator: 1, formula: 'COUNT(calls WHERE evidence=provider-verified, started in period)', evidenceKind: 'provider-verified' },
    { key: 'simulated-calls', label: 'Simulated calls (never counted as verified)', value: simulatedCalls, numerator: simulatedCalls, denominator: 1, formula: 'COUNT(calls WHERE evidence=simulated, outbound, started in period)', evidenceKind: 'simulated' },
    { key: 'manual-activities', label: 'Manual activities (self-reported)', value: manualActivities, numerator: manualActivities, denominator: 1, formula: 'COUNT(calls WHERE evidence=manual, started in period)', evidenceKind: 'manual' },
    { key: 'follow-ups-completed', label: 'Follow-ups completed', value: followUpsCompleted, numerator: followUpsCompleted, denominator: totalTasks, formula: 'COUNT(tasks completed in period) / COUNT(tasks completed+due in period)', evidenceKind: 'task-event' },
    { key: 'follow-ups-due', label: 'Follow-ups due', value: followUpsDue, numerator: followUpsDue, denominator: totalTasks, formula: 'COUNT(open tasks due in period)', evidenceKind: 'task-event' },
    { key: 'qualifications', label: 'Qualifications saved', value: qualified, numerator: qualified, denominator: 1, formula: 'COUNT(qualifications created in period)', evidenceKind: 'record-event' },
    { key: 'losses', label: 'Losses recorded', value: losses, numerator: losses, denominator: 1, formula: 'COUNT(loss_records created in period)', evidenceKind: 'record-event' },
    { key: 'conversions-pending', label: 'Conversions pending approval (not wins)', value: conversionsPending, numerator: conversionsPending, denominator: 1, formula: 'COUNT(conversion requests created in period AND status=pending)', evidenceKind: 'approval' },
    { key: 'wins-approved', label: 'Wins (approved conversions)', value: conversionsApproved, numerator: conversionsApproved, denominator: Math.max(1, conversionsApproved + losses), formula: 'COUNT(approved conversions in period) / (approved conversions + losses)', evidenceKind: 'approval' },
  ];

  return {
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    timezone: PERIOD_TZ,
    metricVersion: METRIC_VERSION,
    asOf: new Date().toISOString(),
    metrics,
  };
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function createExport(scope: Scope, period: ReportPeriod): Promise<ReportExportRecord> {
  const report = await computePerformance(scope, period);
  const exportId = id('EXP');
  const relPath = `${exportId}.pdf`;
  const absPath = resolve(EXPORT_ROOT, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  await new Promise<void>((resolvePromise, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const stream = createWriteStream(absPath);
    doc.pipe(stream);
    doc.fontSize(18).fillColor('#113F3D').text('Finverse Wealth — Personal Performance', { align: 'left' });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#6B7280')
      .text(`Employee: ${scope.displayName} (${scope.employeeId})  ·  Period: ${report.period} (${report.periodStart.slice(0, 10)} → ${report.periodEnd.slice(0, 10)})`);
    doc.text(`Snapshot: ${report.asOf}  ·  Metric version: ${report.metricVersion}  ·  Timezone: ${report.timezone}`);
    doc.moveDown(0.8);
    doc.fontSize(12).fillColor('#1B1F1E').text('Results', { underline: true });
    doc.moveDown(0.3);
    for (const m of report.metrics) {
      doc.fontSize(10).fillColor('#1B1F1E').text(`${m.label}: ${m.value ?? 'N/A'}`);
      doc.fontSize(8).fillColor('#6B7280').text(`  ${m.formula}  [evidence: ${m.evidenceKind}]`);
      doc.moveDown(0.15);
    }
    doc.moveDown(0.6);
    doc.fontSize(8).fillColor('#6B7280')
      .text(`SYNTHETIC DEMO DATA — generated from stored application events. Watermark: Finverse CRM demo export. Scope re-checked at download.`, { align: 'left' });
    doc.end();
    stream.on('finish', () => resolvePromise());
    stream.on('error', reject);
  });
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);
  await pool.query(
    `INSERT INTO report_exports (id, employee_id, period, snapshot_at, metric_version, storage_path, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [exportId, scope.employeeId, report.period, report.asOf, report.metricVersion, relPath, expiresAt]
  );
  return {
    id: exportId,
    period: report.period,
    snapshotAt: report.asOf,
    metricVersion: report.metricVersion,
    expiresAt: expiresAt.toISOString(),
    downloadPath: `/api/reports/exports/${exportId}/download`,
  };
}

export async function downloadExport(scope: Scope, exportId: string): Promise<{ filename: string; bytes: Buffer }> {
  const { rows } = await pool.query(`SELECT * FROM report_exports WHERE id = $1`, [exportId]);
  const row = rows[0];
  if (!row || row.employee_id !== scope.employeeId) throw notFound();
  if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw forbidden('This export is revoked or expired.');
  }
  const absPath = resolve(EXPORT_ROOT, row.storage_path);
  if (!existsSync(absPath)) throw notFound();
  return { filename: `finverse-performance-${row.period}.pdf`, bytes: readFileSync(absPath) };
}

export async function listReviews(scope: Scope): Promise<ReviewRecord[]> {
  const { rows } = await pool.query(
    `SELECT r.*, e.display_name AS reviewer_name FROM reviews r
     JOIN employees e ON e.id = r.reviewer_employee_id
     WHERE r.employee_id = $1 ORDER BY r.created_at DESC`,
    [scope.employeeId]
  );
  return rows.map((r: any) => ({
    id: r.id,
    period: r.period,
    reviewerName: r.reviewer_name,
    scorecard: r.scorecard,
    selfReflection: r.self_reflection,
    commitments: r.commitments ?? [],
    employeeResponse: r.employee_response,
    acknowledgedAt: r.acknowledged_at ? new Date(r.acknowledged_at).toISOString() : null,
  }));
}

export async function respondToReview(scope: Scope, reviewId: string, input: ReviewResponseInput) {
  const { rows } = await pool.query(`SELECT * FROM reviews WHERE id = $1 AND employee_id = $2`, [reviewId, scope.employeeId]);
  const review = rows[0];
  if (!review) throw notFound();
  if (review.acknowledged_at) {
    throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'This review is already acknowledged.');
  }
  const commitments = input.commitments.map((c) => ({ ...c, completed: false }));
  for (const c of commitments) {
    await pool.query(
      `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
       SELECT $1, l.id, $2, 'other', $3, $4, 'normal', 'open'
       FROM leads l WHERE l.owner_employee_id = $2 ORDER BY l.id LIMIT 1`,
      [id('TASK'), scope.employeeId, `One-to-one commitment: ${c.text}`, new Date(c.dueAt)]
    );
  }
  await pool.query(
    `UPDATE reviews SET self_reflection = $2, commitments = $3, employee_response = $4, acknowledged_at = now() WHERE id = $1`,
    [reviewId, input.selfReflection, JSON.stringify(commitments), input.employeeResponse ?? null]
  );
  return { ok: true, acknowledged: true };
}
