import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type Express } from 'express';
import { env } from './config';
import { errorHandler, jsonGuard } from './middleware/session';
import { errorBody } from './lib/errors';
import { authRouter } from './routes/auth';
import { leadsRouter } from './routes/leads';
import { wealthRouter } from './routes/wealth';
import { tlRouter } from './routes/tl';
import { managerRouter } from './routes/manager';
import { createRegionalRouter } from './routes/regional-manager';
import { createNationalRouter } from './routes/national-manager';
import { createCeoRouter } from './routes/ceo';
import { createCfoRouter } from './routes/cfo';

// Routing model:
// - Development: Vite dev server proxies /api to http://localhost:4000 (one origin per browser).
// - Production: this server serves the built SPA (apps/web/dist) and /api on ONE domain,
//   with SPA fallback so direct route refreshes work (e.g. /wealth/prospects/FV-1001).
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  // 4mb JSON ceiling for base64 evidence uploads; per-file limit enforced in files.ts (2 MB).
  app.use(express.json({ limit: '4mb' }));
  app.use(jsonGuard);
  app.use('/api/health', (_req, res) => res.status(200).json({ ok: true }));
  app.use('/api/auth', authRouter(env.NODE_ENV === 'production'));
  app.use('/api', wealthRouter());
  app.use('/api', leadsRouter());
  app.use('/api/tl', tlRouter());
  app.use('/api/manager', managerRouter());
  app.use('/api/regional', createRegionalRouter());
  app.use('/api/national', createNationalRouter());
  app.use('/api/ceo', createCeoRouter());
  app.use('/api/cfo', createCfoRouter());
  app.use('/api', (_req, res) => {
    res.status(404).json(errorBody('NOT_FOUND', 'API route not found.'));
  });

  if (env.NODE_ENV === 'production') {
    const webDist = resolve(__dirname, '../../web/dist');
    if (existsSync(webDist)) {
      app.use(express.static(webDist));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(resolve(webDist, 'index.html'));
      });
    }
  }

  app.use(errorHandler);
  return app;
}
