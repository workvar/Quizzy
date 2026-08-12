'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogoMark } from '@/components/Logo';
import AppHeader from '@/components/AppHeader';
import { useAdminData } from '@/logics/useAdminData';
import { QuizzesTab } from '@/components/admin/QuizzesTab';
import { TeamsTab } from '@/components/admin/TeamsTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { LiveControlTab } from '@/components/admin/LiveControlTab';
import { LiveScoresTab } from '@/components/admin/LiveScoresTab';
import { Spinner } from '@/components/admin/AdminUI';

function TabIcon({ children }) {
  return <span className="w-5 h-5">{children}</span>;
}

const TABS = [
  { id: 'quizzes', label: 'Quizzes', icon: <TabIcon><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></TabIcon> },
  { id: 'live', label: 'Live Control', icon: <TabIcon><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></TabIcon> },
  { id: 'scores', label: 'Live Scores', icon: <TabIcon><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></TabIcon> },
  { id: 'teams', label: 'Teams', icon: <TabIcon><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg></TabIcon> },
  { id: 'settings', label: 'Settings', icon: <TabIcon><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg></TabIcon> },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('quizzes');
  const [me, setMe] = useState(null);
  const [savingBanner, setSavingBanner] = useState(false);

  const adminData = useAdminData();

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.type !== 'admin') router.replace('/');
      else setMe(d);
    }).catch(() => router.replace('/'));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  const handleBannerSave = async () => {
    setSavingBanner(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner: adminData.config?.loginBanner || '' }),
      });
    } catch {}
    setSavingBanner(false);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'quizzes': return <QuizzesTab />;
      case 'teams': return <TeamsTab />;
      case 'settings': return <SettingsTab />;
      case 'live': return <LiveControlTab />;
      case 'scores': return <LiveScoresTab />;
      default: return <div>Unknown tab</div>;
    }
  };

  return (
    <>
      <AppHeader
        maxWidthClass="max-w-7xl"
        right={
          <>
            {me && <span className="text-sm text-brand-ink-2 hidden sm:block font-medium">{me.name}</span>}
            <button onClick={handleLogout} className="text-sm text-brand-ink-2 hover:text-brand-orange transition-colors font-medium">Sign Out</button>
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-ink tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-brand-ink-2 mt-0.5">Manage quizzes, teams, and live controls</p>
          </div>
        </div>

        <nav className="mb-8 bg-white border border-brand-line rounded-apple-xl p-1 shadow-apple-sm" role="tablist" aria-label="Admin sections">
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-apple-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-orange text-white shadow-apple-sm'
                  : 'text-brand-ink-2 hover:text-brand-ink hover:bg-brand-mist'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {renderTab()}
      </main>
    </>
  );
}