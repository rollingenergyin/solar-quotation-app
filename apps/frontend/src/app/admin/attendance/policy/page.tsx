'use client';

import { useState, useEffect, useCallback } from 'react';
import { attendanceAdminApi, type AttendancePolicy, type EmployeePolicyEntry } from '@/lib/attendance-api';
import { api } from '@/lib/api';

interface UserOption { id: string; name: string; designation?: string; role: string; }

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-yellow-500' : 'bg-gray-300'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}

// ─── Time fields ─────────────────────────────────────────────────────────────

function PolicyTimeFields({
  values,
  onChange,
  showSundayToggle,
}: {
  values: Pick<AttendancePolicy, 'workStartTime' | 'workEndTime' | 'graceMinutes' | 'lateAfterMinutes'> & { sundayCompOffAuto?: boolean };
  onChange: (patch: Partial<typeof values>) => void;
  showSundayToggle?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Start Time</label>
          <input type="time" value={values.workStartTime}
            onChange={(e) => onChange({ workStartTime: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">End Time</label>
          <input type="time" value={values.workEndTime}
            onChange={(e) => onChange({ workEndTime: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Grace Period (min)</label>
          <input type="number" min={0} max={60} value={values.graceMinutes}
            onChange={(e) => onChange({ graceMinutes: Number(e.target.value) })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          <p className="text-xs text-gray-400 mt-1">Arrival within this = not late</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Late After (min)</label>
          <input type="number" min={0} max={120} value={values.lateAfterMinutes}
            onChange={(e) => onChange({ lateAfterMinutes: Number(e.target.value) })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          <p className="text-xs text-gray-400 mt-1">Shown in late alert</p>
        </div>
      </div>
      {showSundayToggle && (
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
          <div>
            <div className="text-sm font-medium text-gray-900">Auto Comp Off for Sunday Work</div>
            <div className="text-xs text-gray-500">Raise a Comp Off request when someone works on Sunday.</div>
          </div>
          <Toggle checked={!!values.sundayCompOffAuto} onChange={(v) => onChange({ sundayCompOffAuto: v })} />
        </div>
      )}
    </div>
  );
}

// ─── Employee Override Modal ──────────────────────────────────────────────────

function EmployeeOverrideModal({
  users,
  existing,
  globalPolicy,
  onClose,
  onSaved,
}: {
  users: UserOption[];
  existing: EmployeePolicyEntry | null;
  globalPolicy: AttendancePolicy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState(existing?.user.id ?? '');
  const [values, setValues] = useState({
    workStartTime: existing?.workStartTime ?? globalPolicy.workStartTime,
    workEndTime: existing?.workEndTime ?? globalPolicy.workEndTime,
    graceMinutes: existing?.graceMinutes ?? globalPolicy.graceMinutes,
    lateAfterMinutes: existing?.lateAfterMinutes ?? globalPolicy.lateAfterMinutes,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!selectedUserId) return setError('Please select an employee');
    setSaving(true);
    setError('');
    try {
      await attendanceAdminApi.setEmployeePolicy(selectedUserId, values);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{existing ? 'Edit Employee Override' : 'Add Employee Override'}</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Employee <span className="text-red-500">*</span></label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={!!existing}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">Select employee…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}{u.designation ? ` — ${u.designation}` : ''}
              </option>
            ))}
          </select>
        </div>

        <PolicyTimeFields
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        />

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-gray-900 font-semibold rounded-xl py-2.5 text-sm">
            {saving ? 'Saving…' : 'Save Override'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPolicyPage() {
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [empPolicies, setEmpPolicies] = useState<EmployeePolicyEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'add' | EmployeePolicyEntry | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, ep, us] = await Promise.all([
        attendanceAdminApi.getPolicy(),
        attendanceAdminApi.getEmployeePolicies(),
        api<UserOption[]>('/users'),
      ]);
      setPolicy(p);
      setEmpPolicies(ep);
      // Exclude users that already have overrides when adding new
      setUsers(us.filter((u: UserOption) => u.role !== 'ADMIN' || true));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveGlobal = async () => {
    if (!policy) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await attendanceAdminApi.updatePolicy({
        workStartTime: policy.workStartTime,
        workEndTime: policy.workEndTime,
        graceMinutes: policy.graceMinutes,
        lateAfterMinutes: policy.lateAfterMinutes,
        sundayCompOffAuto: policy.sundayCompOffAuto,
      });
      setPolicy(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (userId: string) => {
    if (!confirm('Remove this employee\'s custom time override? They will revert to the global policy.')) return;
    try {
      await attendanceAdminApi.deleteEmployeePolicy(userId);
      await loadAll();
    } catch (e: any) {
      alert(e.message || 'Failed to remove');
    }
  };

  if (loading) return <div className="text-center text-gray-500 py-12">Loading policy…</div>;
  if (!policy) return <div className="text-center text-gray-400 py-12">No policy found.</div>;

  // Users without an override (for the "add" dropdown)
  const overriddenIds = new Set(empPolicies.map((e) => e.user.id));
  const usersWithoutOverride = users.filter((u) => !overriddenIds.has(u.id));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Attendance Policy</h1>

      {/* ── Global Policy ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🌐</span>
          <div>
            <div className="font-semibold text-gray-900 text-sm">Global Policy</div>
            <div className="text-xs text-gray-500">Applies to all employees without an individual override</div>
          </div>
        </div>

        <PolicyTimeFields
          values={policy}
          onChange={(patch) => setPolicy((p) => p ? { ...p, ...patch } : p)}
          showSundayToggle
        />

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
        {saved && <p className="text-sm text-green-600 bg-green-50 rounded-lg p-3">Global policy saved!</p>}

        <button onClick={saveGlobal} disabled={saving}
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-gray-900 font-semibold rounded-xl py-3 text-sm transition-colors">
          {saving ? 'Saving…' : 'Save Global Policy'}
        </button>
      </div>

      {/* ── Per-Employee Overrides ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <span>👤</span> Employee Time Overrides
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Set custom working hours for individual employees</div>
          </div>
          <button
            onClick={() => setModal('add')}
            disabled={usersWithoutOverride.length === 0}
            className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-200 disabled:text-gray-400 text-gray-900 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            + Add Override
          </button>
        </div>

        {empPolicies.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No employee overrides yet. Click &quot;+ Add Override&quot; to set custom hours for an employee.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {empPolicies.map((ep) => (
              <div key={ep.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{ep.user.name}</div>
                  {ep.user.designation && <div className="text-xs text-gray-400">{ep.user.designation}</div>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    <span>🕐 {ep.workStartTime} – {ep.workEndTime}</span>
                    <span>⏱ Grace {ep.graceMinutes}min</span>
                    <span>🔔 Late after {ep.lateAfterMinutes}min</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setModal(ep)}
                    className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2.5 py-1.5"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeOverride(ep.user.id)}
                    className="text-xs text-red-600 hover:text-red-800 border border-red-200 rounded-lg px-2.5 py-1.5"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Policy notes */}
      <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-800">
        <div className="font-semibold mb-1">How it works</div>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>Employee overrides take priority over the global policy.</li>
          <li>Check-in is late if arrival exceeds Start Time + Grace Period.</li>
          <li>Only admin can correct attendance records.</li>
          <li>Sunday work auto-raises a Comp Off request (global setting).</li>
        </ul>
      </div>

      {/* Modal */}
      {modal && (
        <EmployeeOverrideModal
          users={modal === 'add' ? usersWithoutOverride : users}
          existing={modal === 'add' ? null : modal}
          globalPolicy={policy}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await loadAll(); }}
        />
      )}
    </div>
  );
}
