import type { Request, Response, NextFunction } from 'express';

/** Allows ADMIN or FINANCE roles only. Use after authenticate. */
export function requireFinanceAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role === 'ADMIN' || req.user.role === 'FINANCE') {
    return next();
  }

  return res.status(403).json({ error: 'Finance panel access required' });
}
