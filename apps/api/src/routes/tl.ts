import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import {
  activityCorrectionSchema,
  allocationSchema,
  batchAllocationSchema,
  correctionDecisionSchema,
  forecastSchema,
  mentorshipSchema,
  oneToOneSchema,
  overdueActionSchema,
  qualityReviewSchema,
  rebalanceSchema,
  reportScheduleSchema,
  targetAllocationSchema,
  targetSchema,
  teamRequestSchema,
  toZodFieldErrors,
  type TlPeriod,
} from '@finverse/contracts';
import { ZodError } from 'zod';
import type { Scope } from '../repo/users';
import { requireSession, type AuthedRequest } from '../middleware/session';
import * as tl from '../repo/tl';

function sendError(res: Response, err: unknown): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: { code: 'VALIDATION_FAILED', message: 'Check the highlighted fields.', details: { fieldErrors: toZodFieldErrors(err) } },
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
  console.error('[api] unexpected error in tl routes:', err);
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

export function tlRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // TL-01 team overview + drill + corrective task
  router.get('/overview', wrap(async (req, res) => {
    res.json(await tl.overview(scopeOf(req), (String(req.query.period ?? 'today') as TlPeriod), String(req.query.comparison ?? 'previous period')));
  }));
  router.get('/overview/drill', wrap(async (req, res) => {
    res.json(await tl.drill(scopeOf(req), String(req.query.metric ?? 'overdue-tasks'), (String(req.query.period ?? 'today') as TlPeriod)));
  }));
  router.post('/overview/corrective-task', wrap(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    res.status(201).json(await tl.correctiveTask(scopeOf(req), String(body.leadId ?? ''), String(body.purpose ?? ''), String(body.dueAt ?? '')));
  }));

  // TL-02/03 allocation
  router.get('/allocation/queue', wrap(async (req, res) => {
    res.json(await tl.allocationQueue(scopeOf(req)));
  }));
  router.get('/allocation/recipients', wrap(async (req, res) => {
    res.json(await tl.eligibleRecipients(scopeOf(req)));
  }));
  router.post('/allocation', wrap(async (req, res) => {
    res.status(201).json(await tl.allocateLead(scopeOf(req), allocationSchema.parse(req.body)));
  }));
  router.post('/allocation/batch/preview', wrap(async (req, res) => {
    res.json(await tl.batchPreview(scopeOf(req), batchAllocationSchema.parse(req.body)));
  }));
  router.post('/allocation/batch', wrap(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = batchAllocationSchema.parse(body);
    const batchKey = String(body.batchKey ?? '');
    if (!batchKey) {
      res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'Check the highlighted fields.', details: { fieldErrors: { batchKey: ['Batch key is required.'] } } } });
      return;
    }
    res.status(201).json(await tl.batchCommit(scopeOf(req), input, batchKey));
  }));

  // TL-04 workload + rebalance
  router.get('/workload', wrap(async (req, res) => {
    res.json(await tl.workload(scopeOf(req)));
  }));
  router.post('/rebalance', wrap(async (req, res) => {
    res.status(201).json(await tl.rebalance(scopeOf(req), rebalanceSchema.parse(req.body)));
  }));

  // TL-05 overdue resolution
  router.get('/overdue', wrap(async (req, res) => res.json(await tl.overdueQueue(scopeOf(req)))));
  router.post('/overdue/:taskId/action', wrap(async (req, res) => {
    res.status(201).json(await tl.overdueAction(scopeOf(req), String(req.params.taskId), overdueActionSchema.parse(req.body)));
  }));

  // TL-06 associate review
  router.get('/members/:id', wrap(async (req, res) => {
    res.json(await tl.memberReview(scopeOf(req), String(req.params.id), (String(req.query.period ?? 'month') as TlPeriod)));
  }));

  // TL-07/08 decision queues (+ duplicate dispositions; decides go through /requests/:id/decision)
  router.get('/decisions', wrap(async (req, res) => res.json(await tl.listDecisions(scopeOf(req)))));
  router.post('/duplicates/:id/disposition', wrap(async (req, res) => {
    const decision = String((req.body ?? {}).decision) === 'route-merge' ? 'route-merge' : 'confirm-separate';
    res.json(await tl.duplicateDisposition(scopeOf(req), String(req.params.id), decision));
  }));

  // TL-09 call quality
  router.get('/quality-reviews', wrap(async (req, res) => res.json(await tl.listQualityReviews(scopeOf(req)))));
  router.post('/quality-reviews', wrap(async (req, res) => {
    res.status(201).json(await tl.createQualityReview(scopeOf(req), qualityReviewSchema.parse(req.body)));
  }));
  router.get('/quality-reviews/:id/evidence', wrap(async (req, res) => {
    res.json(await tl.accessEvidence(scopeOf(req), String(req.params.id)));
  }));

  // TL-18 activity corrections
  router.get('/activity-corrections', wrap(async (req, res) => res.json(await tl.listActivityCorrections(scopeOf(req)))));
  router.post('/activity-corrections', wrap(async (req, res) => {
    res.status(201).json(await tl.submitActivityCorrection(scopeOf(req), activityCorrectionSchema.parse(req.body)));
  }));
  router.post('/activity-corrections/:id/decision', wrap(async (req, res) => {
    tl.assertTl(scopeOf(req));
    const input = correctionDecisionSchema.parse(req.body);
    res.json(await tl.decideActivityCorrection(scopeOf(req), String(req.params.id), input.decision, input.reason, input.evidence));
  }));

  // TL-10 targets
  router.get('/targets', wrap(async (req, res) => res.json(await tl.listTargets(scopeOf(req)))));
  router.post('/targets', wrap(async (req, res) => {
    res.status(201).json(await tl.createTarget(scopeOf(req), targetSchema.parse(req.body)));
  }));
  router.post('/targets/:id/allocations', wrap(async (req, res) => {
    res.status(201).json(await tl.allocateTargets(scopeOf(req), String(req.params.id), targetAllocationSchema.parse(req.body)));
  }));

  // TL-11 forecasts
  router.get('/forecasts', wrap(async (req, res) => res.json(await tl.listForecasts(scopeOf(req)))));
  router.post('/forecasts', wrap(async (req, res) => {
    res.status(201).json(await tl.submitForecast(scopeOf(req), forecastSchema.parse(req.body)));
  }));

  // TL-12 one-to-ones
  router.get('/one-to-ones', wrap(async (req, res) => res.json(await tl.listOneToOnes(scopeOf(req)))));
  router.post('/one-to-ones', wrap(async (req, res) => {
    res.status(201).json(await tl.createOneToOne(scopeOf(req), oneToOneSchema.parse(req.body)));
  }));
  router.post('/one-to-ones/:id/complete', wrap(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    res.json(await tl.completeOneToOne(scopeOf(req), String(req.params.id), {
      feedback: String(body.feedback ?? ''),
      privateNotes: body.privateNotes ? String(body.privateNotes) : undefined,
      commitments: Array.isArray(body.commitments) ? (body.commitments as Array<{ text: string; dueAt: string }>) : [],
      disagreement: body.disagreement ? String(body.disagreement) : undefined,
    }));
  }));

  // TL-13 mentorships
  router.get('/mentorships', wrap(async (req, res) => res.json(await tl.listMentorships(scopeOf(req)))));
  router.post('/mentorships', wrap(async (req, res) => {
    res.status(201).json(await tl.createMentorship(scopeOf(req), mentorshipSchema.parse(req.body)));
  }));

  // TL-14/15 team requests + escalations
  router.get('/team-requests', wrap(async (req, res) => res.json(await tl.listTeamRequests(scopeOf(req)))));
  router.post('/team-requests', wrap(async (req, res) => {
    res.status(201).json(await tl.createTeamRequest(scopeOf(req), teamRequestSchema.parse(req.body)));
  }));

  // TL-16 team packs
  router.post('/team-packs', wrap(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const period = String(body.period) === 'quarter' ? 'quarter' : 'month';
    res.status(201).json(await tl.createTeamPack(scopeOf(req), { teamIds: Array.isArray(body.teamIds) ? body.teamIds as string[] : [], period: period as 'month' | 'quarter' }));
  }));
  router.get('/team-packs/:id/download', wrap(async (req, res) => {
    const file = await tl.downloadTeamPack(scopeOf(req), String(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/[^\w.\-]/g, '_')}"`);
    res.send(file.bytes);
  }));

  // TL-17 recurring report schedules
  router.get('/report-schedules', wrap(async (req, res) => res.json(await tl.listReportSchedules(scopeOf(req)))));
  router.post('/report-schedules', wrap(async (req, res) => {
    res.status(201).json(await tl.createReportSchedule(scopeOf(req), reportScheduleSchema.parse(req.body)));
  }));
  router.post('/report-schedules/tick', wrap(async (req, res) => {
    tl.assertTl(scopeOf(req));
    res.json(await tl.runDueSchedules());
  }));

  return router;
}
