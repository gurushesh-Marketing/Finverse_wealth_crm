import { Router, Response, NextFunction } from 'express';
import {
  qualifyAndHandoffInputSchema,
  handoffDecisionInputSchema,
  institutionCoordinationInputSchema,
  recordVerificationInputSchema,
  toZodFieldErrors,
} from '@finverse/contracts';
import { AuthedRequest } from '../middleware/session';
import { errorBody, HttpError } from '../lib/errors';
import {
  qualifyAndHandoffLead,
  listRelHandoffs,
  decideHandoff,
  addInstitutionCoordination,
  getRelPortfolio,
  getRelProspectDetail,
  recordCheckVerification,
} from '../repo/rel';

export function relRouter(): Router {
  const router = Router();

  // Middleware ensuring user is authenticated with scope
  router.use((req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth?.scope) {
      res.status(401).json(errorBody('UNAUTHENTICATED', 'Sign in required.'));
      return;
    }
    next();
  });

  // Qualify prospect & hand off to Relationship Manager (Sales Caller action)
  router.post('/qualify-and-handoff', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = qualifyAndHandoffInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json(
          errorBody('VALIDATION_FAILED', 'Check highlighted qualification fields.', {
            fieldErrors: toZodFieldErrors(parsed.error),
          })
        );
        return;
      }

      const result = await qualifyAndHandoffLead(req.auth!.scope, parsed.data);
      res.status(201).json({
        handoff: result,
        assignedRel: { id: result.relEmployeeId, name: result.relName },
      });
    } catch (err) {
      next(err);
    }
  });

  // List handoffs (REL sees assigned handoffs; SC sees their outbound handoffs without restricted partner details)
  router.get('/handoffs', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;
      const handoffs = await listRelHandoffs(req.auth!.scope, { status, leadId });
      res.status(200).json({ handoffs });
    } catch (err) {
      next(err);
    }
  });

  // Accept or return handoff (Relationship Manager action)
  router.post('/handoffs/:id/decision', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = handoffDecisionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json(
          errorBody('VALIDATION_FAILED', 'Check highlighted decision fields.', {
            fieldErrors: toZodFieldErrors(parsed.error),
          })
        );
        return;
      }

      const updated = await decideHandoff(req.auth!.scope, String(req.params.id), parsed.data);
      res.status(200).json({ handoff: updated });
    } catch (err) {
      next(err);
    }
  });

  // Record partner institution coordination / sanction terms (Relationship Manager action)
  router.post('/handoffs/:id/institution-coordination', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = institutionCoordinationInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json(
          errorBody('VALIDATION_FAILED', 'Check highlighted partner coordination fields.', {
            fieldErrors: toZodFieldErrors(parsed.error),
          })
        );
        return;
      }

      const options = await addInstitutionCoordination(req.auth!.scope, String(req.params.id), parsed.data);
      res.status(201).json({ institutionOptions: options });
    } catch (err) {
      next(err);
    }
  });

  // Active Portfolio of qualified prospects for Relationship Manager
  router.get('/portfolio', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const portfolio = await getRelPortfolio(req.auth!.scope);
      res.status(200).json({ portfolio });
    } catch (err) {
      next(err);
    }
  });

  // Detailed prospect view with full CRM timeline, document review checklist, and credit bureau status
  router.get('/prospects/:id', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const detail = await getRelProspectDetail(req.auth!.scope, String(req.params.id));
      res.status(200).json(detail);
    } catch (err) {
      next(err);
    }
  });

  // Record human-reviewed or provider verification evidence (Relationship Manager action)
  router.post('/prospects/:id/verification', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = recordVerificationInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json(
          errorBody('VALIDATION_FAILED', 'Check highlighted verification fields.', {
            fieldErrors: toZodFieldErrors(parsed.error),
          })
        );
        return;
      }

      const detail = await recordCheckVerification(req.auth!.scope, String(req.params.id), parsed.data);
      res.status(200).json(detail);
    } catch (err) {
      next(err);
    }
  });

  // Deal review pack PDF export
  router.get('/export-pack', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.auth!.scope.role !== 'REL' && req.auth!.scope.role !== 'MG') {
        res.status(403).json(errorBody('FORBIDDEN', 'Only Relationship Managers can export review packs.'));
        return;
      }

      const portfolio = await getRelPortfolio(req.auth!.scope);
      const title = `Finverse CRM - Relationship Manager Portfolio Review Pack (${req.auth!.scope.displayName})`;
      const timestamp = new Date().toISOString();

      const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 14 Tf
50 720 Td
(${title}) Tj
/F1 10 Tf
0 -30 Td
(Generated: ${timestamp}) Tj
0 -20 Td
(Total Active Qualified Prospects: ${portfolio.length}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000475 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
555
%%EOF`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="rm-deal-review-pack.pdf"');
      res.status(200).send(Buffer.from(pdfContent));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
