import { TestRun } from '@qa-platform/shared-types';
import { RunStatusBadge } from '@/components/UI/RunStatusBadge';
import { formatDate, formatDuration } from '@qa-platform/shared-utils';
import Link from 'next/link';

interface RecentRunsTableProps {
  runs: TestRun[];
  isLoading: boolean;
}

export function RecentRunsTable({ runs, isLoading }: RecentRunsTableProps) {
  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-800">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-4 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-24" />
              <div className="h-4 bg-slate-700 rounded w-16" />
              <div className="h-4 bg-slate-700 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400 text-sm">
        No test runs yet. Create a project and trigger a run.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Run ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Score</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Issues</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Trigger</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Duration</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Started</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {runs.map((run) => {
            const duration = run.startedAt && run.completedAt
              ? formatDuration(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())
              : '—';
            return (
              <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/projects/${run.projectId}/runs/${run.id}`} className="text-brand-400 hover:underline font-mono">
                    {run.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
                <td className="px-4 py-3">
                  {run.summary ? (
                    <span className={
                      run.summary.overallScore >= 80 ? 'text-green-400' :
                      run.summary.overallScore >= 60 ? 'text-amber-400' : 'text-red-400'
                    }>
                      {run.summary.overallScore}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  {run.summary ? (
                    <span className="text-slate-300">
                      {run.summary.totalIssues}
                      {run.summary.criticalIssues > 0 && (
                        <span className="text-red-400 ml-1">({run.summary.criticalIssues} critical)</span>
                      )}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="badge-neutral">{run.triggeredBy.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3 text-slate-400">{duration}</td>
                <td className="px-4 py-3 text-slate-400">
                  {run.startedAt ? formatDate(run.startedAt, 'MMM D, HH:mm') : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
