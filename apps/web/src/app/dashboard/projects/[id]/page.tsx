'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Play, Clock, Settings2, Save, Eye, EyeOff,
  GitBranch, Layers, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useProject, useProjectRuns, useRunProject, useUpdateProject, type EnabledTests } from '@/hooks/useProjects';
import { RunStatusBadge } from '@/components/UI/RunStatusBadge';
import { ScoreRing } from '@/components/UI/ScoreRing';
import { RunTestsModal } from '@/components/UI/RunTestsModal';
import dayjs from 'dayjs';
import clsx from 'clsx';

const fmt = (d: Date | string) => dayjs(d).format('MMM D, YYYY');
const fmtTime = (d: Date | string) => dayjs(d).format('MMM D, HH:mm');
const fmtDur = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {children}
      {help && <p className="text-xs text-slate-500">{help}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-brand-600' : 'bg-slate-700',
        )}
      >
        <span className={clsx(
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )} />
      </button>
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: project, isLoading } = useProject(id);
  const { data: runs } = useProjectRuns(id);
  const { mutate: runProject, isPending } = useRunProject();
  const { mutate: updateProject, isPending: isSaving } = useUpdateProject(id);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    previewUrl: '',
    repositoryUrl: '',
    defaultBranch: 'main',
    sonarProjectKey: '',
    sonarToken: '',
  });
  const [showSonarToken, setShowSonarToken] = useState(false);
  const [enabledTests, setEnabledTests] = useState<EnabledTests>({
    functional: true, accessibility: true,
    performance: true, security: true, codeQuality: true,
  });
  const [thresholds, setThresholds] = useState({
    accessibilityScore: 85,
    performanceScore: 75,
    securityScore: 90,
    codeQualityRating: 'B',
  });

  // Sync form when project loads
  useEffect(() => {
    if (!project) return;
    setForm({
      name: project.name ?? '',
      description: project.description ?? '',
      previewUrl: (project as any).previewUrl ?? '',
      repositoryUrl: (project as any).repositoryUrl ?? '',
      defaultBranch: (project as any).defaultBranch ?? 'main',
      sonarProjectKey: (project as any).sonarProjectKey ?? '',
      sonarToken: '',  // never pre-fill
    });
    const s = project.settings as any;
    if (s?.enabledTests) setEnabledTests(s.enabledTests);
    if (s?.thresholds) setThresholds(s.thresholds);
  }, [project]);

  function handleSave() {
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description,
      previewUrl: form.previewUrl,
      repositoryUrl: form.repositoryUrl,
      defaultBranch: form.defaultBranch,
      sonarProjectKey: form.sonarProjectKey,
      settings: {
        ...(project?.settings as any ?? {}),
        enabledTests,
        thresholds,
      },
    };
    if (form.sonarToken) payload.sonarToken = form.sonarToken;

    updateProject(payload, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setForm(f => ({ ...f, sonarToken: '' }));
      },
    });
  }

  function handleRunAll() {
    runProject({ projectId: id });
  }

  function handleRunSelected(tests: EnabledTests) {
    runProject({ projectId: id, enabledTests: tests }, { onSuccess: () => setModalOpen(false) });
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-slate-800 rounded w-48 animate-pulse" />
        <div className="card p-6 animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3" />
          <div className="h-4 bg-slate-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card p-12 text-center">
        <p className="text-slate-400">Project not found.</p>
        <Link href="/dashboard/projects" className="btn-ghost mt-4 inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Link>
      </div>
    );
  }

  const latestRun = runs?.[0];
  const isRunning = latestRun?.status === 'running' || latestRun?.status === 'queued';

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/projects" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-white">{project.name}</h2>
            {project.description && (
              <p className="text-slate-400 text-sm mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            disabled={isPending || isRunning}
            className="btn-ghost flex items-center gap-2"
          >
            <Settings2 className="w-4 h-4" />
            Select Tests
          </button>
          <button
            onClick={handleRunAll}
            disabled={isPending || isRunning}
            className="btn-primary"
          >
            <Play className="w-4 h-4" />
            {isPending || isRunning ? 'Running…' : 'Run All'}
          </button>
        </div>
      </div>

      {/* ── Latest run scores ── */}
      {latestRun?.summary && (
        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">Latest run scores</h3>
          <div className="flex items-center gap-6">
            <ScoreRing score={latestRun.summary.overallScore} size={72} strokeWidth={5} />
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 flex-1">
              {[
                { label: 'A11y', score: latestRun.summary.accessibilityScore },
                { label: 'Perf', score: latestRun.summary.performanceScore },
                { label: 'Security', score: latestRun.summary.securityScore },
                { label: 'Code', score: latestRun.summary.codeQualityScore },
                { label: 'Content', score: latestRun.summary.contentAccuracyScore },
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
        </div>
      )}

      {/* ── Project Settings ── */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/40 transition-colors"
          onClick={() => setSettingsOpen(o => !o)}
        >
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand-400" />
            Project Settings
          </h3>
          {settingsOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {settingsOpen && (
          <div className="border-t border-slate-800 px-6 py-6 space-y-8">

            {/* Basic Info */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Basic Info</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Project Name">
                  <input
                    className="input"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="My Project"
                  />
                </Field>
                <Field label="Description">
                  <input
                    className="input"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </Field>
              </div>
            </div>

            {/* URLs */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Test URLs</h4>
              <div className="space-y-4">
                <Field label="Preview URL" help="Live/staging URL for Visual, Accessibility, Performance, Functional, and Security tests. Required for those test types.">
                  <input
                    className="input"
                    value={form.previewUrl}
                    onChange={e => setForm(f => ({ ...f, previewUrl: e.target.value }))}
                    placeholder="https://your-staging-site.com"
                  />
                </Field>
              </div>
            </div>

            {/* Git Repository */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                <GitBranch className="w-3 h-3 inline mr-1" />Git Repository
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Repository URL" help="GitHub/GitLab URL. Required for Code Quality scanning.">
                  <input
                    className="input"
                    value={form.repositoryUrl}
                    onChange={e => setForm(f => ({ ...f, repositoryUrl: e.target.value }))}
                    placeholder="https://github.com/org/repo"
                  />
                </Field>
                <Field label="Default Branch" help="Branch used for code quality analysis.">
                  <input
                    className="input"
                    value={form.defaultBranch}
                    onChange={e => setForm(f => ({ ...f, defaultBranch: e.target.value }))}
                    placeholder="main"
                  />
                </Field>
              </div>
            </div>

            {/* SonarQube */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">SonarQube / Code Quality</h4>
              <div className="space-y-4">
                <Field label="SonarQube Project Key" help="The project key in SonarQube (e.g. my-org_my-project). Found in your SonarQube project → Project Information.">
                  <input
                    className="input"
                    value={form.sonarProjectKey}
                    onChange={e => setForm(f => ({ ...f, sonarProjectKey: e.target.value }))}
                    placeholder="my-org_my-project"
                  />
                </Field>
                <Field label="SonarQube Token" help="Leave blank to keep existing token. Generate one in SonarQube → My Account → Security → Generate Token.">
                  <div className="relative">
                    <input
                      className="input pr-10"
                      type={showSonarToken ? 'text' : 'password'}
                      value={form.sonarToken}
                      onChange={e => setForm(f => ({ ...f, sonarToken: e.target.value }))}
                      placeholder="squ_xxxxxxxxxxxxxxxx (leave blank to keep current)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSonarToken(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showSonarToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
              </div>
            </div>

            {/* Default enabled tests */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Default Tests</h4>
              <p className="text-xs text-slate-500 mb-4">Which tests run by default when you click "Run All". You can always override per-run.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ['functional', 'Functional Tests'],
                  ['accessibility', 'Accessibility (WCAG)'],
                  ['performance', 'Performance'],
                  ['security', 'Security Scan'],
                  ['codeQuality', 'Code Quality'],
                ] as const).map(([key, label]) => (
                  <Toggle
                    key={key}
                    checked={enabledTests[key]}
                    onChange={v => setEnabledTests(t => ({ ...t, [key]: v }))}
                    label={label}
                  />
                ))}
              </div>
            </div>

            {/* Quality Thresholds */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Quality Thresholds</h4>
              <p className="text-xs text-slate-500 mb-4">Minimum scores required to pass each test category.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: 'accessibilityScore', label: 'Accessibility Score', min: 0, max: 100 },
                  { key: 'performanceScore', label: 'Performance Score', min: 0, max: 100 },
                  { key: 'securityScore', label: 'Security Score', min: 0, max: 100 },
                ] as const).map(({ key, label, min, max }) => (
                  <Field key={key} label={`${label}: ${thresholds[key]}`}>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      value={thresholds[key]}
                      onChange={e => setThresholds(t => ({ ...t, [key]: +e.target.value }))}
                      className="w-full accent-brand-500"
                    />
                  </Field>
                ))}
                <Field label="Code Quality Rating">
                  <select
                    className="input"
                    value={thresholds.codeQualityRating}
                    onChange={e => setThresholds(t => ({ ...t, codeQualityRating: e.target.value }))}
                  >
                    {['A', 'B', 'C', 'D', 'E'].map(r => (
                      <option key={r} value={r}>Rating {r}{r === 'A' ? ' (Best)' : r === 'E' ? ' (Worst)' : ''}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
              </button>
              {saved && <p className="text-green-400 text-sm">Settings updated successfully</p>}
            </div>
          </div>
        )}
      </div>

      {/* ── Run history ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-semibold text-white">Run history</h3>
        </div>
        {!runs || runs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No runs yet. Click "Run All" to start your first test.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Run</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {runs.map((run) => {
                const duration = run.startedAt && run.completedAt
                  ? fmtDur(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())
                  : '—';
                return (
                  <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3">
                      <Link
                        href={`/dashboard/projects/${id}/runs/${run.id}`}
                        className="text-brand-400 hover:underline font-mono text-xs"
                      >
                        {run.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-3"><RunStatusBadge status={run.status} /></td>
                    <td className="px-6 py-3">
                      {run.summary ? (
                        <span className={
                          run.summary.overallScore >= 80 ? 'text-green-400' :
                          run.summary.overallScore >= 60 ? 'text-amber-400' : 'text-red-400'
                        }>{run.summary.overallScore}%</span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-400">{duration}</td>
                    <td className="px-6 py-3 text-slate-400">
                      {run.startedAt ? fmtTime(run.startedAt) : (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Queued</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <RunTestsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onRun={handleRunSelected}
        isPending={isPending}
        hasPreviewUrl={!!(project as any).previewUrl}
        hasRepoUrl={!!(project as any).repositoryUrl}
      />
    </div>
  );
}
