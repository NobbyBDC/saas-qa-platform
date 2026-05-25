'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Users, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-600/30 text-red-300',
  OWNER: 'bg-purple-600/30 text-purple-300',
  ADMIN: 'bg-brand-600/30 text-brand-300',
  DEVELOPER: 'bg-green-600/30 text-green-300',
  VIEWER: 'bg-slate-700 text-slate-300',
};

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-700 text-slate-400',
  PRO: 'bg-brand-600/20 text-brand-400',
  ENTERPRISE: 'bg-purple-600/20 text-purple-400',
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) q.set('search', search);
      return apiClient.get(`/admin/users?${q}`).then(r => r.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-red-400" />
          <h2 className="text-2xl font-bold text-white">All Users</h2>
        </div>
        <span className="text-slate-400 text-sm">{meta?.total ?? 0} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or email…"
          className="input pl-10 w-full max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800">
            <tr className="text-slate-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-right">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              : users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded', ROLE_COLORS[user.role] ?? 'bg-slate-700 text-slate-300')}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300 text-xs">{user.organization?.name}</div>
                      <div className="text-slate-600 text-xs">{user.organization?.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs px-2 py-0.5 rounded', PLAN_COLORS[user.organization?.plan] ?? 'bg-slate-700 text-slate-400')}>
                        {user.organization?.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => { if (confirm(`Delete user ${user.email}?`)) deleteMutation.mutate(user.id); }}
                          title="Delete user"
                          className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Page {meta.page} of {meta.pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-1.5 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(meta.pages, p + 1))} disabled={page === meta.pages} className="btn-secondary p-1.5 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
