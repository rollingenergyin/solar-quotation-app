import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://solar-quotation-app.onrender.com',
      'https://solar.rollingenergy.in',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({ message: 'Solar Quotation API', docs: '/api/health', version: '1.0' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

app.listen(config.port, async () => {
  console.log(`Backend running on http://localhost:${config.port}`);

  // Ensure DB schema is up to date regardless of migration history state.
  // These are idempotent (IF NOT EXISTS / IF EXISTS) so they're safe to run
  // on every startup and won't fail if the column already exists.
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "quotations"
        ADD COLUMN IF NOT EXISTS "sanctioned_load_increased_to_kw" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "inverterSizeKw" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "quotationDataJson" JSONB,
        ADD COLUMN IF NOT EXISTS "generatedPdfPath" TEXT,
        ADD COLUMN IF NOT EXISTS "parentQuotationId" TEXT,
        ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "quotation_sequence" (
        "id" TEXT NOT NULL DEFAULT 'main',
        "nextValue" INTEGER NOT NULL DEFAULT 1,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        CONSTRAINT "quotation_sequence_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$disconnect();
    console.log('[DB] Schema columns verified.');
  } catch (err) {
    console.error('[DB] Schema fix warning (non-fatal):', err);
  }

  try {
    const { ensureDefaultTemplates } = await import('./services/default-templates.service.js');
    await ensureDefaultTemplates();
  } catch (err) {
    console.error('[Default Templates] Failed to ensure default templates:', err);
  }
});
