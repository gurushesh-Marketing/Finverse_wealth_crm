import { Router, type Request, type Response, type NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';
import {
  availabilityChangeSchema,
  conversionSchema,
  documentRequestSchema,
  enquirySchema,
  helpRequestSchema,
  handoffSchema,
  lossSchema,
  manualActivitySchema,
  meetingSchema,
  optOutSchema,
  outcomeDecisionSchema,
  proposalSchema,
  prospectCorrectionSchema,
  qualificationSchema,
  REPORT_PERIODS,
  rescheduleSchema,
  reviewResponseSchema,
  reopenSchema,
  savedViewSchema,
  stageChangeSchema,
  taskTransitionSchema,
  toZodFieldErrors,
  whatsappSendSchema,
  wrapUpSchema,
  callStartSchema,
  inboundMessageSchema,
} from '@finverse/contracts';
import { HttpError, errorBody } from '../lib/errors';
import { requireSession, type AuthedRequest } from '../middleware/session';
import * as work from '../repo/work';
import * as comms from '../repo/comms';
import * as pipeline from '../repo/pipeline';
import * as files from '../repo/files';
import * as reports from '../repo/reports';
import { myDay } from '../repo/leads';

function parse<S extends ZodTypeAny>(schema: S, req: Request): S['_output'] {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: toZodFieldErrors(parsed.error),
    });
  }
  return parsed.data;
}

function wrap(fn: (req: AuthedRequest, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req as AuthedRequest, res).catch(next);
  };
}

export function wealthRouter(): Router {
  const router = Router();
  router.use(requireSession);

  // SC-01
  router.get('/my-day', wrap(async (req, res) => {
    const day = await myDay(req.auth!.scope);
    const availability = await work.getAvailability(req.auth!.scope);
    res.json({ ...day, availability });
  }));
  router.get('/my-day/signal', wrap(async (req, res) => {
    res.json(await work.daySignal(req.auth!.scope));
  }));
  router.post('/availability', wrap(async (req, res) => {
    res.json(await work.setAvailability(req.auth!.scope, parse(availabilityChangeSchema, req)));
  }));

  // SC-02
  router.get('/views', wrap(async (req, res) => res.json({ views: await work.listSavedViews(req.auth!.scope) })));
  router.post('/views', wrap(async (req, res) => res.status(201).json(await work.createSavedView(req.auth!.scope, parse(savedViewSchema, req)))));
  router.delete('/views/:id', wrap(async (req, res) => {
    await work.deleteSavedView(req.auth!.scope, String(req.params.id));
    res.status(204).end();
  }));

  // SC-04
  router.patch('/leads/:id', wrap(async (req, res) => {
    res.json(await pipeline.correctProspect(req.auth!.scope, String(req.params.id), parse(prospectCorrectionSchema, req)));
  }));
  router.get('/leads/:id/audit', wrap(async (req, res) => {
    res.json({ audit: await pipeline.listAudit(req.auth!.scope, String(req.params.id)) });
  }));

  // SC-05
  router.get('/enquiries', wrap(async (req, res) => res.json({ enquiries: await pipeline.listEnquiries(req.auth!.scope) })));
  router.post('/enquiries', wrap(async (req, res) => res.status(201).json(await pipeline.createEnquiry(req.auth!.scope, parse(enquirySchema, req)))));
  router.post('/enquiries/:id/publish', wrap(async (req, res) => res.json(await pipeline.publishEnquiry(req.auth!.scope, String(req.params.id)))));

  // SC-06/07/08
  router.get('/leads/:id/conversations', wrap(async (req, res) => res.json(await comms.listConversations(req.auth!.scope, String(req.params.id)))));
  router.post('/leads/:id/calls', wrap(async (req, res) => res.status(201).json(await comms.startCall(req.auth!.scope, String(req.params.id), parse(callStartSchema, req)))));
  router.post('/calls/:id/state', wrap(async (req, res) => {
    res.json(await comms.advanceCall(req.auth!.scope, String(req.params.id), String((req.body ?? {}).status)));
  }));
  router.post('/calls/:id/wrapup', wrap(async (req, res) => res.json(await comms.saveWrapup(req.auth!.scope, String(req.params.id), parse(wrapUpSchema, req)))));
  router.post('/leads/:id/activities', wrap(async (req, res) => res.status(201).json(await comms.logManualActivity(req.auth!.scope, String(req.params.id), parse(manualActivitySchema, req)))));

  // SC-09/10/24
  router.post('/leads/:id/messages', wrap(async (req, res) => res.status(201).json(await comms.sendWhatsApp(req.auth!.scope, String(req.params.id), parse(whatsappSendSchema, req)))));
  router.post('/messages/:id/status', wrap(async (req, res) => {
    res.json(await comms.advanceMessageStatus(req.auth!.scope, String(req.params.id), String((req.body ?? {}).status)));
  }));
  router.post('/inbound', wrap(async (req, res) => res.status(201).json(await comms.receiveInbound(req.auth!.scope, parse(inboundMessageSchema, req)))));
  router.post('/leads/:id/opt-out', wrap(async (req, res) => res.json(await comms.recordOptOut(req.auth!.scope, String(req.params.id), parse(optOutSchema, req)))));

  // SC-11/12/13 + reminders
  router.get('/tasks', wrap(async (req, res) => {
    res.json({ tasks: await work.listMyTasks(req.auth!.scope, req.query.leadId ? String(req.query.leadId) : undefined) });
  }));
  router.post('/tasks/:id/reschedule', wrap(async (req, res) => res.json(await work.rescheduleTask(req.auth!.scope, String(req.params.id), parse(rescheduleSchema, req)))));
  router.post('/tasks/:id/transition', wrap(async (req, res) => res.json(await work.transitionTask(req.auth!.scope, String(req.params.id), parse(taskTransitionSchema, req)))));
  router.post('/reminders/tick', wrap(async (_req, res) => {
    res.json({ sent: await work.executeDueReminders(new Date()) });
  }));

  // SC-14
  router.post('/leads/:id/meetings', wrap(async (req, res) => res.status(201).json(await work.bookMeeting(req.auth!.scope, String(req.params.id), parse(meetingSchema, req)))));
  router.post('/meetings/:id/outcome', wrap(async (req, res) => {
    const outcome = String((req.body ?? {}).outcome);
    if (!['attended', 'no-show', 'cancelled'].includes(outcome)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Unknown meeting outcome.', {});
    }
    res.json(await work.setMeetingOutcome(req.auth!.scope, String(req.params.id), outcome as 'attended' | 'no-show' | 'cancelled'));
  }));

  // SC-15/16/17/20/21/22/23/28 + approvals
  router.post('/leads/:id/qualification', wrap(async (req, res) => res.status(201).json(await pipeline.saveQualification(req.auth!.scope, String(req.params.id), parse(qualificationSchema, req)))));
  router.post('/leads/:id/stage', wrap(async (req, res) => res.json(await pipeline.moveStage(req.auth!.scope, String(req.params.id), parse(stageChangeSchema, req)))));
  router.get('/leads/:id/proposals', wrap(async (req, res) => res.json({ proposals: await pipeline.listProposals(req.auth!.scope, String(req.params.id)) })));
  router.post('/leads/:id/proposals', wrap(async (req, res) => res.status(201).json(await pipeline.createProposal(req.auth!.scope, String(req.params.id), parse(proposalSchema, req)))));
  router.post('/proposals/:id/submit', wrap(async (req, res) => res.json(await pipeline.submitProposal(req.auth!.scope, String(req.params.id)))));
  router.post('/proposals/:id/approve', wrap(async (req, res) => res.json(await pipeline.approveProposal(req.auth!.scope, String(req.params.id)))));
  router.post('/proposals/:id/send', wrap(async (req, res) => res.json(await pipeline.sendProposal(req.auth!.scope, String(req.params.id)))));
  router.post('/leads/:id/conversion', wrap(async (req, res) => res.status(201).json(await pipeline.requestConversion(req.auth!.scope, String(req.params.id), parse(conversionSchema, req)))));
  router.post('/leads/:id/loss', wrap(async (req, res) => res.json(await pipeline.markLost(req.auth!.scope, String(req.params.id), parse(lossSchema, req)))));
  router.post('/leads/:id/reopen', wrap(async (req, res) => res.status(201).json(await pipeline.requestReopen(req.auth!.scope, String(req.params.id), parse(reopenSchema, req)))));
  router.post('/leads/:id/handoff', wrap(async (req, res) => res.status(201).json(await pipeline.requestHandoff(req.auth!.scope, String(req.params.id), parse(handoffSchema, req)))));
  router.post('/leads/:id/help', wrap(async (req, res) => res.status(201).json(await pipeline.requestHelp(req.auth!.scope, String(req.params.id), parse(helpRequestSchema, req)))));
  router.get('/leads/:id/requests', wrap(async (req, res) => res.json({ requests: await pipeline.listRequests(req.auth!.scope, String(req.params.id)) })));
  const decideOutcomeHandler = wrap(async (req, res) => {
    const input = parse(outcomeDecisionSchema, req);
    res.json(await pipeline.decideRequest(req.auth!.scope, String(req.params.id), input.decision, input.reason, input.evidence));
  });
  router.post('/requests/:id/decide', decideOutcomeHandler);
  router.post('/requests/:id/decision', decideOutcomeHandler);

  // SC-18/19
  router.get('/leads/:id/document-requests', wrap(async (req, res) => res.json({ requests: await files.listDocumentRequests(req.auth!.scope, String(req.params.id)) })));
  router.post('/leads/:id/document-requests', wrap(async (req, res) => res.status(201).json(await files.createDocumentRequest(req.auth!.scope, String(req.params.id), parse(documentRequestSchema, req)))));
  router.post('/document-requests/:id/rotate', wrap(async (req, res) => res.json(await files.rotateUploadToken(req.auth!.scope, String(req.params.id)))));
  router.get('/leads/:id/documents', wrap(async (req, res) => res.json({ documents: await files.listDocuments(req.auth!.scope, String(req.params.id)) })));
  router.post('/documents', wrap(async (req, res) => {
    const body = req.body ?? {};
    res.status(201).json(await files.uploadDocument(req.auth!.scope, {
      leadId: String(body.leadId),
      requestId: body.requestId ? String(body.requestId) : undefined,
      documentType: String(body.documentType ?? ''),
      filename: String(body.filename ?? 'upload.bin'),
      mimeType: String(body.mimeType ?? 'application/octet-stream'),
      contentBase64: String(body.contentBase64 ?? ''),
    }));
  }));
  router.get('/documents/:id/download', wrap(async (req, res) => {
    const file = await files.downloadDocument(req.auth!.scope, String(req.params.id));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/[^\w.\-]/g, '_')}"`);
    res.send(file.bytes);
  }));
  router.post('/documents/:id/review', wrap(async (req, res) => {
    res.json(await files.reviewDocument(req.auth!.scope, String(req.params.id), Boolean((req.body ?? {}).accept), (req.body ?? {}).reason));
  }));

  // SC-25/26/27
  router.get('/reports/performance', wrap(async (req, res) => {
    const period = String(req.query.period ?? 'monthly');
    if (!(REPORT_PERIODS as readonly string[]).includes(period)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Unknown period.', {});
    }
    res.json(await reports.computePerformance(req.auth!.scope, period as (typeof REPORT_PERIODS)[number]));
  }));
  router.post('/reports/exports', wrap(async (req, res) => {
    const period = String((req.body ?? {}).period ?? 'monthly');
    if (!(REPORT_PERIODS as readonly string[]).includes(period)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Unknown period.', {});
    }
    res.status(201).json(await reports.createExport(req.auth!.scope, period as (typeof REPORT_PERIODS)[number]));
  }));
  router.get('/reports/exports/:id/download', wrap(async (req, res) => {
    const file = await reports.downloadExport(req.auth!.scope, String(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.bytes);
  }));
  router.get('/reviews', wrap(async (req, res) => res.json({ reviews: await reports.listReviews(req.auth!.scope) })));
  router.post('/reviews/:id/response', wrap(async (req, res) => res.json(await reports.respondToReview(req.auth!.scope, String(req.params.id), parse(reviewResponseSchema, req)))));

  return router;
}

export { errorBody };
