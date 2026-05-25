'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, BarChart3, Settings,
  Bell, LogOut, Layers, Moon, Sun, User,
  CreditCard, Plug, Bot, Activity, Shield,
  Building2, Users, Play, ShieldCheck,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview', exact: true },
  { href: '/dashboard/projects', icon: FolderKanban, label: 'Projects' },
  { href: '/dashboard/reports', icon: BarChart3, label: 'Reports' },
];

const navSections = [
  {
    title: 'Automation',
    items: [
      { href: '/dashboard/copilot', icon: Bot, label: 'AI Copilot', badge: 'NEW' },
      { href: '/dashboard/observability', icon: Activity, label: 'Observability' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/dashboard/integrations', icon: Plug, label: 'Integrations' },
      { href: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
      { href: '/dashboard/audit', icon: Shield, label: 'Audit Logs' },
      { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

const adminSection = {
  title: 'Super Admin',
  items: [
    { href: '/dashboard/admin', icon: ShieldCheck, label: 'Platform Stats', exact: true },
    { href: '/dashboard/admin/organizations', icon: Building2, label: 'Organizations' },
    { href: '/dashboard/admin/users', icon: Users, label: 'All Users' },
    { href: '/dashboard/admin/runs', icon: Play, label: 'All Runs' },
  ],
};

export default function DashboardNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const user = getUser();
    setIsSuperAdmin(user?.isSuperAdmin ?? false);
  }, []);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const allItems = [
    ...navItems,
    ...navSections.flatMap(s => s.items),
    ...(isSuperAdmin ? adminSection.items : []),
  ];
  const currentPageLabel = allItems.find(n => isActive(n.href, (n as any).exact))?.label ?? 'Dashboard';

  return (
    <>
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-slate-800 flex flex-col overflow-y-auto">
        <div className="h-16 px-4 flex items-center gap-2 border-b border-slate-800 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-sm">QA Platform</span>
            <div className="text-xs text-brand-400">Enterprise</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, icon: Icon, label, exact }) => (
            <NavLink key={href} href={href} icon={Icon} label={label} active={isActive(href, exact)} />
          ))}

          {navSections.map(section => (
            <div key={section.title} className="mt-4">
              <p className="px-3 py-1 text-xs font-medium text-slate-600 uppercase tracking-wider">
                {section.title}
              </p>
              <div className="space-y-0.5 mt-1">
                {section.items.map(({ href, icon: Icon, label, badge }: any) => (
                  <NavLink key={href} href={href} icon={Icon} label={label} active={isActive(href)} badge={badge} />
                ))}
              </div>
            </div>
          ))}

          {isSuperAdmin && (
            <div className="mt-4">
              <p className="px-3 py-1 text-xs font-medium text-red-500/70 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Super Admin
              </p>
              <div className="space-y-0.5 mt-1">
                {adminSection.items.map(({ href, icon: Icon, label, exact }: any) => (
                  <NavLink key={href} href={href} icon={Icon} label={label} active={isActive(href, exact)} danger />
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-0.5 flex-shrink-0">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <Link
            href="/auth/login"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Link>
        </div>
      </aside>

      {/* Top bar — absolutely positioned so it sits above the main content */}
      <div className="absolute top-0 right-0 left-60 h-16 border-b border-slate-800 px-6 flex items-center justify-between z-10 bg-[#0a0f1e]">
        <h1 className="text-slate-100 font-semibold">{currentPageLabel}</h1>
        <div className="flex items-center gap-3">
          <button className="relative w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-500 rounded-full" />
          </button>
          <button className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function NavLink({ href, icon: Icon, label, active, badge, danger }: {
  href: string; icon: any; label: string; active: boolean; badge?: string; danger?: boolean;
}) {
  const base = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
  const activeClass = danger
    ? 'bg-red-600/20 text-red-300 border border-red-500/20'
    : 'bg-brand-600/20 text-brand-300 border border-brand-500/20';
  const inactiveClass = danger
    ? 'text-red-400/70 hover:text-red-300 hover:bg-red-500/10'
    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800';

  return (
    <Link href={href} className={`${base} ${active ? activeClass : inactiveClass}`}>
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-xs bg-purple-600/40 text-purple-300 px-1.5 py-0.5 rounded font-normal">
          {badge}
        </span>
      )}
    </Link>
  );
}
