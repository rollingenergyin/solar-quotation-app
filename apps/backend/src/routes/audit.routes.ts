import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { getAuditLogs } from '../services/audit.service.js';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authenticate, requireRoles(Role.ADMIN), async (req, res, next) => {
  try {
    const { entity, entityId, userId, limit, offset } = req.query;
    const result = await getAuditLogs({
      entity: entity ? String(entity) : undefined,
      entityId: entityId ? String(entityId) : undefined,
      userId: userId ? String(userId) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
