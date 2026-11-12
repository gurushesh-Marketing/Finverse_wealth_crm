import { Router as makeRouter, type Response, type Router } from 'express';
import { ZodError } from 'zod';
import { requireSession, type AuthedRequest } from '../middleware/session';
import {
  CheckInInputSchema,
  CheckOutInputSchema,
  ProgressLogInputSchema,
  RegularizationRequestInputSchema,
  RegularizationDecisionInputSchema,
  SupervisorReviewInputSchema,
  ResourceViewQuerySchema,
} from '@finverse/contracts';
import {
  checkInEmployee,
  checkOutEmployee,
  addProgressLog,
  requestAttendanceRegularization,
  decideAttendanceRegularization,
  reviewAttendanceRecord,
  getMyAttendance,
  getSupervisorExceptions,
  getResourceView,
} from '../repo/attendance';

function sendError(res: Response, err: unknown) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'INVALID_INPUT', message: err.errors[0]?.message || 'Validation error' },
    });
    return;
  }
  const e = err as any;
  const status = e.status || 500;
  const code = e.code || 'INTERNAL_ERROR';
  res.status(status).json({
    error: {
      code,
      message: e.message || 'An unexpected error occurred.',
    },
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

export function createAttendanceRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // 1. Employee Check-in
  router.post(
    '/check-in',
    wrap(async (req, res) => {
      const input = CheckInInputSchema.parse(req.body);
      const result = await checkInEmployee(req.auth!.session, input);
      res.status(201).json(result);
    })
  );

  // 2. Employee Check-out
  router.post(
    '/check-out',
    wrap(async (req, res) => {
      const input = CheckOutInputSchema.parse(req.body);
      const result = await checkOutEmployee(req.auth!.session, input);
      res.json(result);
    })
  );

  // 3. Add Progress Log (WFH & Offline Deliverables)
  router.post(
    '/progress-log',
    wrap(async (req, res) => {
      const input = ProgressLogInputSchema.parse(req.body);
      const result = await addProgressLog(req.auth!.session, input);
      res.status(201).json(result);
    })
  );

  // 4. Get Personal Attendance
  router.get(
    '/my-attendance',
    wrap(async (req, res) => {
      const dateOrMonth = req.query.month as string | undefined;
      const result = await getMyAttendance(req.auth!.session, dateOrMonth);
      res.json(result);
    })
  );

  // 5. Submit Attendance Regularization Request
  router.post(
    '/regularization',
    wrap(async (req, res) => {
      const input = RegularizationRequestInputSchema.parse(req.body);
      const result = await requestAttendanceRegularization(req.auth!.session, input);
      res.status(201).json(result);
    })
  );

  // 6. Decide Attendance Regularization (Supervisor / HR)
  router.post(
    '/regularization/:id/decision',
    wrap(async (req, res) => {
      const input = RegularizationDecisionInputSchema.parse(req.body);
      const result = await decideAttendanceRegularization(req.auth!.session, req.params.id, input);
      res.json(result);
    })
  );

  // 7. Supervisor Exceptions Queue (Pending Confirmations & Regularizations)
  router.get(
    '/supervisor-exceptions',
    wrap(async (req, res) => {
      const result = await getSupervisorExceptions(req.auth!.session);
      res.json(result);
    })
  );

  // 8. Supervisor Review of Specific Attendance Record
  router.post(
    '/records/:id/review',
    wrap(async (req, res) => {
      const input = SupervisorReviewInputSchema.parse(req.body);
      const result = await reviewAttendanceRecord(req.auth!.session, req.params.id, input);
      res.json(result);
    })
  );

  // 9. HR Organization-Wide & Manager-Scoped Resource View
  router.get(
    '/resource-view',
    wrap(async (req, res) => {
      const query = ResourceViewQuerySchema.parse(req.query);
      const result = await getResourceView(req.auth!.session, query);
      res.json(result);
    })
  );

  return router;
}
