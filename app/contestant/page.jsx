'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MdCard,
  MdChip,
  MdIconButton,
  MdLoadingIndicator,
  MdSnackbar,
} from '@awc-ui/react';
import Countdown from '@/components/Countdown';
import NotificationBanner from '@/components/NotificationBanner';
import AppHeader, { HeaderAction } from '@/components/AppHeader';

function QuestionCard({ q, index }) {
  const status = q.answered ? (q.isCorrect ? 'correct' : 'wrong') : 'pending';
  const statusLabel = { correct: 'Correct', wrong: 'Incorrect', pending: 'Not attempted' }[status];
  const chipColor = { correct: 'tertiary', wrong: 'error', pending: undefined }[status];

  const stripped = q.title.replace(/[#*`_~\[\]()]/g, '').trim();
  const preview = stripped.length > 85 ? stripped.slice(0, 85) + '…' : stripped;

  return (
    <MdCard
      variant="outlined"
      interactive
      fullWidth
      fullHeight
      onMdClick={() => { window.location.href = `/contestant/question?id=${q.id}`; }}
      style={{ padding: '1.25rem', cursor: 'pointer' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide mb-1.5">
            {q.quizTitle ? `${q.quizTitle} · ` : ''}Question {index + 1}
          </p>
          <p className="text-sm font-semibold text-[var(--md-sys-color-on-surface)] leading-snug">{preview}</p>
        </div>
        <span className="material-symbols-outlined text-[var(--md-sys-color-outline)] text-lg">chevron_right</span>
      </div>
      <div className="flex items-center justify-between mt-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <MdChip
            variant="suggestion"
            appearance="filled"
            color={chipColor}
            label={statusLabel}
            density="-2"
          />
          {q.isMultiAnswer ? (
            <MdChip variant="suggestion" appearance="outlined" color="tertiary" label="Multi-select" density="-2" />
          ) : null}
        </div>
        {q.answered && q.score !== null ? (
          <span className={`text-xs font-semibold ${q.isCorrect ? 'text-[var(--md-sys-color-tertiary)]' : 'text-[var(--md-sys-color-error)]'}`}>
            +{q.score} pts
          </span>
        ) : null}
      </div>
    </MdCard>
  );
}

function MessageToast({ messages, onDismiss }) {
  const current = messages[0];
  if (!current) return null;
  return (
    <MdSnackbar
      open
      position="bottom"
      autoHideDuration={10000}
      closeable
      onMdClose={() => onDismiss(current.id)}
    >
      Admin: {current.content}
    </MdSnackbar>
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
  }, [loadQuestions, router]);

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
  }, [me, loadQuestions, router]);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  const answered = questions.filter(q => q.answered).length;
  const correct = questions.filter(q => q.isCorrect).length;
  const totalScore = questions.reduce((sum, q) => sum + (q.score || 0), 0);

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
    <div className="qz-surface min-h-screen">
      <NotificationBanner />
      <MessageToast messages={messages} onDismiss={id => setMessages(prev => prev.filter(m => m.id !== id))} />
      <AppHeader
        href="/contestant"
        maxWidthClass="max-w-5xl"
        right={
          <>
            {me && (
              <span className="text-sm text-[var(--md-sys-color-on-surface-variant)] hidden sm:block font-medium">
                {me.teamName}
              </span>
            )}
            {endTime && <Countdown endTime={endTime} />}
            <HeaderAction onClick={logout} icon="logout">Sign Out</HeaderAction>
          </>
        }
      />

      <main className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">Questions</h1>
            {!loading && (
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                {answered}/{questions.length} answered · {correct} correct
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <MdCard variant="filled" style={{ padding: '0.65rem 1rem' }}>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-semibold uppercase tracking-wide">Score</p>
              <p className="text-xl font-bold font-mono text-[var(--md-sys-color-primary)]">{totalScore}</p>
            </MdCard>
            <MdIconButton icon="refresh" aria-label="Refresh questions" onMdClick={loadQuestions} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <MdLoadingIndicator size="lg" />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-[var(--md-sys-color-primary)] mb-4 block">lock</span>
            <h3 className="font-display text-lg font-semibold text-[var(--md-sys-color-on-surface)] mb-2">No questions yet</h3>
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Questions will appear here when released by the admin.</p>
          </div>
        ) : questionGroups ? (
          <div className="space-y-8">
            {questionGroups.map(group => (
              <div key={group.sectionId ?? 'none'}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-base font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">
                    {group.sectionName ?? 'General'}
                  </h2>
                  <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {group.questions.length} question{group.questions.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-px bg-[var(--md-sys-color-outline-variant)]" />
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
    </div>
  );
}
