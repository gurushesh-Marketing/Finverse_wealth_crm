import { Router as makeRouter, type Response, type Router } from 'express';
import { ZodError } from 'zod';
import { requireSession, type AuthedRequest } from '../middleware/session';
import {
  CreateCompensationPlanInputSchema,
  PayrollPreviewQuerySchema,
  FinalizePayrollInputSchema,
} from '@finverse/contracts';
import {
  getCompensationPlans,
  getCompensationPlanById,
  getCompensationAuditHistory,
  createOrUpdateCompensationPlan,
  getPayrollCycles,
  getPayrollCycleByCode,
  calculatePayrollPreview,
  finalizePayrollCycle,
} from '../repo/payroll';

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
      details: e.details,
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

export function createPayrollRouter(): Router {
  const router = makeRouter();
  router.use(requireSession);

  // 1. Get Compensation Plans (HR/CFO/SA/CEO only)
  const getPlansHandler = wrap(async (req, res) => {
    const plans = await getCompensationPlans(req.auth!.session, {
      employee_id: req.query.employee_id as string | undefined,
      vertical: req.query.vertical as string | undefined,
      active_only: req.query.active_only === 'true',
    });
    res.json({ plans });
  });
  router.get('/compensation/plans', getPlansHandler);
  router.get('/plans', getPlansHandler);

  // 2. Get Single Compensation Plan by ID
  const getPlanByIdHandler = wrap(async (req, res) => {
    const plan = await getCompensationPlanById(req.auth!.session, req.params.id);
    if (!plan) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Compensation plan not found.' } });
      return;
    }
    res.json({ plan });
  });
  router.get('/compensation/plans/:id', getPlanByIdHandler);
  router.get('/plans/:id', getPlanByIdHandler);

  // 3. Get Compensation Audit History
  const getAuditHistoryHandler = wrap(async (req, res) => {
    const history = await getCompensationAuditHistory(
      req.auth!.session,
      req.query.employee_id as string | undefined
    );
    res.json({ history });
  });
  router.get('/compensation/audit-history', getAuditHistoryHandler);
  router.get('/audit-history', getAuditHistoryHandler);

  // 4. Create or Update Compensation Plan
  const createPlanHandler = wrap(async (req, res) => {
    const input = CreateCompensationPlanInputSchema.parse(req.body);
    const plan = await createOrUpdateCompensationPlan(req.auth!.session, input);
    res.status(201).json({ plan });
  });
  router.post('/compensation/plans', createPlanHandler);
  router.post('/plans', createPlanHandler);

  // 5. Get Payroll Cycles
  router.get(
    '/cycles',
    wrap(async (req, res) => {
      const cycles = await getPayrollCycles(req.auth!.session);
      res.json({ cycles });
    })
  );

  // 6. Get Specific Payroll Cycle
  router.get(
    '/cycles/:code',
    wrap(async (req, res) => {
      const cycle = await getPayrollCycleByCode(req.auth!.session, req.params.code);
      if (!cycle) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payroll cycle not found.' } });
        return;
      }
      res.json({ cycle });
    })
  );

  // 7. Calculate Payroll Preview
  router.post(
    '/preview',
    wrap(async (req, res) => {
      const query = PayrollPreviewQuerySchema.parse(req.body);
      const preview = await calculatePayrollPreview(req.auth!.session, query);
      res.json(preview);
    })
  );

  // 8. Policy-Gated Finalize Cycle
  router.post(
    '/finalize',
    wrap(async (req, res) => {
      const input = FinalizePayrollInputSchema.parse(req.body);
      const finalized = await finalizePayrollCycle(req.auth!.session, input);
      res.json({ cycle: finalized });
    })
  );

  return router;
}
