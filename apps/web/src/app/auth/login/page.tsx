'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers } from 'lucide-react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('access_token', data.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Invalid email or password');
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
            <h1 className="text-2xl font-bold text-white">Sign in</h1>
            <p className="text-slate-400 text-sm mt-1">Welcome back to your QA workspace</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-slate-400 text-center">
            No account?{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
