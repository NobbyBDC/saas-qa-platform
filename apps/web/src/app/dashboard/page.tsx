'use client';

import { useProjects, useRecentRuns } from '@/hooks/useProjects';
import { StatsCard } from '@/components/Dashboard/StatsCard';
import { ProjectCard } from '@/components/Dashboard/ProjectCard';
import { RecentRunsTable } from '@/components/Dashboard/RecentRunsTable';
import { NewProjectModal } from '@/components/Projects/NewProjectModal';
import { useState } from 'react';
import { Plus, TrendingUp, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export default function DashboardPage() {
  const [showNewProject, setShowNewProject] = useState(false);
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: recentRuns, isLoading: runsLoading } = useRecentRuns();

  const stats = {
    totalProjects: projects?.length ?? 0,
    passing: projects?.filter(p => p.latestRun?.summary?.passed).length ?? 0,
    failing: projects?.filter(p => p.latestRun?.summary && !p.latestRun.summary.passed).length ?? 0,
    avgScore: projects?.length
      ? Math.round(
          projects.reduce((sum, p) => sum + (p.latestRun?.summary?.overallScore ?? 0), 0) /
          projects.length,
        )
      : 0,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Overview</h2>
          <p className="text-slate-400 text-sm mt-1">Monitor all your QA pipelines in one place</p>
        </div>
        <button onClick={() => setShowNewProject(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Projects"
          value={stats.totalProjects}
          icon={TrendingUp}
          color="brand"
        />
        <StatsCard
          title="Passing"
          value={stats.passing}
          icon={CheckCircle2}
          color="success"
          subtitle={`of ${stats.totalProjects}`}
        />
        <StatsCard
          title="Failing"
          value={stats.failing}
          icon={AlertTriangle}
          color="danger"
        />
        <StatsCard
          title="Avg QA Score"
          value={`${stats.avgScore}%`}
          icon={Clock}
          color={stats.avgScore >= 80 ? 'success' : stats.avgScore >= 60 ? 'warning' : 'danger'}
        />
      </div>

      {/* Projects grid */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Projects</h3>
        {projectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-3" />
                <div className="h-3 bg-slate-700 rounded w-3/4 mb-6" />
                <div className="h-8 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        ) : projects?.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-400 mb-4">No projects yet</p>
            <button onClick={() => setShowNewProject(true)} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" /> Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Recent Runs</h3>
        <RecentRunsTable runs={recentRuns ?? []} isLoading={runsLoading} />
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
}
