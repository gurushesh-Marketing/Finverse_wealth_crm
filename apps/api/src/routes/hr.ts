import { Router as makeRouter, type Response, type Router } from 'express';
import { ZodError } from 'zod';
import { requireSession, type AuthedRequest } from '../middleware/session';
import * as hr from '../repo/hr';
import {
  hrRequestAccountSchema,
  hrRequestTransferSchema,
  hrRequestPromotionSchema,
  hrCoordinateExitSchema,
  hrRecordLeaveSchema,
  hrUpdateMilestoneSchema,
  hrPrepareReportPackSchema,
  hrCreateReportScheduleSchema,
  hrAttachApprovalSchema,
  hrUpdateRequestSchema,
} from '@finverse/contracts';
import path from 'path';
import fs from 'fs';

function sendError(res: Response, err: unknown) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'INVALID_INPUT', message: err.errors[0]?.message || 'Validation error' },
    });
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.startsWith('DUPLICATE_IDENTITY:')) {
    res.status(409).json({ error: { code: 'DUPLICATE_IDENTITY', message: msg.replace('DUPLICATE_IDENTITY: ', '') } });
    return;
  }
  if (
    msg.startsWith('INACTIVE_EMPLOYEE:') ||
    msg.startsWith('INVALID_DATE_INTERVAL:') ||
    msg.startsWith('UNAPPROVED_REQUEST:') ||
    msg.startsWith('MISSING_APPROVER:') ||
    msg.startsWith('MISSING_REFERENCE:') ||
    msg.startsWith('MISSING_NOTES:') ||
    msg.startsWith('SELF_APPROVAL_FORBIDDEN:') ||
    msg.startsWith('REQUEST_ALREADY_ACTIVATED:') ||
    msg.startsWith('REQUEST_REJECTED:')
  ) {
    res.status(422).json({ error: { code: 'UNPROCESSABLE_ENTITY', message: msg } });
    return;
  }
  if (msg.startsWith('NOT_FOUND:')) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: msg.replace('NOT_FOUND: ', '') } });
    return;
  }

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

export function createHrRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // Role gate: only Human Resources (HR) role can access HR endpoints
  router.use((req: AuthedRequest, res, next) => {
    if (req.auth?.session.role !== 'HR') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Human Resources role required.' } });
      return;
    }
    next();
  });

  // Overview
  router.get(
    '/overview',
    wrap(async (_req, res) => {
      const data = await hr.getHrOverview();
      res.json({ data });
    })
  );

  // Requests tracker
  router.get(
    '/requests',
    wrap(async (req, res) => {
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const data = await hr.listHrRequests({ type, status });
      res.json({ data });
    })
  );

  router.get(
    '/requests/:id',
    wrap(async (req, res) => {
      const data = await hr.getHrRequest(req.params.id);
      res.json({ data });
    })
  );

  router.post(
    '/requests/:id/approve',
    wrap(async (req, res) => {
      const parsed = hrAttachApprovalSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.attachRequestApproval(req.params.id, parsed, actorId);
      res.json({ data });
    })
  );

  router.patch(
    '/requests/:id',
    wrap(async (req, res) => {
      const parsed = hrUpdateRequestSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.updateHrRequest(req.params.id, parsed, actorId);
      res.json({ data });
    })
  );

  // HR-01: Request a New Employee Account
  router.post(
    '/accounts/request',
    wrap(async (req, res) => {
      const parsed = hrRequestAccountSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.createAccountRequest(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  // HR-02: Request an Effective-Dated Team Transfer
  router.post(
    '/transfers/request',
    wrap(async (req, res) => {
      const parsed = hrRequestTransferSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.createTransferRequest(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  // HR-03: Request a Promotion with Retained Career History
  router.post(
    '/promotions/request',
    wrap(async (req, res) => {
      const parsed = hrRequestPromotionSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.createPromotionRequest(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  // HR-04: Coordinate an Employee Exit
  router.post(
    '/exits/coordinate',
    wrap(async (req, res) => {
      const parsed = hrCoordinateExitSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.coordinateExit(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  // HR-05: Record Leave and Allocation Availability
  router.get(
    '/leaves',
    wrap(async (req, res) => {
      const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const data = await hr.listLeaves({ employeeId, status });
      res.json({ data });
    })
  );

  router.post(
    '/leaves',
    wrap(async (req, res) => {
      const parsed = hrRecordLeaveSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.recordLeave(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  // HR-06: Track Probation, Training and Review Completion
  router.get(
    '/milestones',
    wrap(async (req, res) => {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const data = await hr.listMilestones({ status, search });
      res.json({ data });
    })
  );

  router.post(
    '/milestones/update',
    wrap(async (req, res) => {
      const parsed = hrUpdateMilestoneSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.updateMilestone(parsed, actorId);
      res.json({ data });
    })
  );

  // HR-07: Prepare a People Operations Pack
  router.get(
    '/reports',
    wrap(async (_req, res) => {
      const data = await hr.listReportPacks();
      res.json({ data });
    })
  );

  router.post(
    '/reports/generate',
    wrap(async (req, res) => {
      const parsed = hrPrepareReportPackSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.generateReportPack(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  router.get(
    '/reports/schedules',
    wrap(async (_req, res) => {
      const data = await hr.listReportSchedules();
      res.json({ data });
    })
  );

  router.post(
    '/reports/schedules',
    wrap(async (req, res) => {
      const parsed = hrCreateReportScheduleSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await hr.createReportSchedule(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  // Download PDF
  router.get('/reports/download/:file', (req, res) => {
    const rawFilename = req.params.file;
    if (!rawFilename || rawFilename.includes('..') || rawFilename.includes('/') || rawFilename.includes('\\')) {
      res.status(400).json({ error: { code: 'INVALID_FILENAME', message: 'Invalid file parameter.' } });
      return;
    }
    const safePath = path.resolve(process.cwd(), 'data/hr_exports', rawFilename);
    if (!fs.existsSync(safePath)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Requested report file does not exist.' } });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${rawFilename}"`);
    fs.createReadStream(safePath).pipe(res);
  });

  return router;
}
