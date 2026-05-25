'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const STATUS_STYLES: Record<string, string> = {
  PASSED: 'bg-green-500/20 text-green-400',
  FAILED: 'bg-red-500/20 text-red-400',
  RUNNING: 'bg-blue-500/20 text-blue-400',
  QUEUED: 'bg-amber-500/20 text-amber-400',
  CANCELLED: 'bg-slate-600/40 text-slate-400',
  TIMEOUT: 'bg-orange-500/20 text-orange-400',
};

export default function AdminRunsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-runs', page],
    queryFn: () => apiClient.get(`/admin/runs?page=${page}&limit=25`).then(r => r.data),
  });

  const runs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Play className="w-6 h-6 text-red-400" />
          <h2 className="text-2xl font-bold text-white">All Runs</h2>
        </div>
        <span className="text-slate-400 text-sm">{meta?.total ?? 0} total</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800">
            <tr className="text-slate-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Run ID</th>
              <th className="px-4 py-3 text-left">Project</th>
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Branch</th>
              <th className="px-4 py-3 text-left">Trigger</th>
              <th className="px-4 py-3 text-right">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              : runs.map((run: any) => (
                  <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{run.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-slate-300">{run.project?.name}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300 text-xs">{run.project?.organization?.name}</div>
                      <div className="text-slate-600 text-xs">{run.project?.organization?.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded', STATUS_STYLES[run.status] ?? 'bg-slate-700 text-slate-300')}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{run.gitBranch ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{run.triggeredBy}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

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
