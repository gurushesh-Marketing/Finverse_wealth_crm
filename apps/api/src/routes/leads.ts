import { Router } from 'express';
import {
  followUpInputSchema,
  leadsQuerySchema,
  toZodFieldErrors,
  type FollowUpResult,
  type MyDayResponse,
} from '@finverse/contracts';
import { errorBody, HttpError } from '../lib/errors';
import { requireSession, type AuthedRequest } from '../middleware/session';
import { createFollowUp, getLead, listLeads, myDay } from '../repo/leads';

export function leadsRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/my-day', async (req: AuthedRequest, res, next) => {
    try {
      const body: MyDayResponse = await myDay(req.auth!.scope);
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get('/leads', async (req: AuthedRequest, res, next) => {
    try {
      const parsed = leadsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res
          .status(422)
          .json(errorBody('VALIDATION_FAILED', 'Invalid filters.', { fieldErrors: toZodFieldErrors(parsed.error) }));
        return;
      }
      const leads = await listLeads(req.auth!.scope, parsed.data);
      res.status(200).json({ leads });
    } catch (err) {
      next(err);
    }
  });

  router.get('/leads/:id', async (req: AuthedRequest, res, next) => {
    try {
      const lead = await getLead(req.auth!.scope, String(req.params.id));
      res.status(200).json(lead);
    } catch (err) {
      next(err);
    }
  });

  router.post('/leads/:id/follow-ups', async (req: AuthedRequest, res, next) => {
    try {
      const parsed = followUpInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(422)
          .json(errorBody('VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: toZodFieldErrors(parsed.error) }));
        return;
      }
      const dueAt = new Date(parsed.data.dueAt);
      if (Number.isNaN(dueAt.getTime())) {
        res
          .status(422)
          .json(errorBody('VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { dueAt: ['Enter a valid date and time.'] } }));
        return;
      }
      if (dueAt.getTime() <= Date.now()) {
        res
          .status(422)
          .json(errorBody('VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { dueAt: ['Due time must be in the future.'] } }));
        return;
      }
      const result = await createFollowUp(req.auth!.scope, String(req.params.id), parsed.data);
      const body: FollowUpResult = result;
      res.status(201).json(body);
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        res.status(409).json(errorBody(err.code, err.message));
        return;
      }
      next(err);
    }
  });

  return router;
}
