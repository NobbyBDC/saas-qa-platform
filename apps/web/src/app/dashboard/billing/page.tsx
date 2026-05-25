'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CreditCard, Zap, Building2, Check, AlertTriangle,
  TrendingUp, Clock, FileText, ExternalLink, ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '@/lib/api';

const PLANS = [
  {
    key: 'FREE',
    name: 'Free',
    price: 0,
    color: 'slate',
    features: ['3 projects', '50 runs/month', '1 GB storage', 'Community support'],
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: 49,
    color: 'brand',
    badge: 'Most Popular',
    features: ['25 projects', '1,000 runs/month', '50 GB storage', 'API access', 'Priority support', '14-day trial'],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    price: null,
    color: 'purple',
    features: ['Unlimited projects', 'Unlimited runs', '500 GB storage', 'API access', 'SSO/SAML', 'Dedicated support', 'SLA guarantee'],
  },
];

export default function BillingPage() {
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => apiClient.get('/billing/status').then(r => r.data),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) =>
      apiClient.post('/billing/checkout', {
        plan,
        successUrl: `${window.location.origin}/dashboard/billing?success=1`,
        cancelUrl: `${window.location.origin}/dashboard/billing`,
      }).then(r => r.data),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/billing/portal', { returnUrl: window.location.href }).then(r => r.data),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  if (isLoading) return <BillingSkeleton />;

  const { plan, planStatus, trialEndsAt, limits, usage, invoices } = status ?? {};
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Billing</h2>
          <p className="text-slate-400 text-sm mt-1">Manage your subscription and usage</p>
        </div>
        {plan !== 'FREE' && (
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Manage Billing
          </button>
        )}
      </div>

      {/* Trial banner */}
      {planStatus === 'trialing' && trialDaysLeft !== null && (
        <div className="card border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-amber-300 font-medium">Trial ends in {trialDaysLeft} days</p>
            <p className="text-amber-400/80 text-sm">Add a payment method to keep your Pro features.</p>
          </div>
          <button onClick={() => checkoutMutation.mutate('PRO')} className="ml-auto btn-primary text-sm">
            Upgrade Now
          </button>
        </div>
      )}

      {/* Usage cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UsageCard
          label="Runs this month"
          used={usage?.runs ?? 0}
          limit={limits?.runsPerMonth ?? 50}
          icon={TrendingUp}
        />
        <UsageCard
          label="API calls"
          used={usage?.apiCalls ?? 0}
          limit={limits?.apiAccessEnabled ? 10000 : 0}
          icon={Zap}
          locked={!limits?.apiAccessEnabled}
        />
        <UsageCard
          label="Storage used"
          used={usage?.storageMb ?? 0}
          limit={(limits?.storageGb ?? 1) * 1024}
          icon={FileText}
          unit="MB"
        />
      </div>

      {/* Plans */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(p => (
            <PlanCard
              key={p.key}
              plan={p}
              currentPlan={plan}
              onUpgrade={() => {
                setUpgrading(p.key);
                checkoutMutation.mutate(p.key);
              }}
              loading={upgrading === p.key && checkoutMutation.isPending}
            />
          ))}
        </div>
      </div>

      {/* Invoices */}
      {invoices?.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Invoices</h3>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-4 text-slate-400 font-medium">Period</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Amount</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 text-slate-300">
                      {new Date(inv.period.start).toLocaleDateString()} – {new Date(inv.period.end).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-white font-medium">
                      ${(inv.amount).toFixed(2)} {inv.currency.toUpperCase()}
                    </td>
                    <td className="p-4">
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        inv.status === 'PAID' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400',
                      )}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {inv.pdfUrl && (
                        <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-brand-400 hover:text-brand-300 flex items-center gap-1">
                          PDF <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function UsageCard({ label, used, limit, icon: Icon, locked, unit = '' }: any) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const color = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'success';
  const colorMap: Record<string, string> = {
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    success: 'bg-brand-500',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-sm">{label}</span>
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      {locked ? (
        <p className="text-slate-500 text-sm">Upgrade to unlock</p>
      ) : (
        <>
          <p className="text-white font-bold text-xl">{used}{unit} <span className="text-slate-500 text-sm font-normal">/ {limit}{unit}</span></p>
          <div className="h-1.5 bg-slate-700 rounded-full mt-3 overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all', colorMap[color])} style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

function PlanCard({ plan, currentPlan, onUpgrade, loading }: any) {
  const isCurrent = plan.key === currentPlan;
  const colorMap: Record<string, string> = {
    slate: 'border-slate-700',
    brand: 'border-brand-500/60',
    purple: 'border-purple-500/60',
  };

  return (
    <div className={clsx('card p-6 relative flex flex-col', colorMap[plan.color], isCurrent && 'ring-1 ring-brand-500/40')}>
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs px-3 py-1 rounded-full">
          {plan.badge}
        </span>
      )}
      <div className="mb-4">
        <h4 className="text-white font-bold text-lg">{plan.name}</h4>
        <div className="mt-1">
          {plan.price !== null ? (
            <span className="text-3xl font-bold text-white">${plan.price}<span className="text-slate-400 text-base font-normal">/mo</span></span>
          ) : (
            <span className="text-slate-400">Contact sales</span>
          )}
        </div>
      </div>
      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f: string) => (
          <li key={f} className="flex items-center gap-2 text-slate-300 text-sm">
            <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> {f}
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <span className="text-center text-sm text-slate-400 border border-slate-700 rounded-lg py-2">Current Plan</span>
      ) : plan.key === 'ENTERPRISE' ? (
        <a href="mailto:sales@qaplatform.io" className="btn-secondary text-center text-sm">Contact Sales</a>
      ) : (
        <button onClick={onUpgrade} disabled={loading} className="btn-primary w-full text-sm">
          {loading ? 'Redirecting...' : `Upgrade to ${plan.name}`}
          {!loading && <ChevronUp className="w-4 h-4 ml-1" />}
        </button>
      )}
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 bg-slate-700 rounded w-48" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="card p-4 h-28 bg-slate-800" />)}
      </div>
    </div>
  );
}
