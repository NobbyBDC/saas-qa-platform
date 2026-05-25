import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
  trend?: { value: number; label: string };
}

const colorMap = {
  brand:   { bg: 'bg-brand-500/10',   text: 'text-brand-400',   border: 'border-brand-500/20' },
  success: { bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/20' },
  warning: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20' },
  danger:  { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20' },
  info:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
};

export function StatsCard({ title, value, icon: Icon, color, subtitle, trend }: StatsCardProps) {
  const c = colorMap[color];
  return (
    <div className="card p-5 card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{title}</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold text-white">{value}</p>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          {trend && (
            <p className={clsx('text-xs mt-1', trend.value >= 0 ? 'text-green-400' : 'text-red-400')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center border', c.bg, c.border)}>
          <Icon className={clsx('w-5 h-5', c.text)} />
        </div>
      </div>
    </div>
  );
}
