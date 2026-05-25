'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Building2, Users, Play, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import clsx from 'clsx';

export default function AdminStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get('/admin/stats').then(r => r.data),
  });

  if (isLoading) return <Skeleton />;

  const { totals, runsByStatus, orgsByPlan, runsLast24h } = data ?? {};

  const statCards = [
    { label: 'Organizations', value: totals?.organizations ?? 0, icon: Building2, color: 'text-blue-400' },
    { label: 'Total Users', value: totals?.users ?? 0, icon: Users, color: 'text-green-400' },
    { label: 'Total Runs', value: totals?.runs ?? 0, icon: Play, color: 'text-brand-400' },
    { label: 'Open Issues', value: totals?.issues ?? 0, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Runs (24h)', value: runsLast24h ?? 0, icon: Activity, color: 'text-purple-400' },
  ];

  const planColors: Record<string, string> = {
    FREE: 'bg-slate-700 text-slate-300',
    PRO: 'bg-brand-600/30 text-brand-300',
    ENTERPRISE: 'bg-purple-600/30 text-purple-300',
  };

  const statusColors: Record<string, string> = {
    PASSED: 'bg-green-500/20 text-green-400',
    FAILED: 'bg-red-500/20 text-red-400',
    RUNNING: 'bg-blue-500/20 text-blue-400',
    QUEUED: 'bg-amber-500/20 text-amber-400',
    CANCELLED: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Platform Overview</h2>
          <p className="text-slate-400 text-sm">Cross-tenant statistics — super admin view</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5 space-y-3">
            <Icon className={clsx('w-5 h-5', color)} />
            <div>
              <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orgs by plan */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-white">Organizations by Plan</h3>
          <div className="space-y-2">
            {Object.entries(orgsByPlan ?? {}).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <span className={clsx('text-xs font-medium px-2 py-1 rounded', planColors[plan] ?? 'bg-slate-700 text-slate-300')}>
                  {plan}
                </span>
                <span className="text-white font-semibold">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Runs by status */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-white">Runs by Status</h3>
          <div className="space-y-2">
            {Object.entries(runsByStatus ?? {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={clsx('text-xs font-medium px-2 py-1 rounded', statusColors[status] ?? 'bg-slate-700 text-slate-300')}>
                  {status}
                </span>
                <span className="text-white font-semibold">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-800 rounded" />
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 bg-slate-800 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-48 bg-slate-800 rounded-xl" />
        <div className="h-48 bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}
