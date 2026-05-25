'use client';

import { useState } from 'react';
import { X, Play, Accessibility, Zap, Shield, Code2, MousePointerClick, Layers } from 'lucide-react';
import type { EnabledTests } from '@/hooks/useProjects';
import clsx from 'clsx';

interface Stage {
  key: keyof EnabledTests;
  label: string;
  description: string;
  icon: React.ReactNode;
  requiresPreview: boolean;
  requiresRepo: boolean;
}

const STAGES: Stage[] = [
  {
    key: 'functional',
    label: 'Functional Tests',
    description: 'Page loads, navigation, form validation, responsiveness, keyboard access',
    icon: <MousePointerClick className="w-4 h-4" />,
    requiresPreview: true,
    requiresRepo: false,
  },
  {
    key: 'accessibility',
    label: 'Accessibility (WCAG)',
    description: 'axe-core WCAG 2.1 AA audit — violations, passes, ARIA, contrast',
    icon: <Accessibility className="w-4 h-4" />,
    requiresPreview: true,
    requiresRepo: false,
  },
  {
    key: 'performance',
    label: 'Performance',
    description: 'Lighthouse Core Web Vitals — LCP, CLS, FID, FCP, TTI, TBT',
    icon: <Zap className="w-4 h-4" />,
    requiresPreview: true,
    requiresRepo: false,
  },
  {
    key: 'security',
    label: 'Security Scan',
    description: 'OWASP ZAP passive scan — XSS, injection, headers, cookies',
    icon: <Shield className="w-4 h-4" />,
    requiresPreview: true,
    requiresRepo: false,
  },
  {
    key: 'codeQuality',
    label: 'Code Quality',
    description: 'SonarQube / heuristic — coverage, duplications, bugs, vulnerabilities',
    icon: <Code2 className="w-4 h-4" />,
    requiresPreview: false,
    requiresRepo: true,
  },
];

const ALL_ON: EnabledTests = {
  functional: true, accessibility: true,
  performance: true, security: true, codeQuality: true,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onRun: (enabledTests: EnabledTests) => void;
  isPending: boolean;
  hasPreviewUrl: boolean;
  hasRepoUrl: boolean;
}

export function RunTestsModal({ open, onClose, onRun, isPending, hasPreviewUrl, hasRepoUrl }: Props) {
  const [selected, setSelected] = useState<EnabledTests>({ ...ALL_ON });

  if (!open) return null;

  const toggle = (key: keyof EnabledTests) =>
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));

  const anySelected = Object.values(selected).some(Boolean);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const preset = (tests: Partial<EnabledTests>) =>
    setSelected({ ...ALL_ON, ...Object.fromEntries(Object.keys(ALL_ON).map(k => [k, false])), ...tests });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4 text-brand-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Configure Test Run</h2>
              <p className="text-xs text-slate-500 mt-0.5">Select which tests to execute</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Presets:</span>
          <button
            onClick={() => setSelected({ ...ALL_ON })}
            className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            All tests
          </button>
          <button
            onClick={() => preset({ accessibility: true, performance: true })}
            className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            UI only
          </button>
          <button
            onClick={() => preset({ security: true, codeQuality: true })}
            className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Security only
          </button>
          <button
            onClick={() => preset({ performance: true })}
            className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Perf only
          </button>
        </div>

        {/* Stage list */}
        <div className="px-6 pb-2 space-y-2 max-h-80 overflow-y-auto">
          {STAGES.map((stage) => {
            const disabled = (stage.requiresPreview && !hasPreviewUrl) || (stage.requiresRepo && !hasRepoUrl);
            const isOn = selected[stage.key] && !disabled;

            return (
              <button
                key={stage.key}
                onClick={() => !disabled && toggle(stage.key)}
                disabled={disabled}
                className={clsx(
                  'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                  disabled
                    ? 'border-slate-800 opacity-40 cursor-not-allowed bg-slate-800/20'
                    : isOn
                    ? 'border-brand-500/40 bg-brand-500/8 hover:bg-brand-500/12'
                    : 'border-slate-700/60 bg-slate-800/30 hover:bg-slate-800/60',
                )}
              >
                {/* Checkbox */}
                <div className={clsx(
                  'w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-colors',
                  isOn ? 'bg-brand-500 border-brand-500' : 'border-slate-600',
                )}>
                  {isOn && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>

                {/* Icon + text */}
                <div className={clsx('flex items-center gap-2 flex-shrink-0 mt-0.5', isOn ? 'text-brand-400' : 'text-slate-500')}>
                  {stage.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-sm font-medium', isOn ? 'text-white' : 'text-slate-400')}>
                    {stage.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{stage.description}</p>
                  {disabled && (
                    <p className="text-xs text-amber-500/80 mt-1">
                      {stage.requiresPreview ? 'Requires Preview URL in project settings' : 'Requires Repository URL in project settings'}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {selectedCount} test{selectedCount !== 1 ? 's' : ''} selected
            <span className="text-slate-600 ml-1">+ Report generation always runs</span>
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-sm px-4">
              Cancel
            </button>
            <button
              onClick={() => onRun(selected)}
              disabled={!anySelected || isPending}
              className="btn-primary text-sm px-5 flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5" />
              {isPending ? 'Starting…' : 'Run Selected'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
