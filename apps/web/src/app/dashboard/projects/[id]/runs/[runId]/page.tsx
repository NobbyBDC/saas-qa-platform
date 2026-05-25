'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, SkipForward, FileText, ExternalLink, Code2, ChevronDown, ChevronRight } from 'lucide-react';
import { useRun } from '@/hooks/useProjects';
import { RunStatusBadge } from '@/components/UI/RunStatusBadge';
import { ScoreRing } from '@/components/UI/ScoreRing';
import type { StageStatus, StageType } from '@qa-platform/shared-types';
import dayjs from 'dayjs';
import clsx from 'clsx';

const fmtTime = (d: Date | string) => dayjs(d).format('MMM D, HH:mm');
const fmtDur = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

const STAGE_LABELS: Record<StageType, string> = {
  figma_ingestion:  'Figma Ingestion',
  code_generation:  'Code Generation',
  deployment:       'Preview Deploy',
  visual_regression:'Visual Regression',
  functional:       'Functional Tests',
  accessibility:    'Accessibility',
  performance:      'Performance',
  security:         'Security Scan',
  code_quality:     'Code Quality',
  report_generation:'Report Generation',
};

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'passed')  return <CheckCircle2 className="w-5 h-5 text-green-400" />;
  if (status === 'failed')  return <XCircle className="w-5 h-5 text-red-400" />;
  if (status === 'running') return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
  if (status === 'skipped') return <SkipForward className="w-5 h-5 text-slate-500" />;
  return <Clock className="w-5 h-5 text-slate-600" />;
}

function stageBg(status: StageStatus) {
  if (status === 'passed')  return 'border-green-500/20 bg-green-500/5';
  if (status === 'failed')  return 'border-red-500/20 bg-red-500/5';
  if (status === 'running') return 'border-blue-500/20 bg-blue-500/5';
  return 'border-slate-700/50';
}

function GeneratedCodeViewer({ stage }: { stage: any }) {
  const [openFile, setOpenFile] = useState<string | null>(null);
  const result = stage?.result as any;
  if (!result) return null;

  const files: Array<{ name: string; code: string }> = [
    ...(result.components ?? []).map((c: any) => ({ name: `src/components/${c.name}.tsx`, code: c.code ?? '' })),
    ...(result.pages ?? []).map((p: any) => ({ name: `src/pages${p.route ?? '/'}/index.tsx`, code: p.code ?? '' })),
    ...(result.designTokenFile ? [{ name: 'src/styles/tokens.css', code: result.designTokenFile }] : []),
    ...(result.tailwindConfig ? [{ name: 'tailwind.config.js', code: result.tailwindConfig }] : []),
  ];

  if (files.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
        <Code2 className="w-4 h-4 text-brand-400" />
        <h3 className="font-semibold text-white">Generated Code ({files.length} files)</h3>
      </div>
      <div className="divide-y divide-slate-800">
        {files.map((file) => (
          <div key={file.name}>
            <button
              className="w-full px-6 py-3 flex items-center gap-2 text-left hover:bg-slate-800/40 transition-colors"
              onClick={() => setOpenFile(openFile === file.name ? null : file.name)}
            >
              {openFile === file.name
                ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
              <span className="text-xs font-mono text-slate-300">{file.name}</span>
              <span className="ml-auto text-xs text-slate-600">{file.code.length.toLocaleString()} chars</span>
            </button>
            {openFile === file.name && (
              <pre className="px-6 py-4 bg-slate-950 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 overflow-y-auto border-t border-slate-800">
                {file.code}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RunDetailPage({
  params,
}: {
  params: { id: string; runId: string };
}) {
  const { id, runId } = params;
  const { data: run, isLoading } = useRun(runId);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-slate-800 rounded w-64 animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="card p-12 text-center">
        <p className="text-slate-400">Run not found.</p>
        <Link href={`/dashboard/projects/${id}`} className="btn-ghost mt-4 inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back to project
        </Link>
      </div>
    );
  }

  const duration = run.startedAt && run.completedAt
    ? fmtDur(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())
    : null;

  const deployStage = run.stages?.find((s: any) => s.type === 'deployment');
  const codegenStage = run.stages?.find((s: any) => s.type === 'code_generation');
  const previewUrl: string | undefined = (deployStage?.result as any)?.previewUrl;
  const hasReport = run.stages?.some((s: any) => s.type === 'report_generation' && s.status === 'passed');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/projects/${id}`} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white font-mono">{runId.slice(0, 8)}</h2>
            <RunStatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
            <span>Triggered by {run.triggeredBy.replace('_', ' ')}</span>
            {run.startedAt && <span>Started {fmtTime(run.startedAt)}</span>}
            {duration && <span>Duration {duration}</span>}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {(hasReport || previewUrl) && (
        <div className="flex items-center gap-3 flex-wrap">
          {hasReport && (
            <a
              href={`/report/${runId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              View Full Report
            </a>
          )}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open Preview
            </a>
          )}
        </div>
      )}

      {/* Summary scores */}
      {run.summary && (
        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">Results</h3>
          <div className="flex items-center gap-6">
            <ScoreRing score={run.summary.overallScore} size={72} strokeWidth={5} />
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 flex-1">
              {[
                { label: 'Visual',    score: run.summary.visualScore },
                { label: 'A11y',      score: run.summary.accessibilityScore },
                { label: 'Perf',      score: run.summary.performanceScore },
                { label: 'Security',  score: run.summary.securityScore },
                { label: 'Code',      score: run.summary.codeQualityScore },
                { label: 'Content',   score: run.summary.contentAccuracyScore },
              ].map(({ label, score }) => (
                <div key={label} className="bg-slate-800/60 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
                  <p className={clsx('text-sm font-bold',
                    score === undefined ? 'text-slate-600' :
                    score >= 80 ? 'text-green-400' :
                    score >= 60 ? 'text-amber-400' : 'text-red-400',
                  )}>
                    {score !== undefined ? `${score}%` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 text-sm">
            {run.summary.criticalIssues > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-4 h-4" /> {run.summary.criticalIssues} critical issues
              </span>
            )}
            {run.summary.warnings > 0 && (
              <span className="text-amber-400">{run.summary.warnings} warnings</span>
            )}
            {run.summary.passed && (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-4 h-4" /> All checks passed
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pipeline stages */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-semibold text-white">Pipeline stages</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {run.stages.map((stage) => (
            <div
              key={stage.id}
              className={clsx(
                'px-6 py-4 flex items-center gap-4 border-l-2',
                stageBg(stage.status),
              )}
            >
              <StageIcon status={stage.status} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-200 text-sm">
                  {STAGE_LABELS[stage.type as StageType] ?? stage.type}
                </p>
                {stage.logs?.length > 0 && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {stage.logs[stage.logs.length - 1]}
                  </p>
                )}
              </div>
              <div className="text-right text-xs text-slate-500 flex-shrink-0">
                {stage.durationMs != null && (
                  <p>{fmtDur(stage.durationMs)}</p>
                )}
                {stage.result?.score != null && (
                  <p className={clsx('font-bold',
                    stage.result.score >= 80 ? 'text-green-400' :
                    stage.result.score >= 60 ? 'text-amber-400' : 'text-red-400',
                  )}>
                    {stage.result.score}%
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Code */}
      {codegenStage && <GeneratedCodeViewer stage={codegenStage} />}

      {/* Issues */}
      {run.issues && run.issues.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h3 className="font-semibold text-white">Issues ({run.issues.length})</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {run.issues.map((issue) => (
              <div key={issue.id} className="px-6 py-4 flex items-start gap-3">
                <span className={clsx('badge mt-0.5 flex-shrink-0',
                  issue.severity === 'critical' ? 'badge-danger' :
                  issue.severity === 'high' ? 'badge-danger' :
                  issue.severity === 'medium' ? 'badge-warning' : 'badge-info',
                )}>
                  {issue.severity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{issue.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{issue.description}</p>
                  {issue.location && (
                    <p className="text-xs text-slate-600 mt-1 font-mono">{issue.location}</p>
                  )}
                  {issue.aiSuggestedFix && (
                    <p className="text-xs text-brand-400 mt-1">AI fix: {issue.aiSuggestedFix}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
