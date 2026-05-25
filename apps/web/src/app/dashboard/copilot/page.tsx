'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Zap, AlertTriangle, CheckCircle2, Clock, Loader2,
  GitPullRequest, ChevronRight, Sparkles, RefreshCw, Eye,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '@/lib/api';

export default function CopilotPage() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then(r => r.data),
  });

  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
          <Bot className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">AI Copilot</h2>
          <p className="text-slate-400 text-sm">Automated fix suggestions, self-healing pipelines, and accessibility improvements</p>
        </div>
      </div>

      {/* Project selector */}
      <div className="flex gap-2 flex-wrap">
        {projects?.map((p: any) => (
          <button
            key={p.id}
            onClick={() => setSelectedProject(p.id)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              selectedProject === p.id
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200',
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {selectedProject ? (
        <ProjectCopilotView projectId={selectedProject} />
      ) : (
        <div className="card p-12 text-center">
          <Sparkles className="w-12 h-12 text-purple-500/50 mx-auto mb-3" />
          <p className="text-slate-400">Select a project to view AI suggestions</p>
        </div>
      )}
    </div>
  );
}

function ProjectCopilotView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['copilot-suggestions', projectId],
    queryFn: () => apiClient.get(`/ai-copilot/projects/${projectId}/suggestions`).then(r => r.data),
    refetchInterval: 15000,
  });

  const analyzeMutation = useMutation({
    mutationFn: (issueId: string) => apiClient.post(`/ai-copilot/issues/${issueId}/analyze`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copilot-suggestions', projectId] }),
  });

  const applyMutation = useMutation({
    mutationFn: (actionId: string) => apiClient.post(`/ai-copilot/actions/${actionId}/apply`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copilot-suggestions', projectId] }),
  });

  if (isLoading) return <CopilotSkeleton />;

  const { openIssues, pendingActions, recentFailures } = data ?? {};

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatChip label="Recent failures" value={recentFailures ?? 0} color="red" />
        <StatChip label="Open issues" value={openIssues?.length ?? 0} color="amber" />
        <StatChip label="Pending fixes" value={pendingActions?.length ?? 0} color="purple" />
      </div>

      {/* Pending AI actions (ready to apply) */}
      {pendingActions?.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" /> Ready to Apply
          </h3>
          <div className="space-y-3">
            {pendingActions.map((action: any) => (
              <ActionCard
                key={action.id}
                action={action}
                onApply={() => applyMutation.mutate(action.id)}
                applying={applyMutation.isPending && applyMutation.variables === action.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Open issues with AI suggestions */}
      {openIssues?.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Issues
          </h3>
          <div className="space-y-3">
            {openIssues.map((issue: any) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onAnalyze={() => analyzeMutation.mutate(issue.id)}
                analyzing={analyzeMutation.isPending && analyzeMutation.variables === issue.id}
              />
            ))}
          </div>
        </div>
      )}

      {!pendingActions?.length && !openIssues?.length && (
        <div className="card p-10 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
          <p className="text-slate-400">No open issues — everything looks good!</p>
        </div>
      )}
    </div>
  );
}

function ActionCard({ action, onApply, applying }: any) {
  const [showDiff, setShowDiff] = useState(false);
  const output = action.output ?? {};

  return (
    <div className="card p-4 border-purple-500/30 bg-purple-500/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-white text-sm font-medium">{action.issue?.title ?? 'AI Fix'}</span>
            <span className="text-xs text-purple-400/70 border border-purple-500/30 px-1.5 py-0.5 rounded">
              {Math.round((output.confidence ?? 0) * 100)}% confidence
            </span>
          </div>
          <p className="text-slate-400 text-xs">{output.fixDescription}</p>
          {output.patchDiff && (
            <button onClick={() => setShowDiff(s => !s)} className="text-xs text-purple-400 hover:text-purple-300 mt-2 flex items-center gap-1">
              <Eye className="w-3 h-3" /> {showDiff ? 'Hide' : 'View'} patch
            </button>
          )}
          {showDiff && output.patchDiff && (
            <pre className="mt-2 text-xs bg-slate-900 p-3 rounded-lg overflow-x-auto text-green-300 font-mono max-h-40">
              {output.patchDiff}
            </pre>
          )}
        </div>
        <button
          onClick={onApply}
          disabled={applying}
          className="btn-primary text-xs flex-shrink-0 flex items-center gap-1.5"
        >
          {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          Apply Fix
        </button>
      </div>
    </div>
  );
}

function IssueCard({ issue, onAnalyze, analyzing }: any) {
  const severityColor: Record<string, string> = {
    CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/30',
    HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    LOW: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx('text-xs px-2 py-0.5 rounded border', severityColor[issue.severity] ?? 'text-slate-400')}>
              {issue.severity}
            </span>
            <span className="text-white text-sm font-medium">{issue.title}</span>
          </div>
          {issue.aiSuggestedFix && (
            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{issue.aiSuggestedFix}</p>
          )}
        </div>
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="btn-secondary text-xs flex-shrink-0 flex items-center gap-1.5"
        >
          {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
          {issue.aiSuggestedFix ? 'Re-analyze' : 'Fix with AI'}
        </button>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    red: 'text-red-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
  };
  return (
    <div className="card p-4">
      <p className={clsx('text-2xl font-bold', colorMap[color])}>{value}</p>
      <p className="text-slate-400 text-sm">{label}</p>
    </div>
  );
}

function CopilotSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="card h-20 bg-slate-800" />)}
      </div>
      {[...Array(3)].map((_, i) => <div key={i} className="card h-16 bg-slate-800" />)}
    </div>
  );
}
