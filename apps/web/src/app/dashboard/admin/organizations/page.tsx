'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Building2, Search, ChevronLeft, ChevronRight,
  Pencil, Trash2, PauseCircle, KeyRound, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-700 text-slate-300',
  PRO: 'bg-brand-600/30 text-brand-300',
  ENTERPRISE: 'bg-purple-600/30 text-purple-300',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400',
  trialing: 'text-blue-400',
  past_due: 'text-amber-400',
  suspended: 'text-red-400',
  canceled: 'text-slate-400',
};

export default function AdminOrgsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editOrg, setEditOrg] = useState<any>(null);
  const [impersonateResult, setImpersonateResult] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orgs', page, search],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) q.set('search', search);
      return apiClient.get(`/admin/organizations?${q}`).then(r => r.data);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/admin/organizations/${id}/suspend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orgs'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/organizations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orgs'] }),
  });

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/organizations/${id}/impersonate`).then(r => r.data),
    onSuccess: (data) => setImpersonateResult(data),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiClient.put(`/admin/organizations/${id}/plan`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-orgs'] }); setEditOrg(null); },
  });

  const orgs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-red-400" />
          <h2 className="text-2xl font-bold text-white">Organizations</h2>
        </div>
        <span className="text-slate-400 text-sm">{meta?.total ?? 0} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or slug…"
          className="input pl-10 w-full max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800">
            <tr className="text-slate-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Users</th>
              <th className="px-4 py-3 text-right">Projects</th>
              <th className="px-4 py-3 text-right">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              : orgs.map((org: any) => (
                  <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{org.name}</div>
                      <div className="text-xs text-slate-500">{org.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded', PLAN_COLORS[org.plan] ?? 'bg-slate-700 text-slate-300')}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs', STATUS_COLORS[org.planStatus] ?? 'text-slate-400')}>
                        {org.planStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{org._count?.users ?? 0}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{org._count?.projects ?? 0}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <ActionBtn
                          icon={<Pencil className="w-3.5 h-3.5" />}
                          title="Edit plan"
                          onClick={() => setEditOrg(org)}
                        />
                        <ActionBtn
                          icon={<KeyRound className="w-3.5 h-3.5" />}
                          title="Impersonate"
                          onClick={() => impersonateMutation.mutate(org.id)}
                        />
                        <ActionBtn
                          icon={<PauseCircle className="w-3.5 h-3.5" />}
                          title="Suspend"
                          onClick={() => { if (confirm(`Suspend ${org.name}?`)) suspendMutation.mutate(org.id); }}
                          danger
                        />
                        <ActionBtn
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          title="Delete"
                          onClick={() => { if (confirm(`Permanently delete ${org.name} and all its data?`)) deleteMutation.mutate(org.id); }}
                          danger
                        />
                      </div>
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

      {/* Edit Plan Modal */}
      {editOrg && (
        <PlanModal
          org={editOrg}
          onClose={() => setEditOrg(null)}
          onSave={(body: any) => updatePlanMutation.mutate({ id: editOrg.id, ...body })}
          saving={updatePlanMutation.isPending}
        />
      )}

      {/* Impersonate Token Modal */}
      {impersonateResult && (
        <ImpersonateModal result={impersonateResult} onClose={() => setImpersonateResult(null)} />
      )}
    </div>
  );
}

function ActionBtn({ icon, title, onClick, danger }: { icon: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        'p-1.5 rounded transition-colors',
        danger
          ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700',
      )}
    >
      {icon}
    </button>
  );
}

function PlanModal({ org, onClose, onSave, saving }: any) {
  const [plan, setPlan] = useState(org.plan);
  const [projectsLimit, setProjectsLimit] = useState(String(org.projectsLimit));
  const [runsPerMonth, setRunsPerMonth] = useState(String(org.runsPerMonth));
  const [storageGb, setStorageGb] = useState(String(org.storageGb));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 space-y-5">
        <h3 className="text-lg font-semibold text-white">Edit Plan — {org.name}</h3>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Plan</span>
            <select value={plan} onChange={e => setPlan(e.target.value)} className="input w-full">
              <option value="FREE">FREE</option>
              <option value="PRO">PRO</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Projects limit (-1 = unlimited)</span>
            <input value={projectsLimit} onChange={e => setProjectsLimit(e.target.value)} className="input w-full" type="number" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Runs / month (-1 = unlimited)</span>
            <input value={runsPerMonth} onChange={e => setRunsPerMonth(e.target.value)} className="input w-full" type="number" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Storage (GB)</span>
            <input value={storageGb} onChange={e => setStorageGb(e.target.value)} className="input w-full" type="number" />
          </label>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            disabled={saving}
            onClick={() => onSave({ plan, projectsLimit: +projectsLimit, runsPerMonth: +runsPerMonth, storageGb: +storageGb })}
            className="btn-primary"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImpersonateModal({ result, onClose }: any) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(result.accessToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function useToken() {
    localStorage.setItem('access_token', result.accessToken);
    window.location.href = '/dashboard';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Impersonation Token</h3>
          <p className="text-slate-400 text-sm mt-1">{result.warning}</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-300 break-all border border-slate-700">
          {result.accessToken}
        </div>
        <div className="text-sm text-slate-400 space-y-1">
          <div><span className="text-slate-500">Impersonating:</span> {result.impersonating?.email}</div>
          <div><span className="text-slate-500">Organization:</span> {result.impersonating?.organizationName}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={copy} className="btn-secondary flex-1">
            {copied ? '✓ Copied' : 'Copy Token'}
          </button>
          <button onClick={useToken} className="btn-primary flex-1 bg-amber-600 hover:bg-amber-500">
            <ExternalLink className="w-4 h-4" /> Use Token (log in as this user)
          </button>
          <button onClick={onClose} className="btn-ghost px-3">✕</button>
        </div>
      </div>
    </div>
  );
}
