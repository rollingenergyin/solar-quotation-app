'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import RollingEnergyLogo from '@/components/quotation/RollingEnergyLogo';

interface SalesUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  status: string;
  quotationsCount: number;
  createdAt: string;
}

export default function AdminSalesUsersPage() {
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SalesUser | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    userId: '',
    phone: '',
    password: '',
    designation: '',
  });
  const [resetPassword, setResetPassword] = useState<{ id: string; newPassword: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    return api<SalesUser[]>('/users')
      .then((data) => { setUsers(data); setLoadError(null); })
      .catch((err) => {
        setUsers([]);
        setLoadError(err instanceof Error ? err.message : 'Failed to load users');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e?.preventDefault?.();
    if (!form.name?.trim() || !form.email?.trim() || !form.userId?.trim() || !form.password) {
      alert('Name, Email, User ID, and Password are required');
      return;
    }
    if (form.password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        userId: form.userId.trim(),
        phone: form.phone?.trim() || undefined,
        password: form.password,
        designation: form.designation?.trim() || undefined,
      };
      await api('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setForm({ name: '', email: '', userId: '', phone: '', password: '', designation: '' });
      setSuccessMsg('Sales user created successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      alert(msg);
      console.error('[Create user]', err);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await api(`/users/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          userId: form.userId,
          phone: form.phone || undefined,
          designation: form.designation || undefined,
        }),
      });
      setEditing(null);
      setForm({ name: '', email: '', userId: '', phone: '', password: '', designation: '' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleToggleStatus = async (u: SalesUser) => {
    if (!confirm(`${u.status === 'ACTIVE' ? 'Disable' : 'Enable'} ${u.name}?`)) return;
    try {
      await api(`/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }),
      });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetting || !resetPassword?.newPassword) return;
    try {
      await api(`/users/${resetting}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPassword.newPassword }),
      });
      setResetting(null);
      setResetPassword(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  const openEdit = (u: SalesUser) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      userId: u.userId,
      phone: u.phone || '',
      password: '',
      designation: u.designation || '',
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-6">
        <RollingEnergyLogo variant="light" size="md" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Sales Users</h1>
          <p className="text-sm text-gray-500">Create, edit, and manage sales user accounts</p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg text-sm">
          {successMsg}
        </div>
      )}
      {loadError && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
          {loadError}
          <button type="button" onClick={() => load()} className="ml-2 underline font-medium">Retry</button>
        </div>
      )}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', email: '', userId: '', phone: '', password: '', designation: '' }); }}
          className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + New Sales User
        </button>
      </div>

      {(showForm || editing) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-md">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit User' : 'Create Sales User'}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) handleEdit(e);
              else handleCreate(e);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="user@example.com"
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">User ID *</label>
              <input
                type="text"
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                placeholder="e.g. sales01"
                className="w-full border rounded px-3 py-2 text-sm"
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            {!editing && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password * (min 8 characters)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Min 8 characters"
                />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={creating}
                onClick={() => {
                  if (editing) handleEdit({ preventDefault: () => {} } as React.FormEvent);
                  else handleCreate({ preventDefault: () => {} } as React.FormEvent);
                }}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium cursor-pointer hover:opacity-90"
              >
                {creating ? 'Creating…' : editing ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {resetting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold mb-4">Reset Password</h3>
            <form onSubmit={handleResetPassword}>
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={resetPassword?.newPassword ?? ''}
                onChange={(e) => setResetPassword({ id: resetting, newPassword: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm mb-4"
                minLength={8}
                required
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm">
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => { setResetting(null); setResetPassword(null); }}
                  className="border px-4 py-2 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quotations</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.userId}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">{u.quotationsCount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleToggleStatus(u)} className="text-amber-600 hover:text-amber-800 text-xs font-medium">
                        {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" onClick={() => { setResetting(u.id); setResetPassword({ id: u.id, newPassword: '' }); }} className="text-gray-600 hover:text-gray-800 text-xs font-medium">
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && users.length === 0 && (
          <div className="p-12 text-center text-gray-500">No sales users yet. Create one above.</div>
        )}
      </div>
    </div>
  );
}
