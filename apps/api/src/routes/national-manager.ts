import { Router as makeRouter, type Response, type Router } from 'express';
import { existsSync, createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import {
  createNationalActionSchema,
  allocateNationalTargetSchema,
  proposeProductRuleSchema,
  submitNationalForecastSchema,
  createCrossRegionTransferSchema,
  decideCrossRegionTransferSchema,
  decideCrossVerticalReferralSchema,
  createNationalEscalationSchema,
  resolveNationalEscalationSchema,
  saveRmReviewSchema,
  saveNationalReportScheduleSchema,
  generateNationalPdfPackSchema,
  type NmPeriod,
} from '@finverse/contracts';
import { requireSession, type AuthedRequest } from '../middleware/session';
import type { Scope } from '../repo/users';
import * as nm from '../repo/national-manager';

function sendError(res: Response, err: unknown): void {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    res.status(422).json({
      error: { code: 'VALIDATION_FAILED', message: 'Check the highlighted fields.', details: { fieldErrors } },
    });
    return;
  }
  const e = err as { status?: number; code?: string; message?: string; details?: unknown };
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
    res.status(e.status).json({
      error: { code: (e.code as any) ?? 'VALIDATION_FAILED', message: e.message ?? 'Request failed.', details: (e.details as any) ?? {} },
    });
    return;
  }
  console.error('[api] unexpected error in national manager routes:', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong. Try again.' },
  });
}

function wrap(handler: (req: AuthedRequest, res: Response) => Promise<unknown>) {
  return async (req: AuthedRequest, res: Response) => {
    try {
      await handler(req, res);
    } catch (err) {
      sendError(res, err);
    }
  };
}

function scopeOf(req: AuthedRequest): Scope {
  return req.auth!.scope;
}

export function createNationalRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // Role gate: only NM can access national manager endpoints
  router.use((req: AuthedRequest, res, next) => {
    if (req.auth?.session.role !== 'NM') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'National Manager role required.' } });
      return;
    }
    next();
  });

  // Scope info
  router.get(
    '/scope',
    wrap(async (req, res) => {
      const data = await nm.getNationalScope(scopeOf(req));
      res.json({ data });
    })
  );

  // NM-01: National Overview
  router.get(
    '/overview',
    wrap(async (req, res) => {
      const period = (req.query.period as NmPeriod) || 'month-to-date';
      const data = await nm.getNationalOverview(scopeOf(req), period);
      res.json({ data });
    })
  );

  // NM-01 / NM-02 / NM-09 / NM-10: Actions
  router.get(
    '/actions',
    wrap(async (req, res) => {
      const status = req.query.status as string | undefined;
      const data = await nm.listNationalActions(scopeOf(req), status);
      res.json({ data });
    })
  );

  router.post(
    '/actions',
    wrap(async (req, res) => {
      const parsed = createNationalActionSchema.parse(req.body);
      const data = await nm.createNationalAction(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  router.post(
    '/actions/:id/complete',
    wrap(async (req, res) => {
      const data = await nm.completeNationalAction(scopeOf(req), req.params.id);
      res.json({ data });
    })
  );

  // NM-02: Regional Comparison
  router.get(
    '/comparisons',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'September';
      const data = await nm.getRegionalComparisons(scopeOf(req), period);
      res.json({ data });
    })
  );

  // NM-03: National Target Allocation
  router.get(
    '/target',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October';
      const data = await nm.getNationalTarget(scopeOf(req), period);
      res.json({ data });
    })
  );

  router.post(
    '/target/allocate',
    wrap(async (req, res) => {
      const parsed = allocateNationalTargetSchema.parse(req.body);
      const data = await nm.allocateNationalTarget(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // NM-04: National Economics & Unit Capacity
  router.get(
    '/economics',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'month-to-date';
      const data = await nm.getNationalEconomics(scopeOf(req), period);
      res.json({ data });
    })
  );

  // NM-05: Product & Pipeline Rule Proposals
  router.get(
    '/product-rules',
    wrap(async (req, res) => {
      const data = await nm.listProductRuleProposals(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/product-rules',
    wrap(async (req, res) => {
      const parsed = proposeProductRuleSchema.parse(req.body);
      const data = await nm.createProductRuleProposal(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  // NM-06: National Forecast Consolidation
  router.get(
    '/forecast/rollup',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October';
      const data = await nm.getNationalForecastRollup(scopeOf(req), period);
      res.json({ data });
    })
  );

  router.post(
    '/forecast/submit',
    wrap(async (req, res) => {
      const parsed = submitNationalForecastSchema.parse(req.body);
      const data = await nm.submitNationalForecast(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // NM-07: Cross-Region Work Transfers
  router.get(
    '/transfers',
    wrap(async (req, res) => {
      const data = await nm.listCrossRegionTransfers(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/transfers',
    wrap(async (req, res) => {
      const parsed = createCrossRegionTransferSchema.parse(req.body);
      const data = await nm.createCrossRegionTransfer(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  router.post(
    '/transfers/:id/decide',
    wrap(async (req, res) => {
      const parsed = decideCrossRegionTransferSchema.parse({
        ...req.body,
        transferId: req.params.id,
      });
      const data = await nm.decideCrossRegionTransfer(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // NM-08: Cross-Vertical Inbound Referrals
  router.get(
    '/referrals',
    wrap(async (req, res) => {
      const data = await nm.listCrossVerticalReferrals(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/referrals/:id/decide',
    wrap(async (req, res) => {
      const parsed = decideCrossVerticalReferralSchema.parse({
        ...req.body,
        referralId: req.params.id,
      });
      const data = await nm.decideCrossVerticalReferral(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // NM-09: National Strategic Escalations
  router.get(
    '/escalations',
    wrap(async (req, res) => {
      const data = await nm.listNationalEscalations(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/escalations',
    wrap(async (req, res) => {
      const parsed = createNationalEscalationSchema.parse(req.body);
      const data = await nm.createNationalEscalation(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  router.post(
    '/escalations/:id/resolve',
    wrap(async (req, res) => {
      const parsed = resolveNationalEscalationSchema.parse({
        ...req.body,
        escalationId: req.params.id,
      });
      const data = await nm.resolveNationalEscalation(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // NM-10: Regional Manager Reviews
  router.get(
    '/reviews',
    wrap(async (req, res) => {
      const rmId = req.query.rmEmployeeId as string | undefined;
      const data = await nm.listRmReviews(scopeOf(req), rmId);
      res.json({ data });
    })
  );

  router.post(
    '/reviews',
    wrap(async (req, res) => {
      const parsed = saveRmReviewSchema.parse(req.body);
      const data = await nm.saveRmReview(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  // NM-11: National Executive Reports & Schedules
  router.get(
    '/reports/preview',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October 2026';
      const data = await nm.previewNationalReportPack(scopeOf(req), period);
      res.json({ data });
    })
  );

  router.post(
    '/reports/export-pdf',
    wrap(async (req, res) => {
      const parsed = generateNationalPdfPackSchema.parse(req.body);
      const filePath = await nm.generateNationalReportPdf(scopeOf(req), parsed);
      const fileName = filePath.split(/[/\\]/).pop();
      res.json({
        data: {
          downloadUrl: `/api/national/reports/download/${fileName}`,
          fileName,
        },
      });
    })
  );

  router.get(
    '/reports/download/:file',
    wrap(async (req, res) => {
      const safeFile = req.params.file.replace(/[^a-zA-Z0-9_.-]/g, '');
      const filePath = resolve(process.cwd(), 'data/national_exports', safeFile);
      if (!existsSync(filePath)) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'PDF export not found.' } });
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFile}"`);
      createReadStream(filePath).pipe(res);
    })
  );

  router.get(
    '/reports/schedules',
    wrap(async (req, res) => {
      const data = await nm.listNationalReportSchedules(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/reports/schedules',
    wrap(async (req, res) => {
      const parsed = saveNationalReportScheduleSchema.parse(req.body);
      const data = await nm.saveNationalReportSchedule(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  return router;
}
