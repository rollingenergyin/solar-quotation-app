import { api } from './api';

export type AttendanceStatus = 'NONE' | 'IN_PROGRESS' | 'COMPLETE' | 'ABSENT' | 'ON_LEAVE' | 'HOLIDAY';
export type LeaveType = 'PLANNED' | 'EMERGENCY' | 'SICK' | 'CASUAL';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type CompOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'USED';
export type WorkflowType = 'PRICING' | 'DISCOUNT' | 'COMPLAINT' | 'OTHER';
export type WorkflowStatus = 'OPEN' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export interface AttendanceDay {
  id: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  isSunday: boolean;
  dailyUpdate?: string | null;
  tomorrowPlan?: string | null;
  createdAt: string;
  updatedAt: string;
  checkIn?: CheckIn;
  checkOut?: CheckOut;
}

export interface CheckIn {
  id: string;
  capturedAt: string;
  selfieKey: string;
  lat?: number | null;
  lng?: number | null;
  description: string;
  workLocation?: string | null;
}

export interface CheckOut {
  id: string;
  capturedAt: string;
  lat?: number | null;
  lng?: number | null;
  description: string;
  workLocation?: string | null;
  fullDayUpdate?: string | null;
  nextDayPlan?: string | null;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  reason: string;
  status: LeaveStatus;
  emergencyJustification?: string;
  createdAt: string;
  user?: { id: string; name: string; designation?: string };
}

export interface CompOffRequest {
  id: string;
  userId: string;
  workDate: string;
  status: CompOffStatus;
  note?: string;
  createdAt: string;
  user?: { id: string; name: string; designation?: string };
}

export interface WorkflowRequest {
  id: string;
  type: WorkflowType;
  requesterId: string;
  title: string;
  description: string;
  status: WorkflowStatus;
  createdAt: string;
  requester?: { id: string; name: string; designation?: string };
  approvals?: WorkflowApproval[];
}

export interface WorkflowApproval {
  id: string;
  decision: string;
  comment?: string;
  decidedAt: string;
  approver: { id: string; name: string };
}

export interface AttendanceNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
}

export interface AttendancePolicy {
  id: string;
  userId?: string | null;
  workStartTime: string;
  workEndTime: string;
  graceMinutes: number;
  lateAfterMinutes: number;
  sundayCompOffAuto: boolean;
}

export interface EmployeePolicyEntry extends AttendancePolicy {
  user: { id: string; name: string; designation?: string; role: string };
}

export interface AdminDailyEntry {
  userId: string;
  name: string;
  designation?: string;
  role: string;
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  checkInAt?: string;
  checkOutAt?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  fullDayUpdate?: string;
  nextDayPlan?: string;
  selfieKey?: string;
  description?: string;
  dayId?: string;
}

// ─── Employee APIs ────────────────────────────────────────────────────────────

export const attendanceApi = {
  checkIn: (data: {
    selfieBase64: string;
    lat: number | null;
    lng: number | null;
    accuracyM?: number;
    description: string;
    workLocation?: string;
    deviceInfo?: string;
    clientCapturedAt?: string;
    syncBatchId?: string;
  }) => api<AttendanceDay>('/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),

  checkOut: (data: {
    lat: number | null;
    lng: number | null;
    accuracyM?: number;
    description: string;
    workLocation?: string;
    selfieBase64?: string;
    clientCapturedAt?: string;
    syncBatchId?: string;
  }) => api<{ success: boolean }>('/attendance/check-out', { method: 'POST', body: JSON.stringify(data) }),

  saveDailyLog: (data: { dailyUpdate: string; tomorrowPlan: string }) =>
    api<AttendanceDay>('/attendance/daily-log', { method: 'POST', body: JSON.stringify(data) }),

  getToday: () => api<{ date: string; day: AttendanceDay | null }>('/attendance/today'),

  getHistory: (from?: string, to?: string) =>
    api<AttendanceDay[]>(`/attendance/history${from ? `?from=${from}` : ''}${to ? `&to=${to}` : ''}`),

  getPolicy: () => api<AttendancePolicy>('/attendance/policy'),

  getNotifications: () => api<AttendanceNotification[]>('/attendance/notifications'),
  markNotificationsRead: () => api<{ success: boolean }>('/attendance/notifications/read', { method: 'POST' }),

  // Leave
  applyLeave: (data: { startDate: string; endDate: string; type: LeaveType; reason: string; emergencyJustification?: string }) =>
    api<LeaveRequest>('/attendance/leave', { method: 'POST', body: JSON.stringify(data) }),
  getMyLeaves: () => api<LeaveRequest[]>('/attendance/leave'),

  // Comp Off
  getMyCompOffs: () => api<CompOffRequest[]>('/attendance/comp-off'),

  // Workflow
  createWorkflow: (data: { type: WorkflowType; title: string; description: string; payload?: object }) =>
    api<WorkflowRequest>('/attendance/workflow', { method: 'POST', body: JSON.stringify(data) }),
  getMyWorkflows: () => api<WorkflowRequest[]>('/attendance/workflow'),
};

// ─── Admin APIs ───────────────────────────────────────────────────────────────

export const attendanceAdminApi = {
  getDailyView: (date: string) => api<AdminDailyEntry[]>(`/attendance/admin/daily?date=${date}`),

  getMissed: (date: string) =>
    api<{ userId: string; name: string; designation?: string; date: string }[]>(`/attendance/admin/missed?date=${date}`),

  getUserHistory: (userId: string, from?: string, to?: string) =>
    api<AttendanceDay[]>(`/attendance/admin/history/${userId}${from ? `?from=${from}` : ''}${to ? `&to=${to}` : ''}`),

  correct: (data: { attendanceDayId: string; field: string; newValue: string; reason: string }) =>
    api<{ success: boolean }>('/attendance/admin/correct', { method: 'POST', body: JSON.stringify(data) }),

  getPolicy: () => api<AttendancePolicy>('/attendance/policy'),
  updatePolicy: (data: Partial<AttendancePolicy>) =>
    api<AttendancePolicy>('/attendance/admin/policy', { method: 'PUT', body: JSON.stringify(data) }),

  getEmployeePolicies: () => api<EmployeePolicyEntry[]>('/attendance/admin/policy/employees'),
  setEmployeePolicy: (userId: string, data: Partial<Pick<AttendancePolicy, 'workStartTime' | 'workEndTime' | 'graceMinutes' | 'lateAfterMinutes'>>) =>
    api<EmployeePolicyEntry>(`/attendance/admin/policy/employee/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployeePolicy: (userId: string) =>
    api<{ success: boolean }>(`/attendance/admin/policy/employee/${userId}`, { method: 'DELETE' }),

  getAllLeaves: (status?: string) =>
    api<LeaveRequest[]>(`/attendance/admin/leave${status ? `?status=${status}` : ''}`),
  decideLeave: (id: string, decision: 'APPROVED' | 'REJECTED') =>
    api<LeaveRequest>(`/attendance/admin/leave/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision }) }),

  getAllCompOffs: (status?: string) =>
    api<CompOffRequest[]>(`/attendance/admin/comp-off${status ? `?status=${status}` : ''}`),
  decideCompOff: (id: string, decision: 'APPROVED' | 'REJECTED') =>
    api<CompOffRequest>(`/attendance/admin/comp-off/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision }) }),

  getAllWorkflows: (status?: string) =>
    api<WorkflowRequest[]>(`/attendance/admin/workflow${status ? `?status=${status}` : ''}`),
  decideWorkflow: (id: string, decision: 'APPROVED' | 'REJECTED' | 'COMMENT', comment?: string) =>
    api<{ success: boolean }>(`/attendance/admin/workflow/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision, comment }) }),

  selfieUrl: (key: string) => `/api/attendance/admin/selfie/${key}`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function statusColor(status: AttendanceStatus): string {
  switch (status) {
    case 'COMPLETE': return 'text-green-600 bg-green-50';
    case 'IN_PROGRESS': return 'text-blue-600 bg-blue-50';
    case 'ABSENT': return 'text-red-600 bg-red-50';
    case 'ON_LEAVE': return 'text-purple-600 bg-purple-50';
    case 'HOLIDAY': return 'text-yellow-600 bg-yellow-50';
    default: return 'text-gray-500 bg-gray-50';
  }
}

export function statusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'COMPLETE': return 'Present';
    case 'IN_PROGRESS': return 'Checked In';
    case 'ABSENT': return 'Absent';
    case 'ON_LEAVE': return 'On Leave';
    case 'HOLIDAY': return 'Holiday';
    default: return 'Not Marked';
  }
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
