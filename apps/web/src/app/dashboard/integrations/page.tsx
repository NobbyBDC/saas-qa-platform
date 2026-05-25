'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Github, GitBranch, Slack, Webhook, Plus, Trash2,
  CheckCircle2, XCircle, ExternalLink, RefreshCw, Bell,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '@/lib/api';

export default function IntegrationsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">Integrations</h2>
        <p className="text-slate-400 text-sm mt-1">Connect your tools to automate your QA pipeline</p>
      </div>

      <div className="grid gap-6">
        <GitHubSection />
        <SlackSection />
        <NotificationPrefsSection />
      </div>
    </div>
  );
}

// --------------- GitHub ---------------
function GitHubSection() {
  const qc = useQueryClient();
  const [repos, setRepos] = useState(false);

  const { data: integration } = useQuery({
    queryKey: ['github-integration'],
    queryFn: () => apiClient.get('/integrations/github/repos')
      .then(r => ({ repos: r.data as any[], connected: true }))
      .catch(() => ({ repos: null as any[] | null, connected: false })),
  });

  const connectMutation = useMutation({
    mutationFn: () => apiClient.get('/integrations/github/auth').then(r => r.data),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiClient.post('/integrations/github/disconnect'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github-integration'] }),
  });

  return (
    <IntegrationCard
      icon={<Github className="w-6 h-6" />}
      name="GitHub"
      description="Trigger QA pipelines on push & pull requests. Auto-post test results as PR comments."
      connected={integration?.connected}
      badge={integration?.connected ? `${integration.repos?.length ?? 0} repos` : undefined}
    >
      {integration?.connected ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setRepos(r => !r)} className="btn-secondary text-sm flex items-center gap-2">
              <GitBranch className="w-4 h-4" /> {repos ? 'Hide' : 'View'} Repositories
            </button>
            <button onClick={() => disconnectMutation.mutate()} className="btn-ghost text-red-400 text-sm hover:bg-red-500/10">
              <Trash2 className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
          {repos && <RepoList repos={integration.repos ?? []} />}
        </div>
      ) : (
        <button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} className="btn-primary text-sm">
          <Github className="w-4 h-4" />
          {connectMutation.isPending ? 'Redirecting…' : 'Connect GitHub'}
        </button>
      )}
    </IntegrationCard>
  );
}

function RepoList({ repos }: { repos: any[] }) {
  const connectRepo = useMutation({
    mutationFn: (repoFullName: string) => apiClient.post('/integrations/github/repos/connect', { repoFullName }),
  });

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      {repos.slice(0, 10).map((repo: any) => (
        <div key={repo.id} className="flex items-center justify-between p-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-sm text-slate-300">{repo.fullName}</span>
            {repo.private && <span className="text-xs text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">private</span>}
          </div>
          <button
            onClick={() => connectRepo.mutate(repo.fullName)}
            className="text-xs btn-ghost text-brand-400 hover:text-brand-300"
          >
            Connect
          </button>
        </div>
      ))}
    </div>
  );
}

// --------------- Slack ---------------
function SlackSection() {
  const [token, setToken] = useState('');
  const [channel, setChannel] = useState('#general');
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/integrations/slack', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slack-integration'] }),
  });

  return (
    <IntegrationCard
      icon={<Slack className="w-6 h-6" />}
      name="Slack"
      description="Get real-time notifications for pipeline results, security issues, and deployments."
    >
      <div className="space-y-3 max-w-sm">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Bot Token</label>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="xoxb-..."
            className="input w-full text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Default Channel</label>
          <input
            value={channel}
            onChange={e => setChannel(e.target.value)}
            placeholder="#qa-alerts"
            className="input w-full text-sm"
          />
        </div>
        <button
          onClick={() => saveMutation.mutate({ botToken: token, defaultChannel: channel })}
          disabled={!token || saveMutation.isPending}
          className="btn-primary text-sm"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Slack Integration'}
        </button>
      </div>
    </IntegrationCard>
  );
}

// --------------- Notification Preferences ---------------
const EVENTS = [
  { key: 'run_success', label: 'Pipeline Success' },
  { key: 'run_failure', label: 'Pipeline Failure' },
  { key: 'security_issue', label: 'Security Issue' },
  { key: 'deploy_completed', label: 'Deployment Completed' },
];
const CHANNELS = ['email', 'slack'];

function NotificationPrefsSection() {
  const qc = useQueryClient();
  const { data: prefs } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => apiClient.get('/notifications/preferences').then(r => r.data),
    initialData: [],
  });

  const updateMutation = useMutation({
    mutationFn: (updated: any[]) => apiClient.put('/notifications/preferences', { prefs: updated }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const isEnabled = (event: string, channel: string) =>
    prefs?.find((p: any) => p.event === event && p.channel === channel)?.enabled ?? true;

  const toggle = (event: string, channel: string) => {
    const current = prefs ?? [];
    const updated = EVENTS.flatMap(e =>
      CHANNELS.map(c => ({
        event: e.key, channel: c,
        enabled: e.key === event && c === channel ? !isEnabled(event, channel) : isEnabled(e.key, c),
      }))
    );
    updateMutation.mutate(updated);
  };

  return (
    <IntegrationCard
      icon={<Bell className="w-6 h-6" />}
      name="Notification Preferences"
      description="Choose which events trigger notifications and through which channels."
    >
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left text-slate-400 font-medium pb-3 pr-8">Event</th>
            {CHANNELS.map(c => <th key={c} className="text-center text-slate-400 font-medium pb-3 px-4 capitalize">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {EVENTS.map(ev => (
            <tr key={ev.key}>
              <td className="py-3 text-slate-300 pr-8">{ev.label}</td>
              {CHANNELS.map(c => (
                <td key={c} className="py-3 text-center px-4">
                  <button
                    onClick={() => toggle(ev.key, c)}
                    className={clsx(
                      'w-5 h-5 rounded flex items-center justify-center mx-auto transition-colors',
                      isEnabled(ev.key, c) ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-600',
                    )}
                  >
                    {isEnabled(ev.key, c) ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </IntegrationCard>
  );
}

// --------------- Card wrapper ---------------
function IntegrationCard({ icon, name, description, connected, badge, children }: any) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold">{name}</h3>
              {badge && <span className="text-xs bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded">{badge}</span>}
            </div>
            <p className="text-slate-400 text-sm">{description}</p>
          </div>
        </div>
        {connected !== undefined && (
          <span className={clsx('flex items-center gap-1 text-xs', connected ? 'text-green-400' : 'text-slate-500')}>
            {connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {connected ? 'Connected' : 'Not connected'}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
