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
import { eq, and, gte, lte, desc, asc, count, sql } from 'drizzle-orm';
import { db } from './db';
import {
  calls,
  leadTasks,
  qualifications,
  lossRecords,
  outcomeRequests,
  reportExports,
  reviews,
  employees,
  leads,
} from '../db/schema';
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

export async function computePerformance(scope: Scope, period: ReportPeriod): Promise<PerformanceReport> {
  const { start, end } = periodBounds(period);

  const [verifiedCallsRes] = await db
    .select({ n: count() })
    .from(calls)
    .where(
      and(
        eq(calls.actorEmployeeId, scope.employeeId),
        gte(calls.startedAt, sql`${start}`),
        lte(calls.startedAt, sql`${end}`),
        eq(calls.evidenceStatus, 'provider-verified')
      )
    );
  const verifiedCalls = Number(verifiedCallsRes?.n ?? 0);

  const [simulatedCallsRes] = await db
    .select({ n: count() })
    .from(calls)
    .where(
      and(
        eq(calls.actorEmployeeId, scope.employeeId),
        gte(calls.startedAt, sql`${start}`),
        lte(calls.startedAt, sql`${end}`),
        eq(calls.evidenceStatus, 'simulated'),
        eq(calls.direction, 'outbound')
      )
    );
  const simulatedCalls = Number(simulatedCallsRes?.n ?? 0);

  const [manualActivitiesRes] = await db
    .select({ n: count() })
    .from(calls)
    .where(
      and(
        eq(calls.actorEmployeeId, scope.employeeId),
        gte(calls.startedAt, sql`${start}`),
        lte(calls.startedAt, sql`${end}`),
        eq(calls.evidenceStatus, 'manual')
      )
    );
  const manualActivities = Number(manualActivitiesRes?.n ?? 0);

  const [followUpsCompletedRes] = await db
    .select({ n: count() })
    .from(leadTasks)
    .where(
      and(
        eq(leadTasks.ownerEmployeeId, scope.employeeId),
        gte(leadTasks.completedAt, sql`${start}`),
        lte(leadTasks.completedAt, sql`${end}`),
        eq(leadTasks.status, 'completed')
      )
    );
  const followUpsCompleted = Number(followUpsCompletedRes?.n ?? 0);

  const [followUpsDueRes] = await db
    .select({ n: count() })
    .from(leadTasks)
    .where(
      and(
        eq(leadTasks.ownerEmployeeId, scope.employeeId),
        gte(leadTasks.dueAt, sql`${start}`),
        lte(leadTasks.dueAt, sql`${end}`),
        eq(leadTasks.status, 'open')
      )
    );
  const followUpsDue = Number(followUpsDueRes?.n ?? 0);

  const [qualifiedRes] = await db
    .select({ n: count() })
    .from(qualifications)
    .where(
      and(
        eq(qualifications.actorEmployeeId, scope.employeeId),
        gte(qualifications.createdAt, sql`${start}`),
        lte(qualifications.createdAt, sql`${end}`)
      )
    );
  const qualified = Number(qualifiedRes?.n ?? 0);

  const [lossesRes] = await db
    .select({ n: count() })
    .from(lossRecords)
    .where(
      and(
        eq(lossRecords.actorEmployeeId, scope.employeeId),
        gte(lossRecords.createdAt, sql`${start}`),
        lte(lossRecords.createdAt, sql`${end}`)
      )
    );
  const losses = Number(lossesRes?.n ?? 0);

  const [conversionsPendingRes] = await db
    .select({ n: count() })
    .from(outcomeRequests)
    .where(
      and(
        eq(outcomeRequests.actorEmployeeId, scope.employeeId),
        gte(outcomeRequests.createdAt, sql`${start}`),
        lte(outcomeRequests.createdAt, sql`${end}`),
        eq(outcomeRequests.type, 'conversion'),
        eq(outcomeRequests.status, 'pending')
      )
    );
  const conversionsPending = Number(conversionsPendingRes?.n ?? 0);

  const [conversionsApprovedRes] = await db
    .select({ n: count() })
    .from(outcomeRequests)
    .where(
      and(
        eq(outcomeRequests.actorEmployeeId, scope.employeeId),
        gte(outcomeRequests.createdAt, sql`${start}`),
        lte(outcomeRequests.createdAt, sql`${end}`),
        eq(outcomeRequests.type, 'conversion'),
        eq(outcomeRequests.status, 'approved')
      )
    );
  const conversionsApproved = Number(conversionsApprovedRes?.n ?? 0);

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
  await db.insert(reportExports).values({
    id: exportId,
    employeeId: scope.employeeId,
    period: report.period,
    snapshotAt: report.asOf,
    metricVersion: report.metricVersion,
    storagePath: relPath,
    expiresAt: expiresAt.toISOString(),
  });
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
  const [row] = await db.select().from(reportExports).where(eq(reportExports.id, exportId));
  if (!row || row.employeeId !== scope.employeeId) throw notFound();
  if (row.revokedAt || new Date(row.expiresAt).getTime() < Date.now()) {
    throw forbidden('This export is revoked or expired.');
  }
  const absPath = resolve(EXPORT_ROOT, row.storagePath);
  if (!existsSync(absPath)) throw notFound();
  return { filename: `finverse-performance-${row.period}.pdf`, bytes: readFileSync(absPath) };
}

export async function listReviews(scope: Scope): Promise<ReviewRecord[]> {
  const rows = await db
    .select({
      id: reviews.id,
      period: reviews.period,
      reviewerName: employees.displayName,
      scorecard: reviews.scorecard,
      selfReflection: reviews.selfReflection,
      commitments: reviews.commitments,
      employeeResponse: reviews.employeeResponse,
      acknowledgedAt: reviews.acknowledgedAt,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(employees, eq(employees.id, reviews.reviewerEmployeeId))
    .where(eq(reviews.employeeId, scope.employeeId))
    .orderBy(desc(reviews.createdAt));

  return rows.map((r) => ({
    id: r.id,
    period: r.period,
    reviewerName: r.reviewerName,
    scorecard: (r.scorecard as Record<string, unknown>) ?? {},
    selfReflection: r.selfReflection,
    commitments: (r.commitments as any) ?? [],
    employeeResponse: r.employeeResponse,
    acknowledgedAt: r.acknowledgedAt ? new Date(r.acknowledgedAt).toISOString() : null,
  }));
}

export async function respondToReview(scope: Scope, reviewId: string, input: ReviewResponseInput) {
  const [review] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.employeeId, scope.employeeId)));
  if (!review) throw notFound();
  if (review.acknowledgedAt) {
    throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'This review is already acknowledged.');
  }
  const commitments = input.commitments.map((c) => ({ ...c, completed: false }));

  await db.transaction(async (tx) => {
    for (const c of commitments) {
      const [lead] = await tx
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.ownerEmployeeId, scope.employeeId))
        .orderBy(asc(leads.id))
        .limit(1);

      if (lead) {
        await tx.insert(leadTasks).values({
          id: id('TASK'),
          leadId: lead.id,
          ownerEmployeeId: scope.employeeId,
          action: 'other',
          purpose: `One-to-one commitment: ${c.text}`,
          dueAt: new Date(c.dueAt).toISOString(),
          priority: 'normal',
          status: 'open',
        });
      }
    }

    await tx
      .update(reviews)
      .set({
        selfReflection: input.selfReflection,
        commitments: commitments,
        employeeResponse: input.employeeResponse ?? null,
        acknowledgedAt: sql`now()`,
      })
      .where(eq(reviews.id, reviewId));
  });

  return { ok: true, acknowledged: true };
}
