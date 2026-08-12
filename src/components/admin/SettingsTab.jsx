'use client';
import { useState, useEffect, useCallback } from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useConfirm } from '@/components/DialogProvider';
import { Spinner } from './AdminUI';

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-3 w-full text-left">
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${on ? 'bg-apple-blue' : 'bg-apple-gray-3'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
      <span className="text-sm text-apple-text font-medium">{label}</span>
    </button>
  );
}

export function SettingsTab() {
  const confirm = useConfirm();
  const [config, setConfig] = useState({
    contestEndTime: '',
    contestStartTime: '',
    pointsPerQuestion: 10,
    allowLateSubmit: false,
    teamLoginEnabled: true,
    arenaTagline: '',
    loginBanner: '',
  });
  const [stats, setStats] = useState(null);
  const [pistonUrl, setPistonUrl] = useState('');
  const [pistonStatus, setPistonStatus] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPassword2, setAdminPassword2] = useState('');
  const [teams, setTeams] = useState([]);
  const [message, setMessage] = useState('');
  const [messageTo, setMessageTo] = useState('everyone');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgSent, setMsgSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([
        fetch('/api/admin/settings').then(r => r.json()),
        fetch('/api/admin/teams').then(r => r.json()),
      ]);
      setConfig({
        contestEndTime: d.contestEndTime ? new Date(d.contestEndTime).toISOString().slice(0, 16) : '',
        contestStartTime: d.contestStartTime ? new Date(d.contestStartTime).toISOString().slice(0, 16) : '',
        pointsPerQuestion: d.pointsPerQuestion || 10,
        allowLateSubmit: !!d.allowLateSubmit,
        teamLoginEnabled: d.teamLoginEnabled !== false,
        arenaTagline: d.arenaTagline || '',
        loginBanner: d.loginBanner || '',
      });
      setStats(d.stats || null);
      setPistonUrl(d.pistonUrl || '');
      if (Array.isArray(t)) setTeams(t.filter(x => !x.isBanned));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError(''); setSaving(true); setSaved(false);
    if (adminPassword && adminPassword !== adminPassword2) {
      setError('Admin password confirmation does not match');
      setSaving(false);
      return;
    }
    try {
      const body = {
        contestEndTime: config.contestEndTime ? new Date(config.contestEndTime).toISOString() : '',
        contestStartTime: config.contestStartTime ? new Date(config.contestStartTime).toISOString() : '',
        pointsPerQuestion: parseInt(config.pointsPerQuestion) || 10,
        allowLateSubmit: config.allowLateSubmit,
        teamLoginEnabled: config.teamLoginEnabled,
        arenaTagline: config.arenaTagline,
        loginBanner: config.loginBanner,
      };
      if (adminPassword) body.adminPassword = adminPassword;
      const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return; }
      setSaved(true);
      setAdminPassword('');
      setAdminPassword2('');
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const runAction = async (action, extra = {}) => {
    setError('');
    setActionBusy(action);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Action failed'); setActionBusy(''); return data; }
      if (action === 'checkPiston') {
        setPistonStatus(data);
      } else {
        await load();
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
      setActionBusy('');
      return data;
    } catch {
      setError('Network error');
      setActionBusy('');
      return null;
    }
  };

  const sendBroadcast = async () => {
    if (!message.trim()) return;
    setSendingMsg(true); setMsgSent(false); setError('');
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.trim(), to: messageTo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send'); setSendingMsg(false); return; }
      setMessage('');
      setMsgSent(true);
      setTimeout(() => setMsgSent(false), 2500);
    } catch { setError('Network error'); }
    setSendingMsg(false);
  };

  const dangerAction = async (action, title, msg) => {
    const ok = await confirm({ title, message: msg, confirmLabel: 'Continue', tone: 'danger' });
    if (!ok) return;
    const data = await runAction(action);
    if (data?.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={8} /></div>;

  const endMs = config.contestEndTime ? new Date(config.contestEndTime).getTime() : null;
  const contestEnded = endMs && !Number.isNaN(endMs) && Date.now() > endMs;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-apple-text tracking-tight">Settings</h2>
        <p className="text-sm text-apple-text-2 mt-0.5">Contest timing, access, messaging, and ops controls</p>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
      {saved && <div className="mb-4 bg-green-50 border border-green-200 text-apple-green text-sm rounded-apple px-4 py-2.5 font-semibold">Settings saved.</div>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            ['Teams', stats.teams],
            ['Banned', stats.bannedTeams],
            ['Quizzes', stats.quizzes],
            ['Questions', stats.questions],
            ['Answers', stats.answers],
            ['Live quiz', stats.activeQuizTitle || '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-apple-gray-2 rounded-apple-lg p-3 shadow-apple-sm min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-apple-text-3">{label}</p>
              <p className="text-sm font-bold text-apple-text truncate mt-1" title={String(value)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Contest timing */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-apple-text">Contest timing</h3>
              <p className="text-xs text-apple-text-3 mt-0.5">Countdown + submission window</p>
            </div>
            {contestEnded ? (
              <span className="text-xs font-semibold text-apple-red bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">Ended</span>
            ) : config.contestEndTime ? (
              <span className="text-xs font-semibold text-apple-green bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">Scheduled</span>
            ) : (
              <span className="text-xs font-semibold text-apple-text-3 bg-apple-gray border border-apple-gray-2 px-2 py-0.5 rounded-md">No end</span>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Start time (optional)</label>
            <input type="datetime-local" value={config.contestStartTime} onChange={e => setConfig(prev => ({ ...prev, contestStartTime: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">End time</label>
            <input type="datetime-local" value={config.contestEndTime} onChange={e => setConfig(prev => ({ ...prev, contestEndTime: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <Toggle
            on={config.allowLateSubmit}
            onChange={v => setConfig(prev => ({ ...prev, allowLateSubmit: v }))}
            label="Allow submissions after contest end"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => runAction('endContestNow')} disabled={!!actionBusy} className="text-xs font-semibold px-3 py-1.5 rounded-apple bg-apple-red text-white hover:bg-red-600 disabled:opacity-50">End now</button>
            <button type="button" onClick={() => runAction('extendContest', { minutes: 30 })} disabled={!!actionBusy} className="text-xs font-semibold px-3 py-1.5 rounded-apple bg-apple-gray border border-apple-gray-2 text-apple-text hover:border-apple-blue disabled:opacity-50">+30 min</button>
            <button type="button" onClick={() => runAction('extendContest', { minutes: 60 })} disabled={!!actionBusy} className="text-xs font-semibold px-3 py-1.5 rounded-apple bg-apple-gray border border-apple-gray-2 text-apple-text hover:border-apple-blue disabled:opacity-50">+60 min</button>
            <button type="button" onClick={() => runAction('clearContestEnd')} disabled={!!actionBusy} className="text-xs font-semibold px-3 py-1.5 rounded-apple bg-apple-gray border border-apple-gray-2 text-apple-text hover:border-apple-blue disabled:opacity-50">Clear end</button>
          </div>
        </div>

        {/* Access & scoring */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-text">Access & scoring</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Defaults applied to new quizzes and logins</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Default points per question</label>
            <input type="number" min="1" max="1000" value={config.pointsPerQuestion} onChange={e => setConfig(prev => ({ ...prev, pointsPerQuestion: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <Toggle
            on={config.teamLoginEnabled}
            onChange={v => setConfig(prev => ({ ...prev, teamLoginEnabled: v }))}
            label="Allow team login"
          />
          <div className="pt-2 border-t border-apple-gray-2 space-y-3">
            <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Admin password</p>
            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="New password (leave blank to keep)" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
            <input type="password" value={adminPassword2} onChange={e => setAdminPassword2(e.target.value)} placeholder="Confirm new password" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-text">Login branding</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Shown on the contestant login page</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Arena tagline</label>
            <textarea rows={2} value={config.arenaTagline} onChange={e => setConfig(prev => ({ ...prev, arenaTagline: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-y" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Banner message (optional)</label>
            <input value={config.loginBanner} onChange={e => setConfig(prev => ({ ...prev, loginBanner: e.target.value }))} placeholder="e.g. Round 2 starts at 4:00 PM" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>

        {/* Broadcast */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-text">Broadcast message</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Push a toast to contestant screens</p>
          </div>
          {msgSent && <div className="bg-green-50 border border-green-200 text-apple-green text-sm rounded-apple px-3 py-2 font-semibold">Message sent.</div>}
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Send to</label>
            <SearchableSelect
              value={messageTo}
              onChange={setMessageTo}
              options={[
                { value: 'everyone', label: 'Everyone' },
                ...teams.map(t => ({ value: `team-${t.id}`, label: t.name })),
              ]}
              placeholder="Everyone"
              searchPlaceholder="Search teams…"
            />
          </div>
          <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Message to teams…" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-y" />
          <button type="button" onClick={sendBroadcast} disabled={sendingMsg || !message.trim()} className="flex items-center gap-2 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-brand-orange-deep disabled:opacity-50">
            {sendingMsg && <Spinner size={4} />}Send message
          </button>
        </div>

        {/* Code runner */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-text">Code execution</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Piston runner used for coding questions</p>
          </div>
          <div className="text-sm text-apple-text-2 break-all">
            <span className="text-xs font-semibold uppercase tracking-wide text-apple-text-3 block mb-1">PISTON_URL</span>
            {pistonUrl || 'http://localhost:2000'}
          </div>
          <button type="button" onClick={() => runAction('checkPiston')} disabled={actionBusy === 'checkPiston'} className="flex items-center gap-2 text-sm font-semibold text-apple-text bg-apple-gray border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue disabled:opacity-50">
            {actionBusy === 'checkPiston' && <Spinner size={4} />}Check connection
          </button>
          {pistonStatus && (
            <div className={`text-sm rounded-apple px-3 py-2 border ${pistonStatus.ok ? 'bg-green-50 border-green-200 text-apple-green' : 'bg-red-50 border-red-200 text-apple-red'}`}>
              {pistonStatus.ok
                ? `Online · ${pistonStatus.runtimeCount} runtime(s)`
                : `Offline · ${pistonStatus.error || `HTTP ${pistonStatus.status}`}`}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="bg-white border border-red-200 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-red">Danger zone</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Affects the currently active quiz only</p>
          </div>
          <button
            type="button"
            onClick={() => dangerAction('unreleaseAllActive', 'Unrelease all questions?', 'All released questions on the active quiz will be hidden from contestants.')}
            disabled={!!actionBusy}
            className="w-full text-sm font-semibold text-apple-red bg-red-50 border border-red-200 px-4 py-2.5 rounded-apple hover:bg-red-100 disabled:opacity-50"
          >
            Unrelease all active-quiz questions
          </button>
          <button
            type="button"
            onClick={() => dangerAction('clearAnswersActive', 'Clear all answers?', 'Deletes every team submission for the active quiz. This cannot be undone.')}
            disabled={!!actionBusy}
            className="w-full text-sm font-semibold text-apple-red bg-red-50 border border-red-200 px-4 py-2.5 rounded-apple hover:bg-red-100 disabled:opacity-50"
          >
            Clear all answers on active quiz
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-apple-blue text-white font-semibold px-6 py-2.5 rounded-apple text-sm hover:bg-brand-orange-deep transition-colors disabled:opacity-50">
          {saving && <Spinner size={4} />}{saving ? 'Saving…' : 'Save Settings'}
        </button>
        <button onClick={load} className="text-sm font-semibold text-apple-text-2 hover:text-apple-blue">Reset form</button>
      </div>
    </div>
  );
}