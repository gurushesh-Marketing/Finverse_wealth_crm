import { Router as makeRouter, type Response, type Router } from 'express';
import { existsSync, createReadStream } from 'node:fs';
import { ZodError } from 'zod';
import {
  createRegionalActionSchema,
  saveTerritoryPlanSchema,
  allocateRegionalTargetSchema,
  createCrossManagerTransferSchema,
  decideCrossManagerTransferSchema,
  saveRegionalStaffingPlanSchema,
  submitRegionalForecastSchema,
  createRegionalEscalationSchema,
  resolveRegionalEscalationSchema,
  saveManagerReviewSchema,
  saveRegionalReportScheduleSchema,
  generateRegionalPdfPackSchema,
  type RmPeriod,
} from '@finverse/contracts';
import { requireSession, type AuthedRequest } from '../middleware/session';
import type { Scope } from '../repo/users';
import * as rm from '../repo/regional-manager';

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
  console.error('[api] unexpected error in regional manager routes:', err);
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

export function createRegionalRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // Role gate: only RM can access regional manager endpoints
  router.use((req: AuthedRequest, res, next) => {
    if (req.auth?.session.role !== 'RM') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Regional Manager role required.' } });
      return;
    }
    next();
  });

  // Scope info
  router.get(
    '/scope',
    wrap(async (req, res) => {
      const data = await rm.getRegionalScope(scopeOf(req));
      res.json({ data });
    })
  );

  // RM-01: Regional Overview
  router.get(
    '/overview',
    wrap(async (req, res) => {
      const period = (req.query.period as RmPeriod) || 'month-to-date';
      const data = await rm.getRegionalOverview(scopeOf(req), period);
      res.json({ data });
    })
  );

  // RM-01 / RM-02 / RM-08 / RM-09: Regional Actions
  router.get(
    '/actions',
    wrap(async (req, res) => {
      const managerId = req.query.managerId as string | undefined;
      const data = await rm.listRegionalActions(scopeOf(req), managerId);
      res.json({ data });
    })
  );

  router.post(
    '/actions',
    wrap(async (req, res) => {
      const input = createRegionalActionSchema.parse(req.body);
      const data = await rm.createRegionalAction(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  // RM-02: Manager Scorecard
  router.get(
    '/managers/:managerId/scorecard',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'September';
      const data = await rm.getManagerScorecard(scopeOf(req), req.params.managerId, period);
      res.json({ data });
    })
  );

  // RM-03: Territory Coverage
  router.get(
    '/territories',
    wrap(async (req, res) => {
      const data = await rm.getTerritoryCoverage(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/territories',
    wrap(async (req, res) => {
      const input = saveTerritoryPlanSchema.parse(req.body);
      const data = await rm.saveTerritoryPlan(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  // RM-04: Regional Targets
  router.get(
    '/targets',
    wrap(async (req, res) => {
      const data = await rm.getRegionalTargets(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/targets/allocate',
    wrap(async (req, res) => {
      const input = allocateRegionalTargetSchema.parse(req.body);
      const data = await rm.allocateRegionalTarget(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  // RM-05: Cross-Manager Transfers
  router.get(
    '/transfers',
    wrap(async (req, res) => {
      const data = await rm.listCrossManagerTransfers(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/transfers',
    wrap(async (req, res) => {
      const input = createCrossManagerTransferSchema.parse(req.body);
      const data = await rm.createCrossManagerTransfer(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  router.post(
    '/transfers/decide',
    wrap(async (req, res) => {
      const input = decideCrossManagerTransferSchema.parse(req.body);
      const data = await rm.decideCrossManagerTransfer(scopeOf(req), input);
      res.json({ data });
    })
  );

  // RM-06: Regional Staffing
  router.get(
    '/staffing',
    wrap(async (req, res) => {
      const data = await rm.getRegionalCapacity(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/staffing',
    wrap(async (req, res) => {
      const input = saveRegionalStaffingPlanSchema.parse(req.body);
      const data = await rm.saveRegionalStaffingPlan(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  // RM-07: Regional Forecast Rollup & Submission
  router.get(
    '/forecasts',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October';
      const data = await rm.getRegionalForecastRollup(scopeOf(req), period);
      res.json({ data });
    })
  );

  router.post(
    '/forecasts/submit',
    wrap(async (req, res) => {
      const input = submitRegionalForecastSchema.parse(req.body);
      const data = await rm.submitRegionalForecast(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  // RM-08: Regional Escalations
  router.get(
    '/escalations',
    wrap(async (req, res) => {
      const data = await rm.listRegionalEscalations(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/escalations',
    wrap(async (req, res) => {
      const input = createRegionalEscalationSchema.parse(req.body);
      const data = await rm.createRegionalEscalation(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  router.post(
    '/escalations/resolve',
    wrap(async (req, res) => {
      const input = resolveRegionalEscalationSchema.parse(req.body);
      const data = await rm.resolveRegionalEscalation(scopeOf(req), input);
      res.json({ data });
    })
  );

  // RM-09: Manager Reviews
  router.get(
    '/reviews',
    wrap(async (req, res) => {
      const managerId = req.query.managerId as string | undefined;
      const data = await rm.listManagerReviews(scopeOf(req), managerId);
      res.json({ data });
    })
  );

  router.post(
    '/reviews',
    wrap(async (req, res) => {
      const input = saveManagerReviewSchema.parse(req.body);
      const data = await rm.saveManagerReview(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  // RM-10: Reports & Schedules
  router.get(
    '/reports/preview',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October 2026';
      const data = await rm.previewRegionalReportPack(scopeOf(req), period);
      res.json({ data });
    })
  );

  router.post(
    '/reports/generate-pdf',
    wrap(async (req, res) => {
      const input = generateRegionalPdfPackSchema.parse(req.body);
      const filePath = await rm.generateRegionalReportPdf(scopeOf(req), input);
      res.json({ data: { downloadUrl: `/api/regional/reports/download?file=${encodeURIComponent(filePath)}` } });
    })
  );

  router.get(
    '/reports/download',
    wrap(async (req, res) => {
      const file = req.query.file as string;
      if (!file || !existsSync(file)) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report PDF not found.' } });
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="regional_review_pack.pdf"');
      createReadStream(file).pipe(res);
    })
  );

  router.get(
    '/reports/schedules',
    wrap(async (req, res) => {
      const data = await rm.listRegionalReportSchedules(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/reports/schedules',
    wrap(async (req, res) => {
      const input = saveRegionalReportScheduleSchema.parse(req.body);
      const data = await rm.saveRegionalReportSchedule(scopeOf(req), input);
      res.status(201).json({ data });
    })
  );

  return router;
}
