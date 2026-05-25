'use client';

import { useRecentRuns } from '@/hooks/useProjects';
import { RecentRunsTable } from '@/components/Dashboard/RecentRunsTable';

export default function ReportsPage() {
  const { data: runs, isLoading } = useRecentRuns(50);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">Reports</h2>
        <p className="text-slate-400 text-sm mt-1">View test run history and results</p>
      </div>

      <RecentRunsTable runs={runs ?? []} isLoading={isLoading} />
    </div>
  );
}
