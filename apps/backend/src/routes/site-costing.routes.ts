import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { calculateSiteCosting } from '../services/site-costing.service.js';

const router = Router();

router.post('/calculate', authenticate, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { inputs, lineItemOverrides, profitMarginPct } = req.body as {
      inputs?: Record<string, unknown>;
      lineItemOverrides?: Record<string, number>;
      profitMarginPct?: number;
    };
    const result = calculateSiteCosting(inputs ?? {}, lineItemOverrides, {
      profitMarginPct: profitMarginPct != null ? Number(profitMarginPct) : 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
