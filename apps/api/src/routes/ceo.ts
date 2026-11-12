import { Router as makeRouter, type Response, type Router } from 'express';
import { existsSync, createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import {
  approveCompanyTargetSchema,
  signOffCompanyForecastSchema,
  createGrowthInitiativeSchema,
  approveGrowthInitiativeSchema,
  arbitrateCrossVerticalConflictSchema,
  createCriticalRiskSchema,
  resolveCriticalRiskSchema,
  saveNmLeadershipReviewSchema,
  saveBoardReportScheduleSchema,
  createExecutiveCommitmentSchema,
  fulfillExecutiveCommitmentSchema,
  generateBoardPackPdfSchema,
  type CeoPeriod,
} from '@finverse/contracts';
import { requireSession, type AuthedRequest } from '../middleware/session';
import type { Scope } from '../repo/users';
import * as ceo from '../repo/ceo';

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
  console.error('[api] unexpected error in CEO routes:', err);
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

export function createCeoRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // Role gate: only CEO can access CEO endpoints
  router.use((req: AuthedRequest, res, next) => {
    if (req.auth?.session.role !== 'CEO') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Chief Executive Officer role required.' } });
      return;
    }
    next();
  });

  // Scope info
  router.get(
    '/scope',
    wrap(async (req, res) => {
      const data = await ceo.getCeoScope(scopeOf(req));
      res.json({ data });
    })
  );

  // CEO-01: Company Operating Picture
  router.get(
    '/operating-picture',
    wrap(async (req, res) => {
      const period = (req.query.period as CeoPeriod) || 'month-to-date';
      const focusVertical = (req.query.focusVertical as string) || 'all';
      const data = await ceo.getCompanyOperatingPicture(scopeOf(req), period, focusVertical);
      res.json({ data });
    })
  );

  // CEO-02: Vertical Comparison
  router.get(
    '/verticals/comparison',
    wrap(async (req, res) => {
      const period = (req.query.period as CeoPeriod) || 'month-to-date';
      const data = await ceo.getVerticalComparisons(scopeOf(req), period);
      res.json({ data });
    })
  );

  // CEO-03: NM Contribution
  router.get(
    '/nms/:id/contribution',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October 2026';
      const data = await ceo.getNmContribution(scopeOf(req), req.params.id, period);
      res.json({ data });
    })
  );

  // CEO-04: Company & Vertical Targets
  router.get(
    '/targets',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October';
      const fiscalYear = (req.query.fiscalYear as string) || 'FY2026-27';
      const data = await ceo.getCompanyTarget(scopeOf(req), period, fiscalYear);
      res.json({ data });
    })
  );

  router.post(
    '/targets/approve',
    wrap(async (req, res) => {
      const parsed = approveCompanyTargetSchema.parse(req.body);
      const data = await ceo.approveCompanyTarget(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // CEO-05: Consolidated Company Forecast
  router.get(
    '/forecast/rollup',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October';
      const data = await ceo.getCompanyForecastRollup(scopeOf(req), period);
      res.json({ data });
    })
  );

  router.post(
    '/forecast/sign-off',
    wrap(async (req, res) => {
      const parsed = signOffCompanyForecastSchema.parse(req.body);
      const data = await ceo.signOffCompanyForecast(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // CEO-06: Growth & Capacity Initiatives
  router.get(
    '/growth-initiatives',
    wrap(async (req, res) => {
      const status = req.query.status as string | undefined;
      const data = await ceo.listGrowthInitiatives(scopeOf(req), status);
      res.json({ data });
    })
  );

  router.post(
    '/growth-initiatives',
    wrap(async (req, res) => {
      const parsed = createGrowthInitiativeSchema.parse(req.body);
      const data = await ceo.createGrowthInitiative(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  router.post(
    '/growth-initiatives/:id/approve',
    wrap(async (req, res) => {
      const parsed = approveGrowthInitiativeSchema.parse({
        ...req.body,
        initiativeId: req.params.id,
      });
      const data = await ceo.approveGrowthInitiative(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // CEO-07: Cross-Vertical Conflicts
  router.get(
    '/conflicts',
    wrap(async (req, res) => {
      const data = await ceo.listCrossVerticalConflicts(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/conflicts/:id/arbitrate',
    wrap(async (req, res) => {
      const parsed = arbitrateCrossVerticalConflictSchema.parse({
        ...req.body,
        conflictId: req.params.id,
      });
      const data = await ceo.arbitrateCrossVerticalConflict(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // CEO-08: Critical Operating Risks
  router.get(
    '/operating-risks',
    wrap(async (req, res) => {
      const data = await ceo.listCriticalOperatingRisks(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/operating-risks',
    wrap(async (req, res) => {
      const parsed = createCriticalRiskSchema.parse(req.body);
      const data = await ceo.createCriticalRisk(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  router.post(
    '/operating-risks/:id/resolve',
    wrap(async (req, res) => {
      const parsed = resolveCriticalRiskSchema.parse({
        ...req.body,
        riskId: req.params.id,
      });
      const data = await ceo.resolveCriticalRisk(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // CEO-09: NM Leadership Reviews
  router.get(
    '/nm-reviews',
    wrap(async (req, res) => {
      const nmId = req.query.nmEmployeeId as string | undefined;
      const data = await ceo.listNmLeadershipReviews(scopeOf(req), nmId);
      res.json({ data });
    })
  );

  router.post(
    '/nm-reviews',
    wrap(async (req, res) => {
      const parsed = saveNmLeadershipReviewSchema.parse(req.body);
      const data = await ceo.saveNmLeadershipReview(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  // CEO-10: Board & Executive Packs
  router.get(
    '/board-packs/preview',
    wrap(async (req, res) => {
      const period = (req.query.period as string) || 'October 2026';
      const data = await ceo.previewBoardPack(scopeOf(req), period);
      res.json({ data });
    })
  );

  router.post(
    '/board-packs/export-pdf',
    wrap(async (req, res) => {
      const parsed = generateBoardPackPdfSchema.parse(req.body);
      const filePath = await ceo.generateBoardPackPdf(scopeOf(req), parsed);
      const fileName = filePath.split(/[/\\]/).pop();
      res.json({
        data: {
          downloadUrl: `/api/ceo/board-packs/download/${fileName}`,
          fileName,
        },
      });
    })
  );

  router.get(
    '/board-packs/download/:file',
    wrap(async (req, res) => {
      const safeFile = req.params.file.replace(/[^a-zA-Z0-9_.-]/g, '');
      const filePath = resolve(process.cwd(), 'data/ceo_exports', safeFile);
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
    '/board-packs/schedules',
    wrap(async (req, res) => {
      const data = await ceo.listBoardReportSchedules(scopeOf(req));
      res.json({ data });
    })
  );

  router.post(
    '/board-packs/schedules',
    wrap(async (req, res) => {
      const parsed = saveBoardReportScheduleSchema.parse(req.body);
      const data = await ceo.saveBoardReportSchedule(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  // CEO-11: Executive Commitments
  router.get(
    '/commitments',
    wrap(async (req, res) => {
      const status = req.query.status as string | undefined;
      const data = await ceo.listExecutiveCommitments(scopeOf(req), status);
      res.json({ data });
    })
  );

  router.post(
    '/commitments',
    wrap(async (req, res) => {
      const parsed = createExecutiveCommitmentSchema.parse(req.body);
      const data = await ceo.createExecutiveCommitment(scopeOf(req), parsed);
      res.status(201).json({ data });
    })
  );

  router.post(
    '/commitments/:id/fulfill',
    wrap(async (req, res) => {
      const parsed = fulfillExecutiveCommitmentSchema.parse({
        ...req.body,
        commitmentId: req.params.id,
      });
      const data = await ceo.fulfillExecutiveCommitment(scopeOf(req), parsed);
      res.json({ data });
    })
  );

  return router;
}
