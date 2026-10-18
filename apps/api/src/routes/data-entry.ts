import { Router as makeRouter, type Response, type Router } from 'express';
import { ZodError } from 'zod';
import {
  batchUploadSchema,
  duplicateDecisionSchema,
  enquiryCaptureSchema,
  publishBatchSchema,
  qualityReportQuerySchema,
  rowCorrectionSchema,
  sourceEvidenceSchema,
} from '@finverse/contracts';
import { requireSession, type AuthedRequest } from '../middleware/session';
import type { Scope } from '../repo/users';
import * as de from '../repo/data-entry';

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
      error: {
        code: (e.code as any) ?? 'VALIDATION_FAILED',
        message: e.message ?? 'Request failed.',
        details: (e.details as any) ?? {},
      },
    });
    return;
  }
  console.error('[api] unexpected error in data-entry routes:', err);
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

export function dataEntryRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // DE-06: Sources Register (P273–P274)
  router.get('/sources', wrap(async (req, res) => {
    res.json({ sources: await de.listSources(scopeOf(req)) });
  }));

  router.post('/sources', wrap(async (req, res) => {
    const input = sourceEvidenceSchema.parse(req.body);
    res.status(201).json(await de.createOrUpdateSource(scopeOf(req), input));
  }));

  router.put('/sources/:id', wrap(async (req, res) => {
    const input = sourceEvidenceSchema.parse(req.body);
    res.json(await de.createOrUpdateSource(scopeOf(req), input, req.params.id));
  }));

  // DE-01: Capture source-backed enquiry (P263–P264)
  router.post('/enquiries', wrap(async (req, res) => {
    const input = enquiryCaptureSchema.parse(req.body);
    res.status(201).json(await de.captureEnquiry(scopeOf(req), input));
  }));

  // DE-02: Batches & CSV upload (P265–P266)
  router.get('/batches', wrap(async (req, res) => {
    const vertical = typeof req.query.vertical === 'string' ? req.query.vertical : undefined;
    res.json({ batches: await de.listBatches(scopeOf(req), vertical) });
  }));

  router.get('/batches/:id', wrap(async (req, res) => {
    res.json(await de.getBatchSummary(scopeOf(req), req.params.id!));
  }));

  router.post('/batches/upload', wrap(async (req, res) => {
    const input = batchUploadSchema.parse(req.body);
    res.status(201).json(await de.uploadBatch(scopeOf(req), input));
  }));

  // DE-03: Correct rejected intake rows (P267–P268)
  router.get('/rejected-rows', wrap(async (req, res) => {
    const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : undefined;
    const errorReason = typeof req.query.errorReason === 'string' ? req.query.errorReason : undefined;
    res.json({ rows: await de.listRejectedRows(scopeOf(req), batchId, errorReason) });
  }));

  router.put('/rejected-rows/:id', wrap(async (req, res) => {
    const body = { ...req.body, rowId: req.params.id };
    const input = rowCorrectionSchema.parse(body);
    res.json(await de.correctRow(scopeOf(req), input));
  }));

  // DE-04: Review possible duplicates (P269–P270)
  router.get('/duplicates', wrap(async (req, res) => {
    const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : undefined;
    res.json({ duplicates: await de.listDuplicates(scopeOf(req), batchId) });
  }));

  router.post('/duplicates/:id/decision', wrap(async (req, res) => {
    const body = { ...req.body, rowId: req.params.id };
    const input = duplicateDecisionSchema.parse(body);
    res.json(await de.reviewDuplicate(scopeOf(req), input));
  }));

  // DE-05: Publish valid rows to allocation (P271–P272)
  router.post('/batches/:id/publish', wrap(async (req, res) => {
    const body = { ...req.body, batchId: req.params.id };
    const input = publishBatchSchema.parse(body);
    res.status(200).json(await de.publishBatch(scopeOf(req), input));
  }));

  // DE-07: Export intake quality report (P275–P276)
  router.get('/reports/quality', wrap(async (req, res) => {
    const query = qualityReportQuerySchema.parse(req.query);
    res.json(await de.getQualityReport(scopeOf(req), query));
  }));

  router.post('/reports/export', wrap(async (req, res) => {
    const period = (req.body?.period ?? 'this-month') as any;
    const exportType = (req.body?.exportType ?? 'quality_report_pdf') as any;
    res.status(201).json(await de.exportQualityWorklist(scopeOf(req), period, exportType));
  }));

  return router;
}
