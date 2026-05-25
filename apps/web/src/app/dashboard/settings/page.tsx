'use client';

import { Settings, Bell, Shield, Database } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Configure your QA platform preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Settings className="w-4 h-4 text-brand-400" />
            </div>
            <h3 className="font-semibold text-white">General</h3>
          </div>
          <p className="text-slate-400 text-sm">Platform-wide configuration settings.</p>
          <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
            Settings management coming soon.
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-yellow-400" />
            </div>
            <h3 className="font-semibold text-white">Notifications</h3>
          </div>
          <p className="text-slate-400 text-sm">Slack, email, and webhook alert preferences.</p>
          <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
            Notification settings coming soon.
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-green-400" />
            </div>
            <h3 className="font-semibold text-white">Security</h3>
          </div>
          <p className="text-slate-400 text-sm">API keys, tokens, and access control.</p>
          <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
            Security settings coming soon.
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="font-semibold text-white">Integrations</h3>
          </div>
          <p className="text-slate-400 text-sm">Connect Figma, Jira, GitHub, and more.</p>
          <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
            Integrations coming soon.
          </div>
        </div>
      </div>
    </div>
  );
}
