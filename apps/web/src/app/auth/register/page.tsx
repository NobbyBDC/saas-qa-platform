'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers } from 'lucide-react';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      localStorage.setItem('access_token', data.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-white">QA Platform</span>
        </div>

        <div className="card p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Create account</h1>
            <p className="text-slate-400 text-sm mt-1">Start automating your QA workflow</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Full name</label>
              <input
                type="text"
                required
                minLength={2}
                value={form.name}
                onChange={set('name')}
                placeholder="Jane Smith"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={set('email')}
                placeholder="you@company.com"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={set('password')}
                placeholder="Min. 8 characters"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Organization <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={form.organizationName}
                onChange={set('organizationName')}
                placeholder="Acme Corp"
                className="input"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-slate-400 text-center">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brand-400 hover:text-brand-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
