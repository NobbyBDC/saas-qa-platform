'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Activity, Clock,
  CheckCircle2, XCircle, BarChart3, Target,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import clsx from 'clsx';
import { apiClient } from '@/lib/api';

const PERIODS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

export default function ObservabilityPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['observability-dashboard', days],
    queryFn: () => apiClient.get(`/observability/dashboard?days=${days}`).then(r => r.data),
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Observability</h2>
          <p className="text-slate-400 text-sm mt-1">Pipeline health, performance, and deployment frequency</p>
        </div>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={clsx(
                'px-3 py-1.5 rounded text-sm transition-colors',
                days === p.value ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ObsSkeleton />
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Runs"
              value={data?.summary?.totalRuns ?? 0}
              icon={Activity}
              color="brand"
            />
            <MetricCard
              label="Pass Rate"
              value={`${data?.summary?.passRate ?? 0}%`}
              icon={Target}
              color={data?.summary?.passRate >= 80 ? 'success' : 'danger'}
            />
            <MetricCard
              label="Avg Duration"
              value={`${data?.summary?.avgDurationSeconds ?? 0}s`}
              icon={Clock}
              color="warning"
            />
            <MetricCard
              label="Deploys ({days}d)"
              value={data?.summary?.deployFrequency ?? 0}
              icon={TrendingUp}
              color="purple"
            />
          </div>

          {/* Daily pipeline runs chart */}
          <div className="card p-6">
            <h3 className="text-white font-semibold mb-4">Pipeline Runs — Daily</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data?.daily ?? []}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  labelFormatter={(d) => new Date(d).toLocaleDateString()}
                />
                <Legend />
                <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" fill="url(#gradTotal)" strokeWidth={2} />
                <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fill="url(#gradFailed)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Run status breakdown */}
          {data?.byStatus && (
            <div className="card p-6">
              <h3 className="text-white font-semibold mb-4">Runs by Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.byStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                  <YAxis dataKey="status" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                    cursor={{ fill: '#1e293b' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: any) {
  const colorMap: Record<string, string> = {
    brand: 'text-brand-400 bg-brand-500/10',
    success: 'text-green-400 bg-green-500/10',
    danger: 'text-red-400 bg-red-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', colorMap[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ObsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="card h-24 bg-slate-800" />)}
      </div>
      <div className="card h-72 bg-slate-800" />
    </div>
  );
}
