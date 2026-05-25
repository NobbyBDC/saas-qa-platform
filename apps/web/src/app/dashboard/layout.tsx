import dynamic from 'next/dynamic';

const DashboardNav = dynamic(() => import('./_nav'), { ssr: false });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[#0a0f1e]">
      <DashboardNav />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Spacer for the absolutely-positioned topbar rendered by DashboardNav */}
        <div className="h-16 flex-shrink-0" />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
