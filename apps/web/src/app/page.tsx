import Link from 'next/link';
import { ArrowRight, Layers, Shield, Zap, Eye, Code2, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: Layers,
    title: 'Figma → Code',
    description: 'Automatically convert Figma designs into production-ready React components with Tailwind CSS.',
  },
  {
    icon: Eye,
    title: 'Visual Regression',
    description: 'Pixel-perfect comparison between your rendered UI and Figma designs with diff highlighting.',
  },
  {
    icon: Shield,
    title: 'Security Scanning',
    description: 'OWASP ZAP integration to detect XSS, SQL injection, CSRF, and 40+ other vulnerabilities.',
  },
  {
    icon: Zap,
    title: 'Performance Testing',
    description: 'Automated Lighthouse CI runs tracking LCP, CLS, TTI and all Core Web Vitals.',
  },
  {
    icon: Code2,
    title: 'Code Quality',
    description: 'SonarQube-powered static analysis for code smells, duplication, and security vulnerabilities.',
  },
  {
    icon: BarChart3,
    title: 'Unified Reports',
    description: 'Single QA report combining all test results with AI-suggested fixes and Jira integration.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">QA Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="btn-ghost text-sm">Sign in</Link>
            <Link href="/auth/register" className="btn-primary text-sm">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          Design → Deploy, fully automated
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight">
          One platform for{' '}
          <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            end-to-end QA
          </span>
        </h1>
        <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-10">
          From Figma design to deployed code — automated visual regression, accessibility,
          performance, security scanning, and AI-powered code generation in a single workflow.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/register" className="btn-primary text-base px-8 py-3">
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/dashboard" className="btn-secondary text-base px-8 py-3">
            View demo
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="card p-6 card-hover group">
              <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <feature.icon className="w-5 h-5 text-brand-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline visual */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">The automated pipeline</h2>
        <div className="flex flex-wrap justify-center gap-4 items-center">
          {['Figma URL', '→', 'Code Gen', '→', 'Preview Deploy', '→', 'Test Suite', '→', 'QA Report', '→', 'Jira Tickets'].map((step, i) => (
            step === '→' ? (
              <ArrowRight key={i} className="w-5 h-5 text-slate-500" />
            ) : (
              <div key={step} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium text-slate-200">
                {step}
              </div>
            )
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800 px-6 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} QA Platform. Built for modern engineering teams.
      </footer>
    </div>
  );
}
