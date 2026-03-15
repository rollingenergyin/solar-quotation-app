import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { body, param, validationResult } from 'express-validator';
import * as ocrService from '../services/ocr.service.js';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|webp)|application\/pdf$/;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, WebP) and PDF allowed'));
    }
  },
});

/** Upload image/PDF and run OCR pipeline */
router.post(
  '/upload',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof Error) {
          if (err.message.includes('allowed')) return res.status(400).json({ error: err.message });
          if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large (max 10MB)' });
          }
        }
        return next(err);
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
      }

      const { buffer, mimetype } = req.file;
      const isPdf = mimetype === 'application/pdf';

      const result = isPdf
        ? await ocrService.processPdf(buffer)
        : await ocrService.processImage(buffer);

      res.json({
        success: result.success,
        rawText: result.rawText,
        monthlyReadings: result.monthlyReadings,
        tables: result.tables,
        chartLabels: result.chartLabels,
        overallConfidence: result.overallConfidence,
        warnings: result.warnings,
        processingTimeMs: result.processingTimeMs,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** Save OCR result to electricity bills (with optional manual overrides) */
router.post(
  '/save',
  authenticate,
  [
    body('siteId').trim().notEmpty().withMessage('siteId required'),
    body('readings').isArray().withMessage('readings must be an array'),
    body('readings.*.month').isInt({ min: 1, max: 12 }),
    body('readings.*.year').isInt({ min: 2000, max: 2100 }),
    body('readings.*.unitsKwh').isFloat({ min: 0 }),
    body('readings.*.amount').optional().isFloat({ min: 0 }),
    body('readings.*.confidence').optional().isFloat({ min: 0, max: 1 }),
    body('billImageUrl').optional().trim(),
    body('ocrRawData').optional().isObject(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { siteId, readings, billImageUrl, ocrRawData } = req.body;

      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (!site) {
        return res.status(404).json({ error: 'Site not found' });
      }

      const created = [];
      for (const r of readings) {
        const record = await prisma.electricityBill.upsert({
          where: {
            siteId_month_year: {
              siteId,
              month: r.month,
              year: r.year,
            },
          },
          update: {
            unitsKwh: r.unitsKwh,
            amount: r.amount ?? undefined,
            source: 'OCR',
            billImageUrl: billImageUrl ?? undefined,
            ocrRawData: ocrRawData ?? undefined,
          },
          create: {
            siteId,
            month: r.month,
            year: r.year,
            unitsKwh: r.unitsKwh,
            amount: r.amount ?? undefined,
            source: 'OCR',
            billImageUrl: billImageUrl ?? undefined,
            ocrRawData: ocrRawData ?? undefined,
          },
        });
        created.push(record);
      }

      res.status(201).json({ saved: created });
    } catch (err) {
      next(err);
    }
  }
);

/** Manual override: update a single electricity bill reading */
router.patch(
  '/bills/:id',
  authenticate,
  param('id').trim().notEmpty(),
  [
    body('unitsKwh').optional().isFloat({ min: 0 }),
    body('amount').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { unitsKwh, amount } = req.body;
      const update: { unitsKwh?: number; amount?: number } = {};
      if (unitsKwh !== undefined) update.unitsKwh = unitsKwh;
      if (amount !== undefined) update.amount = amount;

      const bill = await prisma.electricityBill.update({
        where: { id: req.params.id },
        data: update,
      });

      res.json(bill);
    } catch (err) {
      next(err);
    }
  }
);

/** Get electricity bills for a site */
router.get(
  '/bills/:siteId',
  authenticate,
  param('siteId').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bills = await prisma.electricityBill.findMany({
        where: { siteId: req.params.siteId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      });
      res.json(bills);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
