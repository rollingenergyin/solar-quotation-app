/**
 * Offline attendance sync – stores pending check-in/check-out actions in
 * localStorage and replays them when the device comes back online.
 */

import { attendanceApi } from './attendance-api';

const KEY_QUEUE = 'attendance_offline_queue';

export type OfflineAction =
  | { type: 'CHECK_IN'; payload: Parameters<typeof attendanceApi.checkIn>[0]; queuedAt: string }
  | { type: 'CHECK_OUT'; payload: Parameters<typeof attendanceApi.checkOut>[0]; queuedAt: string };

function readQueue(): OfflineAction[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_QUEUE) ?? '[]');
  } catch {
    return [];
  }
}

function saveQueue(q: OfflineAction[]) {
  localStorage.setItem(KEY_QUEUE, JSON.stringify(q));
}

export function queueOfflineAction(action: Omit<OfflineAction, 'queuedAt'>) {
  const q = readQueue();
  q.push({ ...action, queuedAt: new Date().toISOString() } as OfflineAction);
  saveQueue(q);
}

export function getPendingCount(): number {
  return readQueue().length;
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const q = readQueue();
  if (q.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: OfflineAction[] = [];

  for (const action of q) {
    try {
      if (action.type === 'CHECK_IN') {
        await attendanceApi.checkIn({ ...action.payload, syncBatchId: action.queuedAt });
      } else if (action.type === 'CHECK_OUT') {
        await attendanceApi.checkOut({ ...action.payload, syncBatchId: action.queuedAt });
      }
      synced++;
    } catch (err: any) {
      // If it's a 409 (already done), treat as synced
      if (err?.status === 409 || err?.message?.includes('Already checked')) {
        synced++;
      } else {
        failed++;
        remaining.push(action);
      }
    }
  }

  saveQueue(remaining);
  return { synced, failed };
}

/** Register an online listener to auto-sync when connectivity resumes */
export function registerOnlineSync(onSynced?: (result: { synced: number; failed: number }) => void) {
  if (typeof window === 'undefined') return;

  const handler = async () => {
    const result = await syncOfflineQueue();
    if (result.synced > 0 || result.failed > 0) {
      onSynced?.(result);
    }
  };

  window.addEventListener('online', handler);
  // Also try to sync immediately if already online
  if (navigator.onLine) handler();

  return () => window.removeEventListener('online', handler);
}
