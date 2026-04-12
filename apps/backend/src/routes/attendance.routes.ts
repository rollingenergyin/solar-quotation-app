import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { Role } from '@prisma/client';
import * as svc from '../services/attendance.service.js';
import fs from 'fs';

const router = Router();
router.use(authenticate);

// ─── Employee: Check In ───────────────────────────────────────────────────────

router.post('/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { selfieBase64, lat, lng, accuracyM, description, workLocation, clientCapturedAt, deviceInfo, syncBatchId } = req.body;

    if (!selfieBase64) return res.status(400).json({ error: 'Selfie is required' });
    if (!description?.trim()) return res.status(400).json({ error: 'Check-in description is required' });

    const day = await svc.checkIn({
      userId: req.user!.userId,
      selfieBase64,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      accuracyM: accuracyM != null ? Number(accuracyM) : undefined,
      description,
      workLocation,
      clientCapturedAt,
      deviceInfo,
      syncBatchId,
    });

    res.status(201).json(day);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// ─── Employee: Check Out ──────────────────────────────────────────────────────

router.post('/check-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, accuracyM, description, workLocation, selfieBase64, clientCapturedAt, syncBatchId } = req.body;

    if (!description?.trim()) return res.status(400).json({ error: 'Check-out description is required' });

    const result = await svc.checkOut({
      userId: req.user!.userId,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      accuracyM: accuracyM != null ? Number(accuracyM) : undefined,
      description,
      workLocation,
      selfieBase64,
      clientCapturedAt,
      syncBatchId,
    });

    res.json(result);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// ─── Employee: Daily Log (full update + tomorrow plan) ───────────────────────

router.post('/daily-log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dailyUpdate, tomorrowPlan } = req.body;
    if (!dailyUpdate?.trim()) return res.status(400).json({ error: 'Daily update is required' });
    if (!tomorrowPlan?.trim()) return res.status(400).json({ error: "Tomorrow's plan is required" });
    const result = await svc.saveDailyLog({ userId: req.user!.userId, dailyUpdate, tomorrowPlan });
    res.json(result);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// ─── Employee: Today Status ───────────────────────────────────────────────────

router.get('/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await svc.getTodayStatus(req.user!.userId);
    res.json(status);
  } catch (err) { next(err); }
});

// ─── Employee: History ────────────────────────────────────────────────────────

router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const days = await svc.getHistory(req.user!.userId, from, to);
    res.json(days);
  } catch (err) { next(err); }
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get('/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifs = await svc.getNotifications(req.user!.userId);
    res.json(notifs);
  } catch (err) { next(err); }
});

router.post('/notifications/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.markNotificationsRead(req.user!.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Leave ───────────────────────────────────────────────────────────────────

router.post('/leave', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, type, reason, emergencyJustification } = req.body;
    if (!startDate || !endDate || !type || !reason?.trim()) {
      return res.status(400).json({ error: 'startDate, endDate, type, and reason are required' });
    }
    const leave = await svc.applyLeave({ userId: req.user!.userId, startDate, endDate, type, reason, emergencyJustification });
    res.status(201).json(leave);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.get('/leave', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leaves = await svc.getMyLeaves(req.user!.userId);
    res.json(leaves);
  } catch (err) { next(err); }
});

// ─── Comp Off ─────────────────────────────────────────────────────────────────

router.get('/comp-off', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await svc.getMyCompOffs(req.user!.userId);
    res.json(list);
  } catch (err) { next(err); }
});

// ─── Workflow Requests ────────────────────────────────────────────────────────

router.post('/workflow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, title, description, payload } = req.body;
    if (!type || !title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'type, title, and description are required' });
    }
    const result = await svc.createWorkflowRequest({ requesterId: req.user!.userId, type, title, description, payload });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.get('/workflow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await svc.getMyWorkflowRequests(req.user!.userId);
    res.json(list);
  } catch (err) { next(err); }
});

// ─── Policy (public read) ─────────────────────────────────────────────────────

router.get('/policy', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await svc.getPolicy2();
    res.json(policy);
  } catch (err) { next(err); }
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

router.get('/admin/daily', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const data = await svc.getAdminDailyView(date);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/admin/missed', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const data = await svc.getMissedAttendance(date);
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/admin/correct', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { attendanceDayId, field, newValue, reason } = req.body;
    if (!attendanceDayId || !field || newValue == null || !reason?.trim()) {
      return res.status(400).json({ error: 'attendanceDayId, field, newValue, and reason are required' });
    }
    const result = await svc.adminCorrect({ adminId: req.user!.userId, attendanceDayId, field, newValue, reason });
    res.json(result);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.get('/admin/history/:userId', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const days = await svc.getHistory(req.params.userId, from, to);
    res.json(days);
  } catch (err) { next(err); }
});

// Selfie serving (admin only)
router.get('/admin/selfie/:key', requireRoles(Role.ADMIN), (req: Request, res: Response) => {
  const p = svc.selfiePublicPath(req.params.key);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Selfie not found' });
  res.sendFile(p);
});

// Admin: policy update (global)
router.put('/admin/policy', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await svc.updatePolicy(req.body);
    res.json(policy);
  } catch (err) { next(err); }
});

// Admin: list all per-employee overrides
router.get('/admin/policy/employees', requireRoles(Role.ADMIN), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await svc.getAllEmployeePolicies());
  } catch (err) { next(err); }
});

// Admin: set/update per-employee override
router.put('/admin/policy/employee/:userId', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workStartTime, workEndTime, graceMinutes, lateAfterMinutes } = req.body;
    res.json(await svc.setEmployeePolicy(req.params.userId, { workStartTime, workEndTime, graceMinutes, lateAfterMinutes }));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Admin: delete per-employee override (revert to global)
router.delete('/admin/policy/employee/:userId', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deleteEmployeePolicy(req.params.userId);
    res.json({ success: true });
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Admin: all leaves
router.get('/admin/leave', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leaves = await svc.getAllLeaves({ status: req.query.status as string | undefined });
    res.json(leaves);
  } catch (err) { next(err); }
});

router.post('/admin/leave/:id/decide', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
    }
    const result = await svc.decideLeave({ leaveId: req.params.id, approverId: req.user!.userId, decision });
    res.json(result);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Admin: comp off
router.get('/admin/comp-off', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await svc.getAllCompOffs({ status: req.query.status as string | undefined });
    res.json(list);
  } catch (err) { next(err); }
});

router.post('/admin/comp-off/:id/decide', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
    }
    const result = await svc.decideCompOff({ compOffId: req.params.id, approverId: req.user!.userId, decision });
    res.json(result);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Admin: workflow
router.get('/admin/workflow', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await svc.getAllWorkflowRequests({ status: req.query.status as string | undefined });
    res.json(list);
  } catch (err) { next(err); }
});

router.post('/admin/workflow/:id/decide', requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision, comment, newStatus } = req.body;
    if (!['APPROVED', 'REJECTED', 'COMMENT'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }
    const result = await svc.decideWorkflow({ requestId: req.params.id, approverId: req.user!.userId, decision, comment, newStatus });
    res.json(result);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

export default router;
