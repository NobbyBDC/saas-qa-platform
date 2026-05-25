'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, Filter, ChevronLeft, ChevronRight,
  User, Calendar, Tag, Search,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '@/lib/api';

const ACTION_COLORS: Record<string, string> = {
  'user.login': 'bg-blue-500/20 text-blue-400',
  'project.create': 'bg-green-500/20 text-green-400',
  'project.delete': 'bg-red-500/20 text-red-400',
  'run.trigger': 'bg-brand-500/20 text-brand-400',
  'billing.upgrade': 'bg-purple-500/20 text-purple-400',
  'github.connect': 'bg-slate-500/20 text-slate-300',
  'api_key.create': 'bg-amber-500/20 text-amber-400',
  'api_key.revoke': 'bg-red-500/20 text-red-400',
  'ai_copilot.analyze': 'bg-purple-500/20 text-purple-400',
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ action: '', resourceType: '', userId: '', from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);

  const query = new URLSearchParams({ page: String(page), limit: '25' });
  if (filter.action) query.set('action', filter.action);
  if (filter.resourceType) query.set('resourceType', filter.resourceType);
  if (filter.userId) query.set('userId', filter.userId);
  if (filter.from) query.set('from', filter.from);
  if (filter.to) query.set('to', filter.to);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, filter],
    queryFn: () => apiClient.get(`/audit/logs?${query}`).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: actionTypes } = useQuery({
    queryKey: ['audit-action-types'],
    queryFn: () => apiClient.get('/audit/logs/action-types').then(r => r.data),
    staleTime: 300_000,
  });

  const { data: logs, meta } = data ?? { data: [], meta: { total: 0, pages: 1 } };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Audit Logs</h2>
            <p className="text-slate-400 text-sm">Immutable record of all user actions</p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={clsx('btn-secondary flex items-center gap-2', showFilters && 'bg-brand-600/20 border-brand-500/40 text-brand-300')}
        >
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Action</label>
            <select
              value={filter.action}
              onChange={e => { setFilter(f => ({ ...f, action: e.target.value })); setPage(1); }}
              className="input w-full text-sm"
            >
              <option value="">All actions</option>
              {actionTypes?.map((a: string) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Resource type</label>
            <select
              value={filter.resourceType}
              onChange={e => { setFilter(f => ({ ...f, resourceType: e.target.value })); setPage(1); }}
              className="input w-full text-sm"
            >
              <option value="">All resources</option>
              {['project', 'run', 'user', 'billing', 'api_key', 'integration'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">From date</label>
            <input
              type="date"
              value={filter.from}
              onChange={e => { setFilter(f => ({ ...f, from: e.target.value })); setPage(1); }}
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">To date</label>
            <input
              type="date"
              value={filter.to}
              onChange={e => { setFilter(f => ({ ...f, to: e.target.value })); setPage(1); }}
              className="input w-full text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFilter({ action: '', resourceType: '', userId: '', from: '', to: '' }); setPage(1); }}
              className="btn-ghost text-sm text-slate-400"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Log count */}
      {meta && (
        <p className="text-slate-500 text-sm">{meta.total.toLocaleString()} entries</p>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left p-4 text-slate-400 font-medium">Timestamp</th>
              <th className="text-left p-4 text-slate-400 font-medium">Action</th>
              <th className="text-left p-4 text-slate-400 font-medium">User</th>
              <th className="text-left p-4 text-slate-400 font-medium">Resource</th>
              <th className="text-left p-4 text-slate-400 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-slate-700 rounded animate-pulse w-full" /></td>
                    ))}
                  </tr>
                ))
              : logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-mono',
                        ACTION_COLORS[log.action] ?? 'bg-slate-700 text-slate-300',
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4">
                      {log.user ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center text-xs text-white">
                            {log.user.name?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-slate-300">{log.user.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">System</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-xs">
                      {log.resourceType && <span>{log.resourceType}</span>}
                      {log.resourceId && <span className="text-slate-600"> / {log.resourceId.slice(0, 8)}</span>}
                    </td>
                    <td className="p-4 text-slate-500 text-xs font-mono">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-sm">Page {page} of {meta.pages}</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-secondary p-2 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= meta.pages}
              onClick={() => setPage(p => p + 1)}
              className="btn-secondary p-2 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
