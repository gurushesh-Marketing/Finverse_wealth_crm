import { Router as makeRouter, type Response, type Router } from 'express';
import { ZodError } from 'zod';
import { requireSession, type AuthedRequest } from '../middleware/session';
import * as leaveRepo from '../repo/leave';
import {
  submitLeaveRequestSchema,
  decideLeaveRequestSchema,
  withdrawLeaveRequestSchema,
  configureApproverSchema,
} from '@finverse/contracts';

function sendError(res: Response, err: unknown) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'INVALID_INPUT', message: err.errors[0]?.message || 'Validation error' },
    });
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.startsWith('FORBIDDEN:')) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: msg.replace('FORBIDDEN: ', '') } });
    return;
  }
  if (msg.startsWith('NOT_FOUND:')) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: msg.replace('NOT_FOUND: ', '') } });
    return;
  }
  if (msg.startsWith('SELF_APPROVAL_FORBIDDEN:')) {
    res.status(422).json({ error: { code: 'SELF_APPROVAL_FORBIDDEN', message: msg.replace('SELF_APPROVAL_FORBIDDEN: ', '') } });
    return;
  }
  if (msg.startsWith('UNCONFIGURED_APPROVER:')) {
    res.status(422).json({ error: { code: 'UNCONFIGURED_APPROVER', message: msg.replace('UNCONFIGURED_APPROVER: ', '') } });
    return;
  }
  if (
    msg.startsWith('INVALID_DATE_INTERVAL:') ||
    msg.startsWith('ALREADY_DECIDED:') ||
    msg.startsWith('UNPROCESSABLE_ENTITY:')
  ) {
    res.status(422).json({ error: { code: 'UNPROCESSABLE_ENTITY', message: msg } });
    return;
  }

  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error processing leave request.' },
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

export function createLeaveRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // 1. Submit leave request (any authorized employee role)
  router.post(
    '/requests',
    wrap(async (req, res) => {
      const parsed = submitLeaveRequestSchema.parse(req.body);
      const data = await leaveRepo.submitLeaveRequest(parsed, req.auth!.session);
      res.status(201).json({ data });
    })
  );

  // 2. View my own submitted leave requests
  router.get(
    '/my-requests',
    wrap(async (req, res) => {
      const data = await leaveRepo.getMyLeaveRequests(req.auth!.session.employeeId);
      res.json({ data });
    })
  );

  // 3. Withdraw my pending leave request
  router.post(
    '/requests/:id/withdraw',
    wrap(async (req, res) => {
      const parsed = withdrawLeaveRequestSchema.parse(req.body || {});
      const data = await leaveRepo.withdrawLeaveRequest(req.params.id, parsed.notes, req.auth!.session);
      res.json({ data });
    })
  );

  // 4. Superior approval queue (filtered to superior's authorized span)
  router.get(
    '/approvals',
    wrap(async (req, res) => {
      const data = await leaveRepo.getApprovalsQueue(req.auth!.session);
      res.json({ data });
    })
  );

  // 5. Superior decide: approve
  router.post(
    '/requests/:id/approve',
    wrap(async (req, res) => {
      const parsed = decideLeaveRequestSchema.parse({
        decision: 'approved',
        notes: req.body?.notes || 'Leave approved by designated superior.',
      });
      const data = await leaveRepo.decideLeaveRequest(req.params.id, parsed, req.auth!.session);
      res.json({ data });
    })
  );

  // 6. Superior decide: reject
  router.post(
    '/requests/:id/reject',
    wrap(async (req, res) => {
      const parsed = decideLeaveRequestSchema.parse({
        decision: 'rejected',
        notes: req.body?.notes,
      });
      const data = await leaveRepo.decideLeaveRequest(req.params.id, parsed, req.auth!.session);
      res.json({ data });
    })
  );

  // 7. Organization-wide leave requests (HR role only)
  router.get(
    '/organization-requests',
    wrap(async (req, res) => {
      if (req.auth?.session.role !== 'HR') {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Organization-wide leave visibility requires Human Resources role.' } });
        return;
      }
      const vertical = typeof req.query.vertical === 'string' ? req.query.vertical : undefined;
      const role = typeof req.query.role === 'string' ? req.query.role : undefined;
      const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;
      const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

      const data = await leaveRepo.getOrganizationLeaveRequests({
        vertical,
        role,
        teamId,
        employeeId,
        status,
        startDate,
        endDate,
      });
      res.json({ data });
    })
  );

  // 8. Approver configurations (HR or Superadmin)
  router.get(
    '/approver-configs',
    wrap(async (req, res) => {
      if (!['HR', 'SA'].includes(req.auth?.session.role || '')) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Viewing approver configurations requires HR or Superadmin role.' } });
        return;
      }
      const data = await leaveRepo.listApproverConfigurations();
      res.json({ data });
    })
  );

  router.post(
    '/approver-configs',
    wrap(async (req, res) => {
      if (!['HR', 'SA'].includes(req.auth?.session.role || '')) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Configuring approvers requires HR or Superadmin role.' } });
        return;
      }
      const parsed = configureApproverSchema.parse(req.body);
      const data = await leaveRepo.upsertApproverConfiguration(parsed, req.auth!.session.employeeId);
      res.status(201).json({ data });
    })
  );

  return router;
}
