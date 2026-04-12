import { PrismaClient, AttendanceStatus, LeaveStatus, CompOffStatus, WorkflowStatus } from '@prisma/client';

const prisma = new PrismaClient();
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ─── Directory setup ──────────────────────────────────────────────────────────

const SELFIE_DIR = path.resolve('uploads/selfies');
if (!fs.existsSync(SELFIE_DIR)) fs.mkdirSync(SELFIE_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function todayLocalISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function localISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isSunday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 0;
}

async function getPolicy(userId?: string) {
  // Per-employee override takes priority
  if (userId) {
    const userPolicy = await prisma.attendancePolicy.findUnique({ where: { userId } });
    if (userPolicy) return userPolicy;
  }
  // Fall back to global policy (userId = null)
  let policy = await prisma.attendancePolicy.findFirst({ where: { userId: null }, orderBy: { effectiveFrom: 'desc' } });
  if (!policy) {
    policy = await prisma.attendancePolicy.create({ data: {} });
  }
  return policy;
}

// ─── Employee Policy Overrides ────────────────────────────────────────────────

export async function getAllEmployeePolicies() {
  return prisma.attendancePolicy.findMany({
    where: { userId: { not: null } },
    include: { user: { select: { id: true, name: true, designation: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function setEmployeePolicy(userId: string, data: {
  workStartTime?: string;
  workEndTime?: string;
  graceMinutes?: number;
  lateAfterMinutes?: number;
}) {
  return prisma.attendancePolicy.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    include: { user: { select: { id: true, name: true, designation: true } } },
  });
}

export async function deleteEmployeePolicy(userId: string) {
  const existing = await prisma.attendancePolicy.findUnique({ where: { userId } });
  if (!existing) throw Object.assign(new Error('No override found for this employee'), { statusCode: 404 });
  return prisma.attendancePolicy.delete({ where: { userId } });
}

function saveSelfie(base64Data: string, userId: string, type: 'in' | 'out'): { key: string; hash: string } {
  const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const key = `${userId}_${type}_${Date.now()}_${hash.slice(0, 8)}.jpg`;
  fs.writeFileSync(path.join(SELFIE_DIR, key), buffer);
  return { key, hash };
}

// ─── Check In ────────────────────────────────────────────────────────────────

export async function checkIn(params: {
  userId: string;
  selfieBase64: string;
  lat: number | null;
  lng: number | null;
  accuracyM?: number;
  description: string;
  workLocation?: string;
  clientCapturedAt?: string;
  deviceInfo?: string;
  syncBatchId?: string;
}) {
  const date = todayLocalISO();
  const policy = await getPolicy(params.userId);

  // Prevent double check-in
  const existing = await prisma.attendanceDay.findUnique({
    where: { userId_date: { userId: params.userId, date } },
    include: { checkIn: true },
  });

  if (existing?.checkIn) {
    throw Object.assign(new Error('Already checked in today'), { statusCode: 409 });
  }

  // Late check
  const [sh, sm] = policy.workStartTime.split(':').map(Number);
  const now = new Date();
  const startMinutes = sh * 60 + sm;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMins = nowMinutes - startMinutes;
  const isLate = diffMins > policy.graceMinutes;
  const lateMinutes = isLate ? Math.max(0, diffMins - policy.graceMinutes) : 0;

  const { key, hash } = saveSelfie(params.selfieBase64, params.userId, 'in');

  const sunday = isSunday(date);

  const day = await prisma.attendanceDay.upsert({
    where: { userId_date: { userId: params.userId, date } },
    create: {
      userId: params.userId,
      date,
      status: AttendanceStatus.IN_PROGRESS,
      isLate,
      lateMinutes,
      isSunday: sunday,
      checkIn: {
        create: {
          capturedAt: now,
          clientCapturedAt: params.clientCapturedAt ? new Date(params.clientCapturedAt) : null,
          selfieKey: key,
          selfieHash: hash,
          lat: params.lat,
          lng: params.lng,
          accuracyM: params.accuracyM,
          description: params.description,
          workLocation: params.workLocation ?? null,
          deviceInfo: params.deviceInfo,
          syncBatchId: params.syncBatchId,
        },
      },
    },
    update: {
      status: AttendanceStatus.IN_PROGRESS,
      isLate,
      lateMinutes,
      isSunday: sunday,
      checkIn: {
        create: {
          capturedAt: now,
          clientCapturedAt: params.clientCapturedAt ? new Date(params.clientCapturedAt) : null,
          selfieKey: key,
          selfieHash: hash,
          lat: params.lat,
          lng: params.lng,
          accuracyM: params.accuracyM,
          description: params.description,
          workLocation: params.workLocation ?? null,
          deviceInfo: params.deviceInfo,
          syncBatchId: params.syncBatchId,
        },
      },
    },
    include: { checkIn: true },
  });

  // Late notification
  if (isLate) {
    await createNotification(params.userId, 'LATE', 'Late Check-In', `You checked in ${lateMinutes} minutes late today.`);
  }

  return day;
}

// ─── Check Out ───────────────────────────────────────────────────────────────

export async function checkOut(params: {
  userId: string;
  lat: number | null;
  lng: number | null;
  accuracyM?: number;
  description: string;
  workLocation?: string;
  selfieBase64?: string;
  clientCapturedAt?: string;
  syncBatchId?: string;
}) {
  const date = todayLocalISO();

  const day = await prisma.attendanceDay.findUnique({
    where: { userId_date: { userId: params.userId, date } },
    include: { checkIn: true, checkOut: true },
  });

  if (!day?.checkIn) throw Object.assign(new Error('No check-in found for today'), { statusCode: 400 });
  if (day.checkOut) throw Object.assign(new Error('Already checked out today'), { statusCode: 409 });

  let selfieKey: string | undefined;
  if (params.selfieBase64) {
    const { key } = saveSelfie(params.selfieBase64, params.userId, 'out');
    selfieKey = key;
  }

  const now = new Date();
  const policy = await getPolicy(params.userId);

  await prisma.$transaction([
    prisma.attendanceCheckOut.create({
      data: {
        attendanceDayId: day.id,
        capturedAt: now,
        clientCapturedAt: params.clientCapturedAt ? new Date(params.clientCapturedAt) : null,
        selfieKey: selfieKey ?? null,
        lat: params.lat,
        lng: params.lng,
        accuracyM: params.accuracyM,
        description: params.description,
        workLocation: params.workLocation ?? null,
        syncBatchId: params.syncBatchId,
      },
    }),
    prisma.attendanceDay.update({
      where: { id: day.id },
      data: { status: AttendanceStatus.COMPLETE },
    }),
  ]);

  // Auto comp-off for Sunday
  if (day.isSunday && policy.sundayCompOffAuto) {
    const existing = await prisma.compOffRequest.findUnique({ where: { attendanceDayId: day.id } });
    if (!existing) {
      await prisma.compOffRequest.create({
        data: {
          userId: params.userId,
          workDate: date,
          attendanceDayId: day.id,
          status: CompOffStatus.PENDING,
          note: 'Auto-generated: worked on Sunday',
        },
      });
      await createNotification(params.userId, 'COMPOFF_DECIDED', 'Comp Off Requested', 'You worked on Sunday – a Comp Off request has been raised for admin approval.');
    }
  }

  return { success: true };
}

// ─── Daily Log (full update + tomorrow plan — fillable any time same day) ────

export async function saveDailyLog(params: {
  userId: string;
  dailyUpdate: string;
  tomorrowPlan: string;
}) {
  const date = todayLocalISO();
  const day = await prisma.attendanceDay.findUnique({
    where: { userId_date: { userId: params.userId, date } },
  });
  if (!day) throw Object.assign(new Error('No attendance record for today'), { statusCode: 400 });

  return prisma.attendanceDay.update({
    where: { id: day.id },
    data: { dailyUpdate: params.dailyUpdate, tomorrowPlan: params.tomorrowPlan },
  });
}

// ─── Today's Status ──────────────────────────────────────────────────────────

export async function getTodayStatus(userId: string) {
  const date = todayLocalISO();
  const day = await prisma.attendanceDay.findUnique({
    where: { userId_date: { userId, date } },
    include: { checkIn: true, checkOut: true },
  });
  return { date, day };
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function getHistory(userId: string, from: string, to: string) {
  const days = await prisma.attendanceDay.findMany({
    where: { userId, date: { gte: from, lte: to } },
    include: { checkIn: true, checkOut: true },
    orderBy: { date: 'desc' },
  });
  return days;
}

// ─── Admin: All Users Today ───────────────────────────────────────────────────

export async function getAdminDailyView(date: string) {
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' } });
  const days = await prisma.attendanceDay.findMany({
    where: { date },
    include: { checkIn: true, checkOut: true, user: { select: { id: true, name: true, designation: true, role: true } } },
  });

  type DayWithIncludes = (typeof days)[number];
  const dayMap = new Map<string, DayWithIncludes>(days.map((d) => [d.userId, d]));

  return users.map((u) => {
    const d = dayMap.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      designation: u.designation,
      role: u.role,
      status: d?.status ?? AttendanceStatus.NONE,
      isLate: d?.isLate ?? false,
      lateMinutes: d?.lateMinutes ?? 0,
      checkInAt: d?.checkIn?.capturedAt ?? null,
      checkOutAt: d?.checkOut?.capturedAt ?? null,
      checkInLat: d?.checkIn?.lat ?? null,
      checkInLng: d?.checkIn?.lng ?? null,
      checkOutLat: d?.checkOut?.lat ?? null,
      checkOutLng: d?.checkOut?.lng ?? null,
      fullDayUpdate: d?.checkOut?.fullDayUpdate ?? null,
      nextDayPlan: d?.checkOut?.nextDayPlan ?? null,
      selfieKey: d?.checkIn?.selfieKey ?? null,
      description: d?.checkIn?.description ?? null,
      dayId: d?.id ?? null,
    };
  });
}

// ─── Admin: Missed Attendance ────────────────────────────────────────────────

export async function getMissedAttendance(date: string) {
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' } });
  const days = await prisma.attendanceDay.findMany({
    where: { date },
    select: { userId: true, status: true },
  });
  const presentSet = new Set(days.filter((d: { userId: string; status: AttendanceStatus }) => d.status !== AttendanceStatus.NONE).map((d: { userId: string; status: AttendanceStatus }) => d.userId));

  return users
    .filter((u) => !presentSet.has(u.id))
    .map((u) => ({ userId: u.id, name: u.name, designation: u.designation, date }));
}

// ─── Admin: Correction ───────────────────────────────────────────────────────

export async function adminCorrect(params: {
  adminId: string;
  attendanceDayId: string;
  field: string;
  newValue: string;
  reason: string;
}) {
  const day = await prisma.attendanceDay.findUnique({
    where: { id: params.attendanceDayId },
    include: { checkIn: true, checkOut: true },
  });
  if (!day) throw Object.assign(new Error('Day not found'), { statusCode: 404 });

  const oldValue = (() => {
    switch (params.field) {
      case 'status': return day.status;
      case 'isLate': return String(day.isLate);
      case 'checkIn.description': return day.checkIn?.description ?? '';
      case 'checkOut.fullDayUpdate': return day.checkOut?.fullDayUpdate ?? '';
      case 'checkOut.nextDayPlan': return day.checkOut?.nextDayPlan ?? '';
      default: return '';
    }
  })();

  const updates: Promise<unknown>[] = [
    prisma.attendanceCorrection.create({
      data: {
        attendanceDayId: params.attendanceDayId,
        adminId: params.adminId,
        fieldChanged: params.field,
        oldValue: String(oldValue),
        newValue: params.newValue,
        reason: params.reason,
      },
    }),
  ];

  switch (params.field) {
    case 'status':
      updates.push(prisma.attendanceDay.update({ where: { id: day.id }, data: { status: params.newValue as AttendanceStatus } }));
      break;
    case 'isLate':
      updates.push(prisma.attendanceDay.update({ where: { id: day.id }, data: { isLate: params.newValue === 'true' } }));
      break;
    case 'checkIn.description':
      if (day.checkIn) updates.push(prisma.attendanceCheckIn.update({ where: { id: day.checkIn.id }, data: { description: params.newValue } }));
      break;
    case 'checkOut.fullDayUpdate':
      if (day.checkOut) updates.push(prisma.attendanceCheckOut.update({ where: { id: day.checkOut.id }, data: { fullDayUpdate: params.newValue } }));
      break;
    case 'checkOut.nextDayPlan':
      if (day.checkOut) updates.push(prisma.attendanceCheckOut.update({ where: { id: day.checkOut.id }, data: { nextDayPlan: params.newValue } }));
      break;
  }

  await Promise.all(updates);

  // Notify employee
  await createNotification(day.userId, 'MISSING', 'Attendance Corrected', `Admin corrected your attendance record for ${day.date}.`);

  return { success: true };
}

// ─── Policy CRUD ─────────────────────────────────────────────────────────────

export async function getPolicy2() {
  return getPolicy();
}

export async function updatePolicy(data: {
  workStartTime?: string;
  workEndTime?: string;
  graceMinutes?: number;
  lateAfterMinutes?: number;
  sundayCompOffAuto?: boolean;
}) {
  const existing = await prisma.attendancePolicy.findFirst({ where: { userId: null }, orderBy: { effectiveFrom: 'desc' } });
  if (existing) {
    return prisma.attendancePolicy.update({ where: { id: existing.id }, data });
  }
  return prisma.attendancePolicy.create({ data: { ...data } });
}

// ─── Leave System ─────────────────────────────────────────────────────────────

export async function applyLeave(params: {
  userId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  emergencyJustification?: string;
}) {
  const today = todayLocalISO();
  const msPerDay = 86400000;
  const advanceDays = (new Date(params.startDate).getTime() - new Date(today).getTime()) / msPerDay;

  const isEmergency = params.type === 'EMERGENCY';
  if (!isEmergency && advanceDays < 2) {
    throw Object.assign(new Error('Leave must be applied at least 2 days in advance'), { statusCode: 400 });
  }
  if (isEmergency && advanceDays < 0) {
    throw Object.assign(new Error('Emergency leave can only be applied for today or future dates'), { statusCode: 400 });
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      userId: params.userId,
      startDate: params.startDate,
      endDate: params.endDate,
      type: params.type as any,
      reason: params.reason,
      emergencyJustification: params.emergencyJustification,
      advanceDaysSatisfied: advanceDays >= 2,
    },
  });

  // Notify admins
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' } });
  await Promise.all(
    admins.map((a: { id: string }) =>
      createNotification(a.id, 'LEAVE_DECIDED', 'New Leave Request', `Employee has applied for leave from ${params.startDate} to ${params.endDate}.`)
    )
  );

  return leave;
}

export async function getMyLeaves(userId: string) {
  return prisma.leaveRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllLeaves(filter?: { status?: string }) {
  return prisma.leaveRequest.findMany({
    where: filter?.status ? { status: filter.status as LeaveStatus } : undefined,
    include: { user: { select: { id: true, name: true, designation: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function decideLeave(params: { leaveId: string; approverId: string; decision: 'APPROVED' | 'REJECTED' }) {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: params.leaveId } });
  if (!leave) throw Object.assign(new Error('Leave not found'), { statusCode: 404 });

  const updated = await prisma.leaveRequest.update({
    where: { id: params.leaveId },
    data: {
      status: params.decision === 'APPROVED' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED,
      approverId: params.approverId,
      decidedAt: new Date(),
    },
  });

  await createNotification(
    leave.userId,
    'LEAVE_DECIDED',
    `Leave ${params.decision}`,
    `Your leave request (${leave.startDate} – ${leave.endDate}) has been ${params.decision.toLowerCase()}.`
  );

  return updated;
}

// ─── Comp Off ────────────────────────────────────────────────────────────────

export async function getMyCompOffs(userId: string) {
  return prisma.compOffRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllCompOffs(filter?: { status?: string }) {
  return prisma.compOffRequest.findMany({
    where: filter?.status ? { status: filter.status as CompOffStatus } : undefined,
    include: { user: { select: { id: true, name: true, designation: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function decideCompOff(params: { compOffId: string; approverId: string; decision: 'APPROVED' | 'REJECTED' }) {
  const req = await prisma.compOffRequest.findUnique({ where: { id: params.compOffId } });
  if (!req) throw Object.assign(new Error('Comp off not found'), { statusCode: 404 });

  const updated = await prisma.compOffRequest.update({
    where: { id: params.compOffId },
    data: {
      status: params.decision === 'APPROVED' ? CompOffStatus.APPROVED : CompOffStatus.REJECTED,
      approverId: params.approverId,
      decidedAt: new Date(),
    },
  });

  await createNotification(
    req.userId,
    'COMPOFF_DECIDED',
    `Comp Off ${params.decision}`,
    `Your comp off request for ${req.workDate} has been ${params.decision.toLowerCase()}.`
  );

  return updated;
}

// ─── Workflow Requests ────────────────────────────────────────────────────────

export async function createWorkflowRequest(params: {
  requesterId: string;
  type: string;
  title: string;
  description: string;
  payload?: object;
}) {
  return prisma.workflowRequest.create({
    data: {
      requesterId: params.requesterId,
      type: params.type as any,
      title: params.title,
      description: params.description,
      payload: params.payload ?? {},
    },
  });
}

export async function getMyWorkflowRequests(userId: string) {
  return prisma.workflowRequest.findMany({
    where: { requesterId: userId },
    include: { approvals: { include: { approver: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllWorkflowRequests(filter?: { status?: string }) {
  return prisma.workflowRequest.findMany({
    where: filter?.status ? { status: filter.status as WorkflowStatus } : undefined,
    include: {
      requester: { select: { id: true, name: true, designation: true } },
      approvals: { include: { approver: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function decideWorkflow(params: {
  requestId: string;
  approverId: string;
  decision: 'APPROVED' | 'REJECTED' | 'COMMENT';
  comment?: string;
  newStatus?: string;
}) {
  const req = await prisma.workflowRequest.findUnique({ where: { id: params.requestId } });
  if (!req) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

  const newStatus =
    params.newStatus ??
    (params.decision === 'APPROVED' ? WorkflowStatus.APPROVED : params.decision === 'REJECTED' ? WorkflowStatus.REJECTED : WorkflowStatus.IN_REVIEW);

  await prisma.$transaction([
    prisma.workflowApproval.create({
      data: {
        requestId: params.requestId,
        approverId: params.approverId,
        decision: params.decision,
        comment: params.comment,
      },
    }),
    prisma.workflowRequest.update({
      where: { id: params.requestId },
      data: { status: newStatus as WorkflowStatus },
    }),
  ]);

  await createNotification(
    req.requesterId,
    'WORKFLOW_UPDATE',
    `Request ${params.decision}`,
    `Your request "${req.title}" has been updated: ${params.decision}.`
  );

  return { success: true };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(userId: string, type: string, title: string, message: string) {
  return prisma.attendanceNotification.create({ data: { userId, type, title, message } });
}

export async function getNotifications(userId: string) {
  return prisma.attendanceNotification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markNotificationsRead(userId: string) {
  return prisma.attendanceNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

// ─── Selfie URL ───────────────────────────────────────────────────────────────

export function selfiePublicPath(key: string) {
  return path.join(SELFIE_DIR, key);
}
