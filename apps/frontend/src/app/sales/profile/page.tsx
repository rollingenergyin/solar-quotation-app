'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import RollingEnergyLogo from '@/components/quotation/RollingEnergyLogo';

interface Profile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  role: string;
  status: string;
  quotationsCount: number;
  createdAt: string;
}

export default function SalesProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', designation: '' });
  const [changePassword, setChangePassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  useEffect(() => {
    api<Profile>('/users/me/profile')
      .then((p) => {
        setProfile(p);
        setForm({ name: p.name, phone: p.phone || '', designation: p.designation || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await api(`/users/${profile.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: form.name, phone: form.phone || undefined, designation: form.designation || undefined }),
      });
      setProfile((p) => p ? { ...p, ...form } : null);
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert('New passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    try {
      await api('/users/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new }),
      });
      setChangePassword(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  if (loading || !profile) {
    return (
      <div className="p-8 text-center text-gray-500">Loading profile…</div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <RollingEnergyLogo variant="light" size="md" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">My Profile</h1>
          <p className="text-sm text-gray-500">View and update your account details</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Account Information</h2>
          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Designation</label>
                <input
                  type="text"
                  value={form.designation}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className="border px-4 py-2 rounded text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium">{profile.name}</dd>
                <dt className="text-gray-500">User ID</dt>
                <dd>{profile.userId}</dd>
                <dt className="text-gray-500">Email</dt>
                <dd>{profile.email}</dd>
                <dt className="text-gray-500">Phone</dt>
                <dd>{profile.phone || '—'}</dd>
                <dt className="text-gray-500">Designation</dt>
                <dd>{profile.designation || '—'}</dd>
                <dt className="text-gray-500">Total Quotations</dt>
                <dd>{profile.quotationsCount}</dd>
                <dt className="text-gray-500">Account Status</dt>
                <dd>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${profile.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {profile.status}
                  </span>
                </dd>
              </dl>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-4 text-sm text-yellow-600 hover:text-yellow-700 font-medium"
              >
                Update details
              </button>
            </>
          )}
        </div>

        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Change Password</h2>
          {changePassword ? (
            <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                  minLength={8}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm">
                  Change Password
                </button>
                <button type="button" onClick={() => setChangePassword(false)} className="border px-4 py-2 rounded text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setChangePassword(true)}
              className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
            >
              Change password
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
