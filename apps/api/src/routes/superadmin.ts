import { Router as makeRouter, type Response, type Router } from 'express';
import { ZodError } from 'zod';
import {
  saCreateAccountSchema,
  saGrantScopeSchema,
  saAdditionalScopeSchema,
  saRestructureHierarchySchema,
  saActivateTransferSchema,
  saOffboardEmployeeSchema,
  saAccountRecoverySchema,
  saPublishConfigSchema,
  saIncidentActionSchema,
  saRetryJobSchema,
  saDecideDelegationSchema,
} from '@finverse/contracts';
import { requireSession, type AuthedRequest } from '../middleware/session';
import * as sa from '../repo/superadmin';

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
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.startsWith('DUPLICATE_IDENTITY') || msg.startsWith('VERSION_CONFLICT')) {
      res.status(409).json({ error: { code: 'CONFLICT', message: msg } });
      return;
    }
    if (msg.startsWith('NOT_FOUND')) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: msg } });
      return;
    }
    if (
      msg.startsWith('CYCLE_DETECTED') ||
      msg.startsWith('INVALID_CROSS_VERTICAL_PARENT') ||
      msg.startsWith('IDEMPOTENCY_MISMATCH') ||
      msg.startsWith('RETRY_LIMIT_EXCEEDED') ||
      msg.startsWith('ABSENT_PLACEMENT') ||
      msg.startsWith('UNAPPROVED_REQUEST') ||
      msg.startsWith('REQUEST_ALREADY_ACTIVATED') ||
      msg.startsWith('UNSUPPORTED_CONFIGURATION_TYPE') ||
      msg.startsWith('CONFIG_VALIDATION_FAILED') ||
      msg.startsWith('INVALID_CONFIGURATION_SCHEMA') ||
      msg.startsWith('CONFIGURATION_APPROVAL_REQUIRED') ||
      msg.startsWith('CANNOT_RENEW_REVOKED_GRANT') ||
      msg.startsWith('JUSTIFICATION_REQUIRED') ||
      msg.startsWith('GRANT_EXPIRED') ||
      msg.startsWith('JOB_NOT_FAILED') ||
      msg.startsWith('EMPLOYEE_NOT_ACTIVE') ||
      msg.startsWith('ACCOUNT_INACTIVE') ||
      msg.startsWith('TOKEN_ALREADY_USED') ||
      msg.startsWith('TOKEN_EXPIRED') ||
      msg.startsWith('INVALID_TOKEN')
    ) {
      res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: msg } });
      return;
    }
    if (msg.startsWith('RECOVERY_FORBIDDEN')) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: msg } });
      return;
    }
  }
  console.error('[api] unexpected error in Superadmin routes:', err);
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

export function createSuperadminRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // Role gate: only Super Admin (SA) can access Superadmin endpoints
  router.use((req: AuthedRequest, res, next) => {
    if (req.auth?.session.role !== 'SA') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Super Admin role required.' } });
      return;
    }
    next();
  });

  // Overview
  router.get(
    '/overview',
    wrap(async (_req, res) => {
      const data = await sa.getSuperadminOverview();
      res.json({ data });
    })
  );

  // SA-01: Account Creation & Expiring Activation Invitations
  router.post(
    '/accounts/provision',
    wrap(async (req, res) => {
      const parsed = saCreateAccountSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.provisionAccount(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  router.get(
    '/accounts/invitations',
    wrap(async (_req, res) => {
      const data = await sa.listInvitations();
      res.json({ data });
    })
  );

  // SA-02: Precise Role & Organisation Scope Grant
  router.post(
    '/scopes/grant',
    wrap(async (req, res) => {
      const parsed = saGrantScopeSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.grantScope(parsed, actorId);
      res.json({ data });
    })
  );

  // SA-03: Additional Team / Vertical Scope in Same Role
  router.post(
    '/scopes/additional-grant',
    wrap(async (req, res) => {
      const parsed = saAdditionalScopeSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.grantAdditionalScope(parsed, actorId);
      res.json({ data });
    })
  );

  router.get(
    '/scopes/employee/:id',
    wrap(async (req, res) => {
      const data = await sa.getEmployeeAssignments(req.params.id);
      res.json({ data });
    })
  );

  // SA-04: Reporting Hierarchy Creation & Restructuring
  router.get(
    '/hierarchy',
    wrap(async (req, res) => {
      const vertical = req.query.vertical as string | undefined;
      const data = await sa.getReportingHierarchy(vertical);
      res.json({ data });
    })
  );

  router.post(
    '/hierarchy/restructure',
    wrap(async (req, res) => {
      const parsed = saRestructureHierarchySchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.restructureHierarchy(parsed, actorId);
      res.json({ data });
    })
  );

  // SA-05: Transfer / Promotion Activation
  router.get(
    '/lifecycle/transfers',
    wrap(async (_req, res) => {
      const data = await sa.listPendingTransfers();
      res.json({ data });
    })
  );

  router.post(
    '/lifecycle/transfers/activate',
    wrap(async (req, res) => {
      const parsed = saActivateTransferSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.activateTransfer(parsed, actorId);
      res.json({ data });
    })
  );

  // SA-06: Offboarding & Session Revocation
  router.post(
    '/lifecycle/offboard',
    wrap(async (req, res) => {
      const parsed = saOffboardEmployeeSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.offboardEmployee(parsed, actorId);
      res.json({ data });
    })
  );

  router.get(
    '/lifecycle/holding-queues',
    wrap(async (_req, res) => {
      const data = await sa.listHoldingQueues();
      res.json({ data });
    })
  );

  // SA-07: Safe Account Recovery
  router.post(
    '/accounts/recovery-reset',
    wrap(async (req, res) => {
      const parsed = saAccountRecoverySchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.requestAccountRecovery(parsed, actorId);
      res.json({ data });
    })
  );

  router.get(
    '/accounts/recoveries',
    wrap(async (_req, res) => {
      const data = await sa.listAccountRecoveries();
      res.json({ data });
    })
  );

  // SA-08: Approved Business Configuration Publication
  router.get(
    '/configuration/versions',
    wrap(async (_req, res) => {
      const data = await sa.listBusinessConfigurations();
      res.json({ data });
    })
  );

  router.post(
    '/configuration/publish',
    wrap(async (req, res) => {
      const parsed = saPublishConfigSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.publishBusinessConfiguration(parsed, actorId);
      res.status(201).json({ data });
    })
  );

  // SA-09: Restricted Audit Investigation & Incident Actions
  router.get(
    '/incidents',
    wrap(async (req, res) => {
      const actorId = req.auth!.session.employeeId;
      const search = req.query.search as string | undefined;
      const data = await sa.listAuditIncidents(actorId, search);
      res.json({ data });
    })
  );

  router.post(
    '/incidents/actions',
    wrap(async (req, res) => {
      const parsed = saIncidentActionSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.actOnIncident(parsed, actorId);
      res.json({ data });
    })
  );

  // SA-10: Safe, Bounded Failed-Job Recovery
  router.get(
    '/jobs',
    wrap(async (req, res) => {
      const queue = req.query.queue as string | undefined;
      const data = await sa.listBackgroundJobs(queue);
      res.json({ data });
    })
  );

  router.post(
    '/jobs/retry',
    wrap(async (req, res) => {
      const parsed = saRetryJobSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.retryBackgroundJob(parsed, actorId);
      res.json({ data });
    })
  );

  // SA-11: Temporary Access Expiry, Review & Approved Renewal
  router.get(
    '/delegations',
    wrap(async (_req, res) => {
      const data = await sa.listTemporaryGrants();
      res.json({ data });
    })
  );

  router.post(
    '/delegations/decide',
    wrap(async (req, res) => {
      const parsed = saDecideDelegationSchema.parse(req.body);
      const actorId = req.auth!.session.employeeId;
      const data = await sa.decideTemporaryGrant(parsed, actorId);
      res.json({ data });
    })
  );

  // Demo Local Delivery Outbox
  router.get(
    '/local-delivery',
    wrap(async (req, res) => {
      const limit = Number(req.query.limit) || 20;
      const data = await sa.listLocalDeliveryOutbox(limit);
      res.json({ data });
    })
  );

  return router;
}
