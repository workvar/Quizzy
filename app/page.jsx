'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MdButton, MdCard, MdTextField, MdChip } from '@awc-ui/react';
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
  }, [router]);

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
    <div className="qz-page relative min-h-screen overflow-hidden">
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="px-6 py-5 flex items-center justify-between">
          <Logo size="sm" href="/" />
          <MdButton variant="text" href="/admin" trailingIcon="arrow_forward">
            Admin
          </MdButton>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 pb-16">
          <div className="w-full max-w-md animate-brand-fade-up">
            <div className="text-center mb-8">
              <div className="inline-flex mb-5 animate-brand-float">
                <LogoMark size="hero" className="shadow-brand rounded-[20px]" />
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">
                Quizzy
              </h1>
              <p className="mt-3 text-base text-[var(--md-sys-color-on-surface-variant)] max-w-sm mx-auto leading-relaxed">
                {tagline}
              </p>
            </div>

            {banner ? (
              <div className="mb-4 flex justify-center">
                <MdChip variant="suggestion" appearance="filled" color="primary" label={banner} />
              </div>
            ) : null}

            <MdCard variant="elevated" fullWidth style={{ padding: '1.75rem' }}>
              {!loginEnabled ? (
                <div className="text-center py-2">
                  <p className="text-sm font-semibold text-[var(--md-sys-color-on-surface)]">Team login is paused</p>
                  <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mt-1">Check back soon or contact the organizers.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <MdTextField
                    variant="outlined"
                    label="Team name"
                    name="teamname"
                    value={teamname}
                    required
                    autocomplete="username"
                    onMdInput={(e) => setTeamname(e.detail ?? '')}
                  />
                  <MdTextField
                    variant="outlined"
                    label="Password"
                    name="password"
                    type="password"
                    value={password}
                    required
                    passwordToggle="internal"
                    autocomplete="current-password"
                    onMdInput={(e) => setPassword(e.detail ?? '')}
                    error={Boolean(error)}
                    errorText={error || undefined}
                    reserveSupportingSpace
                  />
                  <MdButton
                    type="submit"
                    variant="filled"
                    size="md"
                    fullWidth
                    loading={loading}
                    icon="login"
                  >
                    Enter Arena
                  </MdButton>
                </form>
              )}
            </MdCard>

            <p className="mt-6 text-center text-xs text-[var(--md-sys-color-on-surface-variant)]">
              Built for live contests · Powered by Quizzy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
