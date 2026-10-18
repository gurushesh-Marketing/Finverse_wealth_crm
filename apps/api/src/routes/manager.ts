import { Router as makeRouter, type Response, type Router } from 'express';
import { resolve } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import { ZodError } from 'zod';
import {
  createManagementActionSchema,
  createLeadTransferSchema,
  decideLeadTransferSchema,
  saveCapacityPlanSchema,
  allocateManagerTargetSchema,
  decideTlForecastSchema,
  submitManagerForecastSchema,
  resolveSlaBreachSchema,
  decideCommercialExceptionSchema,
  createSourceRemediationSchema,
  createTlPerformanceReviewSchema,
  createEmployeeLifecycleSchema,
  managerReportScheduleSchema,
  type MgPeriod,
} from '@finverse/contracts';
import { requireSession, type AuthedRequest } from '../middleware/session';
import type { Scope } from '../repo/users';
import * as mg from '../repo/manager';

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
  console.error('[api] unexpected error in manager routes:', err);
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

export function managerRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // Role gate: only MG can access manager endpoints
  router.use((req: AuthedRequest, res, next) => {
    if (req.auth?.session.role !== 'MG') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Manager role required.' } });
      return;
    }
    next();
  });

  // MG-01: Manager Overview & TL Roster
  router.get('/overview', wrap(async (req, res) => {
    const period = (req.query.period as MgPeriod) || 'month-to-date';
    const comparison = String(req.query.comparison || 'previous-period');
    res.json(await mg.getManagerOverview(scopeOf(req), period, comparison));
  }));

  router.get('/tls', wrap(async (req, res) => {
    res.json(await mg.getAssignedTls(scopeOf(req)));
  }));

  // MG-02: TL Operating Scorecard
  router.get('/scorecard/:tlId', wrap(async (req, res) => {
    const period = String(req.query.period || 'September');
    res.json(await mg.getTlScorecard(scopeOf(req), req.params.tlId, period));
  }));

  // MG-01, MG-02, MG-08, MG-11: Management Actions
  router.post('/actions', wrap(async (req, res) => {
    const parsed = createManagementActionSchema.parse(req.body);
    res.status(201).json(await mg.createManagementAction(scopeOf(req), parsed));
  }));

  router.get('/actions', wrap(async (req, res) => {
    const tlId = req.query.tlId ? String(req.query.tlId) : undefined;
    res.json(await mg.listManagementActions(scopeOf(req), tlId));
  }));

  // MG-03: Cross-Team Lead Transfers
  router.get('/transfers', wrap(async (req, res) => {
    res.json(await mg.listTransferRequests(scopeOf(req)));
  }));

  router.post('/transfers', wrap(async (req, res) => {
    const parsed = createLeadTransferSchema.parse(req.body);
    res.status(201).json(await mg.createLeadTransfer(scopeOf(req), parsed));
  }));

  router.post('/transfers/decide', wrap(async (req, res) => {
    const parsed = decideLeadTransferSchema.parse(req.body);
    res.json(await mg.decideLeadTransfer(scopeOf(req), parsed));
  }));

  // MG-04: Capacity Recovery Plans
  router.get('/capacity', wrap(async (req, res) => {
    res.json(await mg.getCapacityAnalysis(scopeOf(req)));
  }));

  router.post('/capacity/plan', wrap(async (req, res) => {
    const parsed = saveCapacityPlanSchema.parse(req.body);
    res.status(201).json(await mg.saveCapacityPlan(scopeOf(req), parsed));
  }));

  // MG-05: Allocate Manager Targets
  router.get('/targets', wrap(async (req, res) => {
    const period = String(req.query.period || 'October');
    res.json(await mg.getManagerTargets(scopeOf(req), period));
  }));

  router.post('/targets/allocate', wrap(async (req, res) => {
    const parsed = allocateManagerTargetSchema.parse(req.body);
    res.json(await mg.allocateManagerTarget(scopeOf(req), parsed));
  }));

  // MG-06: TL Forecast Review
  router.get('/forecasts', wrap(async (req, res) => {
    const period = String(req.query.period || 'October');
    res.json(await mg.listTlForecasts(scopeOf(req), period));
  }));

  router.post('/forecasts/decide', wrap(async (req, res) => {
    const parsed = decideTlForecastSchema.parse(req.body);
    res.json(await mg.decideTlForecast(scopeOf(req), parsed));
  }));

  // MG-07: Submit Manager Forecast to RM
  router.get('/forecasts/rollup', wrap(async (req, res) => {
    const period = String(req.query.period || 'October');
    res.json(await mg.getManagerForecastRollup(scopeOf(req), period));
  }));

  router.post('/forecasts/submit', wrap(async (req, res) => {
    const parsed = submitManagerForecastSchema.parse(req.body);
    res.status(201).json(await mg.submitManagerForecast(scopeOf(req), parsed));
  }));

  // MG-08: Resolve SLA Breach
  router.get('/sla-breaches', wrap(async (req, res) => {
    res.json(await mg.listSlaBreaches(scopeOf(req)));
  }));

  router.post('/sla-breaches/resolve', wrap(async (req, res) => {
    const parsed = resolveSlaBreachSchema.parse(req.body);
    res.json(await mg.resolveSlaBreach(scopeOf(req), parsed));
  }));

  // MG-09: Commercial Exceptions
  router.get('/commercial-exceptions', wrap(async (req, res) => {
    res.json(await mg.listCommercialExceptions(scopeOf(req)));
  }));

  router.get('/commercial-exceptions/:id', wrap(async (req, res) => {
    res.json(await mg.getCommercialException(scopeOf(req), req.params.id));
  }));

  router.post('/commercial-exceptions/decide', wrap(async (req, res) => {
    const parsed = decideCommercialExceptionSchema.parse(req.body);
    res.json(await mg.decideCommercialException(scopeOf(req), parsed));
  }));

  // MG-10: Source Quality Remediation
  router.get('/source-quality', wrap(async (req, res) => {
    const period = String(req.query.period || 'September');
    res.json(await mg.getSourceQuality(scopeOf(req), period));
  }));

  router.post('/source-quality/remediation', wrap(async (req, res) => {
    const parsed = createSourceRemediationSchema.parse(req.body);
    res.status(201).json(await mg.createSourceRemediation(scopeOf(req), parsed));
  }));

  // MG-11: TL Performance Reviews
  router.get('/reviews', wrap(async (req, res) => {
    const tlId = req.query.tlId ? String(req.query.tlId) : undefined;
    res.json(await mg.listTlReviews(scopeOf(req), tlId));
  }));

  router.post('/reviews', wrap(async (req, res) => {
    const parsed = createTlPerformanceReviewSchema.parse(req.body);
    res.status(201).json(await mg.createTlReview(scopeOf(req), parsed));
  }));

  // MG-12: Employee Lifecycle Requests
  router.get('/lifecycle', wrap(async (req, res) => {
    res.json(await mg.listLifecycleRequests(scopeOf(req)));
  }));

  router.post('/lifecycle', wrap(async (req, res) => {
    const parsed = createEmployeeLifecycleSchema.parse(req.body);
    res.status(201).json(await mg.createLifecycleRequest(scopeOf(req), parsed));
  }));

  // MG-13: Meeting Pack PDF & Recurring Schedule
  router.get('/meeting-pack/preview', wrap(async (req, res) => {
    const period = (req.query.period as MgPeriod) || 'month-to-date';
    res.json(await mg.previewMeetingPack(scopeOf(req), period));
  }));

  router.post('/meeting-pack/export', wrap(async (req, res) => {
    const period = (req.body?.period as MgPeriod) || 'month-to-date';
    res.status(201).json(await mg.generateMeetingPackPdf(scopeOf(req), period));
  }));

  router.get('/meeting-pack/download/:id', wrap(async (req, res) => {
    const absPath = resolve(process.cwd(), 'data/manager_exports', `${req.params.id}.pdf`);
    if (!existsSync(absPath)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'PDF report export not found.' } });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Finverse-Manager-Pack-${req.params.id}.pdf"`);
    createReadStream(absPath).pipe(res);
  }));

  router.get('/schedules', wrap(async (req, res) => {
    res.json(await mg.listReportSchedules(scopeOf(req)));
  }));

  router.post('/schedules', wrap(async (req, res) => {
    const parsed = managerReportScheduleSchema.parse(req.body);
    res.status(201).json(await mg.createReportSchedule(scopeOf(req), parsed));
  }));

  return router;
}
