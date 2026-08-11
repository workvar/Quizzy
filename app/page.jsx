'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo, { LogoMark } from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [teamname, setTeamname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tagline, setTagline] = useState('Live quiz arena for teams. Answer fast, code clean, climb the board.');
  const [banner, setBanner] = useState('');
  const [loginEnabled, setLoginEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.type === 'admin') router.replace('/admin');
      else if (d.type === 'team') router.replace('/contestant');
    }).catch(() => { });
    fetch('/api/config').then(r => r.json()).then(d => {
      if (d.arenaTagline) setTagline(d.arenaTagline);
      if (d.loginBanner) setBanner(d.loginBanner);
      if (d.teamLoginEnabled === false) setLoginEnabled(false);
    }).catch(() => { });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamname: teamname.trim(), password }),
      });
      const data = await res.json();
      if (res.ok) { router.push(data.redirect); return; }
      setError(data.error || 'Invalid credentials');
    } catch {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-mesh">
      <div className="brand-orb w-[28rem] h-[28rem] -top-24 -left-24 bg-brand-orange-soft/50 animate-brand-float" />
      <div className="brand-orb w-[22rem] h-[22rem] bottom-[-6rem] right-[-4rem] bg-brand-orange/30" style={{ animationDelay: '1.2s' }} />

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="px-6 py-5 flex items-center justify-between">
          <Logo size="sm" href="/" />
          <Link
            href="/admin"
            className="text-sm font-semibold text-brand-ink-2 hover:text-brand-orange transition-colors"
          >
            Admin →
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 pb-16">
          <div className="w-full max-w-md animate-brand-fade-up">
            <div className="text-center mb-8">
              <div className="inline-flex mb-5 animate-brand-float">
                <LogoMark size="hero" className="shadow-brand rounded-[20px]" />
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-brand-ink">
                Quizzy
              </h1>
              <p className="mt-3 text-base text-brand-ink-2 max-w-sm mx-auto leading-relaxed">
                {tagline}
              </p>
            </div>

            {banner ? (
              <div className="mb-4 bg-brand-mist border border-orange-200/80 text-brand-orange-deep text-sm rounded-apple px-4 py-2.5 text-center font-medium">
                {banner}
              </div>
            ) : null}

            <div
              className="bg-white/85 backdrop-blur-xl border border-white/70 rounded-apple-xl p-7 sm:p-8"
              style={{ boxShadow: '0 24px 60px rgba(25,27,31,0.10), 0 0 0 1px rgba(255,255,255,0.7) inset' }}
            >
              {!loginEnabled ? (
                <div className="text-center py-2">
                  <p className="text-sm font-semibold text-brand-ink">Team login is paused</p>
                  <p className="text-sm text-brand-ink-2 mt-1">Check back soon or contact the organizers.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-ink-2 uppercase tracking-wide mb-1.5">Team Name</label>
                    <input
                      type="text"
                      value={teamname}
                      onChange={e => setTeamname(e.target.value)}
                      placeholder="e.g. TeamAlpha"
                      required
                      className="w-full px-4 py-2.5 bg-brand-surface border border-brand-line rounded-apple text-brand-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent placeholder-brand-ink-3 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-ink-2 uppercase tracking-wide mb-1.5">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-2.5 bg-brand-surface border border-brand-line rounded-apple text-brand-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent placeholder-brand-ink-3 transition-all"
                    />
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-orange text-white font-semibold py-3 rounded-apple text-sm hover:bg-brand-orange-deep active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-brand"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg>
                        Authenticating…
                      </>
                    ) : 'Enter Arena'}
                  </button>
                </form>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-brand-ink-3">
              Built for live contests · Powered by Quizzy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
