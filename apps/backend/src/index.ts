import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3011',
      'http://127.0.0.1:3011',
      'https://solar-quotation-app.onrender.com',
      'https://solar.rollingenergy.in',
      'https://rollingenergy.co',
      'https://www.rollingenergy.co',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve generated social media assets (JPGs and MP4s) as static files
app.use('/assets', express.static(resolve(__dirname, '../assets'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({ message: 'Solar Quotation API', docs: '/api/health', version: '1.0' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

async function startServer() {
  // Schema must be verified before accepting traffic — Prisma selects all
  // model columns, so a missing production column fails every template query.
  try {
    const { runStartupSchemaFix } = await import('./services/startup-schema-fix.service.js');
    await runStartupSchemaFix();
    console.log('[DB] Schema verified.');
  } catch (err) {
    console.error('[DB] Schema fix failed:', err);
    throw err;
  }

  app.listen(config.port, async () => {
    console.log(`Backend running on http://localhost:${config.port}`);

    try {
      const { ensureDefaultTemplates } = await import('./services/default-templates.service.js');
      await ensureDefaultTemplates();
    } catch (err) {
      console.error('[Default Templates] Failed to ensure default templates:', err);
    }

    try {
      const { ensureProcessTimelineSettings } = await import('./services/process-timeline.service.js');
      const { PrismaClient } = await import('@prisma/client');
      const bootPrisma = new PrismaClient();
      await ensureProcessTimelineSettings(bootPrisma);
      await bootPrisma.$disconnect();
    } catch (err) {
      console.error('[Process Timeline] Failed to ensure global settings:', err);
    }

    // Solar Growth OS — start automation engine + event bus worker
    try {
      const { startAutomationEngine } = await import('./services/crm/automation-engine.service.js');
      startAutomationEngine();
    } catch (err) {
      console.error('[Automation] Failed to start:', err);
    }

    try {
      const { startEventWorker } = await import('./services/crm/event-bus.service.js');
      await startEventWorker();
    } catch (err) {
      console.error('[EventBus] Worker start warning (non-fatal):', err);
    }

    // Drip campaign tick — every 60 seconds
    setInterval(async () => {
      try {
        const { processDripTick } = await import('./services/crm/campaign-engine.service.js');
        await processDripTick();
      } catch (err) {
        console.error('[DripTick] Error:', err);
      }
    }, 60_000);
  });
}

startServer().catch((err) => {
  console.error('[Boot] Fatal startup error:', err);
  process.exit(1);
});
