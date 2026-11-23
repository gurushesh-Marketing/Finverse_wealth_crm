import { createHash } from 'node:crypto';
import express, { Router, type Request } from 'express';
import { websiteEnquirySchema } from '@finverse/contracts';
import { errorBody } from '../lib/errors';
import { createWebsiteEnquiry } from '../repo/data-entry';
import { jsonGuard } from '../middleware/session';

// Public, unauthenticated endpoints for the marketing website (RELEASE_ISSUES P0-10).
// Mounted before the app-wide 4 MB JSON parser so this router's 16 KB ceiling applies.

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 20;
const MAX_PER_PHONE = 5;
const hits = new Map<string, { count: number; resetAt: number }>();

/** Returns true when the key is over its hourly limit; otherwise counts the hit. */
function overLimit(key: string, max: number): boolean {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count += 1;
  return false;
}

function ipHash(req: Request): string {
  return createHash('sha256').update(`finverse-web:${req.ip ?? 'unknown'}`).digest('hex');
}

export function publicRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: '16kb' }));
  router.use(jsonGuard);

  router.post('/enquiries', async (req, res, next) => {
    try {
      const parsed = websiteEnquirySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join('.') || 'root';
          (fieldErrors[key] ??= []).push(issue.message);
        }
        res.status(422).json(errorBody('VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors }));
        return;
      }
      const input = parsed.data;
      const hash = ipHash(req);

      // Honeypot filled: answer like a success so bots learn nothing, store nothing.
      if (input.website && input.website.trim() !== '') {
        res.status(202).json({ data: { reference: 'received', department: 'wealth' } });
        return;
      }
      if (overLimit(`ip:${hash}`, MAX_PER_IP) || overLimit(`phone:${input.mobile}`, MAX_PER_PHONE)) {
        res.status(429).json(errorBody('RATE_LIMITED', 'Too many enquiries. Please try again later or call us.'));
        return;
      }

      const receipt = await createWebsiteEnquiry(input, { ipHash: hash, userAgent: req.get('user-agent') });
      res.status(receipt.replay ? 200 : 201).json({
        data: { reference: receipt.reference, department: receipt.department },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
