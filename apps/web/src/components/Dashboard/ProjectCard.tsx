import Link from 'next/link';
import { Project } from '@qa-platform/shared-types';
import { Play, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { ScoreRing } from '@/components/UI/ScoreRing';
import { RunStatusBadge } from '@/components/UI/RunStatusBadge';
import { useRunProject } from '@/hooks/useProjects';
import { formatDate } from '@qa-platform/shared-utils';
import clsx from 'clsx';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { mutate: runProject, isPending } = useRunProject();
  const summary = project.latestRun?.summary;
  const run = project.latestRun;

  return (
    <div className="card p-5 card-hover flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="font-semibold text-white hover:text-brand-300 transition-colors truncate block"
          >
            {project.name}
          </Link>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{project.figmaUrl}</p>
        </div>
        {summary && (
          <ScoreRing score={summary.overallScore} size={48} strokeWidth={4} />
        )}
      </div>

      {/* Stage scores */}
      {summary && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Visual', score: summary.visualScore },
            { label: 'A11y', score: summary.accessibilityScore },
            { label: 'Perf', score: summary.performanceScore },
            { label: 'Security', score: summary.securityScore },
            { label: 'Code', score: summary.codeQualityScore },
            { label: 'Content', score: summary.contentAccuracyScore },
          ].map(({ label, score }) => (
            <div key={label} className="bg-slate-800/60 rounded-lg p-2 text-center">
              <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
              <p className={clsx(
                'text-sm font-bold',
                score === undefined ? 'text-slate-600' :
                score >= 80 ? 'text-green-400' :
                score >= 60 ? 'text-amber-400' : 'text-red-400',
              )}>
                {score !== undefined ? `${score}%` : '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Issues summary */}
      {summary && (
        <div className="flex items-center gap-3 text-xs">
          {summary.criticalIssues > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="w-3 h-3" /> {summary.criticalIssues} critical
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <Clock className="w-3 h-3" /> {summary.warnings} warnings
            </span>
          )}
          {summary.passed && (
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3 h-3" /> All checks passed
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2">
          {run && <RunStatusBadge status={run.status} />}
          {run?.completedAt && (
            <span className="text-xs text-slate-500">{formatDate(run.completedAt, 'MMM D, HH:mm')}</span>
          )}
        </div>
        <button
          onClick={() => runProject({ projectId: project.id })}
          disabled={isPending || run?.status === 'running' || run?.status === 'queued'}
          className="btn-ghost text-xs py-1 px-2 gap-1"
        >
          <Play className="w-3 h-3" />
          {isPending || run?.status === 'running' ? 'Running...' : 'Run'}
        </button>
      </div>
    </div>
  );
}
