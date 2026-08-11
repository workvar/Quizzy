'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Countdown from '@/components/Countdown';
import NotificationBanner from '@/components/NotificationBanner';
import AppHeader from '@/components/AppHeader';

function QuestionCard({ q, index }) {
  const status = q.answered ? (q.isCorrect ? 'correct' : 'wrong') : 'pending';
  const cardClass = {
    correct: 'border-green-200 bg-green-50/50',
    wrong: 'border-red-200 bg-red-50/50',
    pending: 'border-apple-gray-2 bg-white',
  }[status];
  const dotClass = {
    correct: 'bg-apple-green',
    wrong: 'bg-apple-red',
    pending: 'bg-apple-gray-4',
  }[status];
  const statusLabel = { correct: 'Correct', wrong: 'Incorrect', pending: 'Not attempted' }[status];

  const stripped = q.title.replace(/[#*`_~\[\]()]/g, '').trim();
  const preview = stripped.length > 85 ? stripped.slice(0, 85) + '…' : stripped;

  return (
    <a href={`/contestant/question?id=${q.id}`} className="block group">
      <div className={`card-hover rounded-apple-lg border p-5 ${cardClass} cursor-pointer h-full`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-apple-text-3 uppercase tracking-wide mb-1.5">Question {index + 1}</p>
            <p className="text-sm font-semibold text-apple-text leading-snug">{preview}</p>
          </div>
          <svg className="w-4 h-4 text-apple-gray-5 group-hover:text-apple-blue transition-colors flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`}/>
            <span className="text-xs text-apple-text-2">{statusLabel}</span>
            {q.isMultiAnswer && <span className="text-xs bg-purple-100 text-purple-600 font-semibold px-2 py-0.5 rounded-full">Multi-select</span>}
          </div>
          {q.answered && (
            <span className={`text-xs font-semibold ${q.isCorrect ? 'text-apple-green' : 'text-apple-red'}`}>
              {q.score !== null ? `+${q.score} pts` : ''}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

function MessageToast({ messages, onDismiss }) {
  if (!messages.length) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-md px-4">
      {messages.map(m => (
        <div key={m.id} className="notify-in bg-white border border-apple-gray-2 rounded-apple-md shadow-apple-lg px-4 py-3 flex items-start gap-3 pointer-events-auto">
          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-apple-blue uppercase tracking-wide">Admin Message</p>
            <p className="text-sm text-apple-text mt-0.5 break-words">{m.content}</p>
          </div>
          <button onClick={() => onDismiss(m.id)} className="text-apple-text-3 hover:text-apple-text flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ContestantHome() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);

  const loadQuestions = useCallback(async () => {
    try {
      const data = await fetch('/api/questions').then(r => r.json());
      if (!Array.isArray(data)) return;
      setQuestions(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.type !== 'team') { router.replace('/'); return; }
      setMe(d);
    }).catch(() => router.replace('/'));

    fetch('/api/config').then(r => r.json()).then(d => setEndTime(d.contestEndTime));
    loadQuestions().then(() => setLoading(false));

    const interval = setInterval(loadQuestions, 15000);
    return () => clearInterval(interval);
  }, []);

  // Socket for admin messages, banish, and section toggles
  useEffect(() => {
    if (!me) return;
    let socket;
    import('socket.io-client').then(({ io }) => {
      socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
      socket.on('connect', () => {
        socket.emit('team:join', { teamId: me.teamId });
      });
      socket.on('message:received', (data) => {
        const id = Date.now();
        setMessages(prev => [...prev, { id, content: data.content }]);
        setTimeout(() => setMessages(prev => prev.filter(m => m.id !== id)), 10000);
      });
      socket.on('quiz:banished', () => {
        router.replace('/?banished=1');
      });
      socket.on('section:toggled', () => {
        loadQuestions();
      });
    });
    return () => socket?.disconnect();
  }, [me?.teamId]);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  const answered = questions.filter(q => q.answered).length;
  const correct = questions.filter(q => q.isCorrect).length;
  const totalScore = questions.reduce((sum, q) => sum + (q.score || 0), 0);

  // Group questions by section (null = no section)
  const hasSections = questions.some(q => q.sectionId !== null);
  const questionGroups = hasSections ? (() => {
    const groups = [];
    const seen = {};
    for (const q of questions) {
      const key = q.sectionId ?? 'none';
      if (!seen[key]) {
        seen[key] = { sectionId: q.sectionId, sectionName: q.sectionName, questions: [] };
        groups.push(seen[key]);
      }
      seen[key].questions.push(q);
    }
    return groups;
  })() : null;

  return (
    <>
      <NotificationBanner />
      <MessageToast messages={messages} onDismiss={id => setMessages(prev => prev.filter(m => m.id !== id))} />
      <AppHeader
        href="/contestant"
        maxWidthClass="max-w-5xl"
        right={
          <>
            {me && <span className="text-sm text-brand-ink-2 hidden sm:block font-medium">{me.teamName}</span>}
            {endTime && <Countdown endTime={endTime} />}
            <button onClick={logout} className="text-sm text-brand-ink-2 hover:text-brand-orange transition-colors font-medium">Sign Out</button>
          </>
        }
      />

      <main className="max-w-5xl mx-auto px-5 py-8">
        {/* Stats bar */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-ink tracking-tight">Questions</h1>
            {!loading && <p className="text-sm text-brand-ink-2 mt-0.5">{answered}/{questions.length} answered · {correct} correct</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-brand-line rounded-apple px-4 py-2 shadow-apple-sm">
              <p className="text-xs text-brand-ink-3 font-semibold uppercase tracking-wide">Score</p>
              <p className="text-xl font-bold font-mono text-brand-orange">{totalScore}</p>
            </div>
            <button onClick={loadQuestions} className="p-2 text-brand-ink-3 hover:text-brand-orange transition-colors" title="Refresh">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-apple-blue" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-14 h-14 mx-auto mb-4 rounded-apple-xl bg-brand-mist border border-orange-200/70 flex items-center justify-center text-brand-orange">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-brand-ink mb-2">No questions yet</h3>
            <p className="text-sm text-brand-ink-2">Questions will appear here when released by the admin.</p>
          </div>
        ) : questionGroups ? (
          <div className="space-y-8">
            {questionGroups.map(group => (
              <div key={group.sectionId ?? 'none'}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-base font-bold text-apple-text tracking-tight">
                    {group.sectionName ?? 'General'}
                  </h2>
                  <span className="text-xs text-apple-text-3">{group.questions.length} question{group.questions.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1 h-px bg-apple-gray-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.questions.map((q, i) => <QuestionCard key={q.id} q={q} index={i} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {questions.map((q, i) => <QuestionCard key={q.id} q={q} index={i} />)}
          </div>
        )}
      </main>
    </>
  );
}
