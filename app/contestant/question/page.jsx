'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MdButton,
  MdCard,
  MdChip,
  MdRadio,
  MdCheckbox,
  MdLoadingIndicator,
  MdAvatar,
  MdSnackbar,
  MdProgressIndicator,
} from '@awc-ui/react';
import Countdown from '@/components/Countdown';
import NotificationBanner from '@/components/NotificationBanner';
import AnswerChart from '@/components/AnswerChart';
import CodeEditor from '@/components/CodeEditor';
import AppHeader, { HeaderAction } from '@/components/AppHeader';

function renderMd(text) {
  if (typeof window === 'undefined') return text;
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupolis])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

/* ─── Test case results panel ─── */
function TestResultsPanel({ results, passed, total, running }) {
  if (running) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-3">
          <MdLoadingIndicator label="Running tests" style={{ '--md-loading-indicator-size': '24px' }} />
          <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
            Running your code against test cases…
          </span>
        </div>
        {Array.from({ length: total || 2 }).map((_, i) => (
          <MdCard key={i} variant="outlined" fullWidth style={{ padding: '0.75rem' }}>
            <div className="flex items-center gap-3">
              <MdLoadingIndicator label="Test pending" style={{ '--md-loading-indicator-size': '20px' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 rounded w-16 bg-[var(--md-sys-color-surface-container-high)]" />
                <div className="h-2 rounded w-3/4 bg-[var(--md-sys-color-surface-container)]" />
              </div>
            </div>
          </MdCard>
        ))}
      </div>
    );
  }
  if (!results?.length) return null;
  return (
    <div className="space-y-2">
      {results.map((r, i) => (
        <MdCard
          key={i}
          variant="outlined"
          fullWidth
          style={{
            padding: 0,
            overflow: 'hidden',
            borderColor: r.passed
              ? 'var(--md-sys-color-tertiary)'
              : 'var(--md-sys-color-error)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{
              background: r.passed
                ? 'var(--md-sys-color-tertiary-container)'
                : 'var(--md-sys-color-error-container)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">
                {r.passed ? 'check_circle' : 'cancel'}
              </span>
              <span className="font-bold text-sm">
                Test {i + 1}{r.hidden ? ' (hidden)' : ''}
              </span>
            </div>
            <MdChip
              variant="suggestion"
              appearance="filled"
              color={r.passed ? 'tertiary' : 'error'}
              label={r.passed ? 'Passed' : 'Failed'}
              density="-2"
            />
          </div>
          {!r.hidden && (
            <div className="px-3 py-2.5 space-y-1.5 text-xs font-mono">
              {r.input && (
                <div>
                  <span className="text-[var(--md-sys-color-on-surface-variant)] font-semibold">Input: </span>
                  <span className="whitespace-pre-wrap">{r.input}</span>
                </div>
              )}
              <div>
                <span className="text-[var(--md-sys-color-on-surface-variant)] font-semibold">Expected: </span>
                <span className="whitespace-pre-wrap">{r.expectedOutput}</span>
              </div>
              <div>
                <span className="text-[var(--md-sys-color-on-surface-variant)] font-semibold">Got: </span>
                <span className={`whitespace-pre-wrap ${r.passed ? '' : 'text-[var(--md-sys-color-error)]'}`}>
                  {r.actualOutput || '(no output)'}
                </span>
              </div>
              {r.stderr && (
                <div className="text-[var(--md-sys-color-error)] whitespace-pre-wrap border-t border-[var(--md-sys-color-outline-variant)] pt-1.5 mt-1">
                  {r.stderr}
                </div>
              )}
            </div>
          )}
        </MdCard>
      ))}
    </div>
  );
}

/* ─── Coding question view ─── */
function CodingQuestion({ question, qid, result, onResult, timeLeft, isSubmitted }) {
  const allowedLanguages = question?.allowedLanguages ?? ['javascript', 'python'];
  const defaultLang = allowedLanguages[0] ?? 'javascript';
  const [language, setLanguage] = useState(defaultLang);
  const [code, setCode] = useState('');
  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (question?.starterCode?.[language]) {
      setCode(question.starterCode[language]);
    } else {
      setCode('');
    }
    setRunResults(null);
  }, [question?.id, language]);

  useEffect(() => {
    if (question?.submitted && question.submittedCode) {
      setCode(question.submittedCode);
      if (question.submittedLanguage) setLanguage(question.submittedLanguage);
    }
  }, [question?.submitted]);

  const handleLanguageChange = (lang) => {
    if (isSubmitted) return;
    setLanguage(lang);
  };

  const runCode = async () => {
    if (!code.trim() || running) return;
    setRunning(true);
    setRunResults(null);
    try {
      const res = await fetch(`/api/questions/${qid}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      if (res.ok) setRunResults(data);
      else setRunResults({ error: data.error });
    } catch { setRunResults({ error: 'Network error' }); }
    setRunning(false);
  };

  const submit = async () => {
    if (!code.trim() || submitting || isSubmitted) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/questions/${qid}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      if (res.ok) onResult(data);
    } catch {}
    setSubmitting(false);
  };

  const passed = result?.testsPassed ?? question?.testsPassed;
  const total = result?.testsTotal ?? question?.testsTotal;

  return (
    <div className="space-y-4">
      <CodeEditor
        language={language}
        onLanguageChange={handleLanguageChange}
        value={code}
        onChange={setCode}
        readOnly={isSubmitted}
        height="380px"
        allowedLanguages={allowedLanguages}
      />

      {!isSubmitted && question?.visibleTestCases?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide mb-2">
            Sample Cases
          </p>
          <div className="space-y-2">
            {question.visibleTestCases.map((tc) => (
              <MdCard key={tc.id} variant="filled" fullWidth style={{ padding: '0.75rem' }}>
                <div className="text-xs font-mono space-y-1">
                  {tc.input && (
                    <div>
                      <span className="text-[var(--md-sys-color-on-surface-variant)]">Input: </span>
                      <span className="whitespace-pre-wrap">{tc.input}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[var(--md-sys-color-on-surface-variant)]">Expected: </span>
                    <span className="whitespace-pre-wrap">{tc.expectedOutput}</span>
                  </div>
                </div>
              </MdCard>
            ))}
          </div>
        </div>
      )}

      {(running || runResults) && (
        <div>
          <p className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide mb-2">
            {running ? 'Running…' : `Results: ${runResults?.passed ?? 0}/${runResults?.total ?? 0} passed`}
          </p>
          {runResults?.error ? (
            <MdCard variant="outlined" fullWidth style={{ padding: '0.75rem', borderColor: 'var(--md-sys-color-error)' }}>
              <p className="text-sm text-[var(--md-sys-color-error)]">{runResults.error}</p>
            </MdCard>
          ) : (
            <TestResultsPanel results={runResults?.results} passed={runResults?.passed} total={runResults?.total} running={running} />
          )}
        </div>
      )}

      {isSubmitted && (
        <MdCard
          variant="outlined"
          fullWidth
          style={{
            padding: '1rem',
            borderColor: (result?.isCorrect || question?.isCorrect)
              ? 'var(--md-sys-color-tertiary)'
              : 'var(--md-sys-color-error)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`font-bold text-sm ${(result?.isCorrect || question?.isCorrect) ? 'text-[var(--md-sys-color-tertiary)]' : 'text-[var(--md-sys-color-error)]'}`}>
              {result?.isCorrect || question?.isCorrect ? 'All tests passed!' : 'Some tests failed'}
            </span>
            <span className="text-sm font-bold text-[var(--md-sys-color-primary)]">
              {passed}/{total} tests · +{result?.score ?? question?.score ?? 0} pts
            </span>
          </div>
          {result?.testResults && (
            <TestResultsPanel results={result.testResults} passed={passed} total={total} running={false} />
          )}
        </MdCard>
      )}

      {!isSubmitted && (
        <div className="flex items-center gap-3">
          <MdButton
            variant="outlined"
            icon="play_arrow"
            onMdClick={runCode}
            disabled={!code.trim() || running || timeLeft === 0}
            loading={running}
          >
            {running ? 'Running…' : 'Run Tests'}
          </MdButton>
          <MdButton
            variant="filled"
            icon="send"
            onMdClick={submit}
            disabled={!code.trim() || submitting || timeLeft === 0}
            loading={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Solution'}
          </MdButton>
        </div>
      )}
    </div>
  );
}

/* ─── Main question content ─── */
function QuestionContent() {
  const searchParams = useSearchParams();
  const qid = searchParams.get('id');

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [me, setMe] = useState(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => { fetch('/api/me').then(r => r.json()).then(d => { if (d.type === 'team') setMe(d); }).catch(() => {}); }, []);

  const loadQuestion = useCallback(async () => {
    if (!qid) return;
    try {
      const data = await fetch(`/api/questions/${qid}`).then(r => r.json());
      if (data.error) { setError(data.error); return; }
      setQuestion(data);
      if (data.submitted) {
        if (data.type === 'MCQ') {
          setSelected(data.selectedOptions || []);
          setResult({ isCorrect: data.isCorrect, score: data.score, correctOptions: data.correctOptions, optionStats: data.optionStats, totalAnswered: data.totalAnswered });
        } else {
          setResult({ isCorrect: data.isCorrect, score: data.score, testsPassed: data.testsPassed, testsTotal: data.testsTotal });
        }
      }
    } catch { setError('Failed to load question'); }
    setLoading(false);
  }, [qid]);

  useEffect(() => { loadQuestion(); }, [qid]);

  useEffect(() => {
    if (!question?.timeLimitSeconds || !question?.releasedAt || result) { setTimeLeft(null); return; }
    const calc = () => {
      const elapsed = Math.floor((Date.now() - new Date(question.releasedAt).getTime()) / 1000);
      return Math.max(0, question.timeLimitSeconds - elapsed);
    };
    setTimeLeft(calc());
    const id = setInterval(() => { const rem = calc(); setTimeLeft(rem); if (rem <= 0) clearInterval(id); }, 1000);
    return () => clearInterval(id);
  }, [question?.id, question?.releasedAt, result]);

  useEffect(() => {
    if (timeLeft === 0 && !result && !submitting && !autoSubmittedRef.current && question?.type !== 'CODING') {
      autoSubmittedRef.current = true;
      if (selected.length > 0) submitMCQ();
    }
  }, [timeLeft]);

  const toggleOption = (optId) => {
    if (result) return;
    if (question?.isMultiAnswer) {
      setSelected(prev => prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]);
    } else {
      setSelected([optId]);
    }
  };

  const submitMCQ = async (forceSelected) => {
    const opts = forceSelected !== undefined ? forceSelected : selected;
    if (!opts.length || submitting || result) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/questions/${qid}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedOptions: opts }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitting(false); return; }
      setResult(data);
      loadQuestion();
    } catch {}
    setSubmitting(false);
  };

  const timerColor = timeLeft === null ? null
    : timeLeft > (question?.timeLimitSeconds || 0) * 0.5 ? 'text-[var(--md-sys-color-tertiary)]'
    : timeLeft > (question?.timeLimitSeconds || 0) * 0.25 ? 'text-[var(--md-sys-color-primary)]'
    : 'text-[var(--md-sys-color-error)]';

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <MdLoadingIndicator label="Loading question" style={{ '--md-loading-indicator-size': '40px' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-[var(--md-sys-color-error)] font-semibold">{error}</p>
        <div className="mt-4 flex justify-center">
          <MdButton variant="text" href="/contestant" icon="arrow_back">Back to Questions</MdButton>
        </div>
      </div>
    );
  }

  const isSubmitted = !!result || question?.submitted;
  const isCoding = question?.type === 'CODING';
  const optionStats = result?.optionStats || question?.optionStats;
  const totalAnswered = result?.totalAnswered ?? question?.totalAnswered ?? 0;
  const correctOptions = result?.correctOptions || question?.correctOptions || [];
  const progressValue = question?.timeLimitSeconds
    ? Math.max(0, (timeLeft / question.timeLimitSeconds) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-5 py-6 relative">
      <div className="flex items-center justify-between mb-6">
        <MdButton variant="text" href="/contestant" icon="arrow_back" size="sm">
          Questions
        </MdButton>

        {timeLeft !== null && !isSubmitted && (
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <span className={`text-4xl font-black tabular-nums tracking-tight ${timerColor}`}>
              {timeLeft}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-widest ${timerColor} opacity-60`}>
              {timeLeft === 0 ? "Time's up!" : 'seconds left'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {question && (
            <MdChip
              variant="suggestion"
              appearance="outlined"
              label={`${question.questionNumber} / ${question.totalQuestions}`}
              density="-2"
            />
          )}
          {me && <MdAvatar name={me.teamName} size="32" label={me.teamName} />}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide">
              Question {question?.questionNumber}
            </span>
            {isCoding && (
              <MdChip variant="suggestion" appearance="filled" color="primary" label="Coding" density="-2" />
            )}
            {!isCoding && question?.isMultiAnswer && (
              <MdChip variant="suggestion" appearance="filled" color="tertiary" label="Select all that apply" density="-2" />
            )}
            {isSubmitted && (
              <MdChip
                variant="suggestion"
                appearance="filled"
                color={(result?.isCorrect ?? question?.isCorrect) ? 'tertiary' : 'error'}
                label={(result?.isCorrect ?? question?.isCorrect)
                  ? `Correct · +${result?.score ?? question?.score} pts`
                  : `Incorrect · +${result?.score ?? question?.score ?? 0} pts`}
                density="-2"
              />
            )}
            {timeLeft !== null && !isSubmitted && question?.timeLimitSeconds && (
              <div className="w-full mt-2">
                <MdProgressIndicator
                  variant="linear"
                  value={progressValue}
                  max={100}
                  label="Time remaining"
                  thickness={4}
                />
              </div>
            )}
          </div>

          <MdCard variant="elevated" fullWidth style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            <div
              className="md-content text-sm leading-relaxed text-[var(--md-sys-color-on-surface)]"
              dangerouslySetInnerHTML={{ __html: renderMd(question?.content || '') }}
            />
          </MdCard>
        </div>

        {isCoding ? (
          <CodingQuestion
            question={question}
            qid={qid}
            result={result}
            onResult={(data) => { setResult(data); loadQuestion(); }}
            timeLeft={timeLeft}
            isSubmitted={isSubmitted}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <div className="space-y-2.5 mb-6">
                {question?.options?.map((opt, i) => {
                  const isSelected = selected.includes(opt.id);
                  const isCorrect = correctOptions.includes(opt.id);
                  const isWrong = isSubmitted && isSelected && !isCorrect;
                  const letter = String.fromCharCode(65 + i);

                  let borderColor = 'var(--md-sys-color-outline-variant)';
                  let bg = 'var(--md-sys-color-surface-container-lowest)';
                  if (isSubmitted) {
                    if (isCorrect) {
                      borderColor = 'var(--md-sys-color-tertiary)';
                      bg = 'var(--md-sys-color-tertiary-container)';
                    } else if (isWrong) {
                      borderColor = 'var(--md-sys-color-error)';
                      bg = 'var(--md-sys-color-error-container)';
                    }
                  } else if (isSelected) {
                    borderColor = 'var(--md-sys-color-primary)';
                    bg = 'var(--md-sys-color-primary-container)';
                  }

                  return (
                    <div
                      key={opt.id}
                      role="button"
                      tabIndex={isSubmitted ? -1 : 0}
                      className="flex items-start gap-3 rounded-[var(--md-sys-shape-corner-medium,12px)] p-4 transition-all"
                      style={{
                        border: `1px solid ${borderColor}`,
                        background: bg,
                        cursor: isSubmitted ? 'default' : 'pointer',
                      }}
                      onClick={() => !isSubmitted && toggleOption(opt.id)}
                      onKeyDown={(e) => {
                        if (!isSubmitted && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          toggleOption(opt.id);
                        }
                      }}
                    >
                      <div className="flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        {question?.isMultiAnswer ? (
                          <MdCheckbox
                            name="mcq-options"
                            value={String(opt.id)}
                            checked={isSelected}
                            disabled={isSubmitted}
                            aria-label={`Option ${letter}`}
                            onMdChange={() => toggleOption(opt.id)}
                          />
                        ) : (
                          <MdRadio
                            name="mcq-option"
                            value={String(opt.id)}
                            checked={isSelected}
                            disabled={isSubmitted}
                            aria-label={`Option ${letter}`}
                            onMdChange={() => toggleOption(opt.id)}
                          />
                        )}
                      </div>
                      <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]">
                        {letter}
                      </span>
                      <div
                        className="flex-1 text-sm leading-relaxed md-content"
                        dangerouslySetInnerHTML={{ __html: renderMd(opt.content) }}
                      />
                      {isSubmitted && isCorrect && (
                        <span className="material-symbols-outlined text-[var(--md-sys-color-tertiary)]">check_circle</span>
                      )}
                      {isWrong && (
                        <span className="material-symbols-outlined text-[var(--md-sys-color-error)]">cancel</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {!isSubmitted && (
                  <MdButton
                    variant="filled"
                    icon="send"
                    onMdClick={() => submitMCQ()}
                    disabled={!selected.length || submitting || timeLeft === 0}
                    loading={submitting}
                  >
                    {submitting ? 'Submitting…' : 'Submit Answer'}
                  </MdButton>
                )}
                {question?.prevId && (
                  <MdButton variant="outlined" href={`/contestant/question?id=${question.prevId}`} icon="chevron_left">
                    Previous
                  </MdButton>
                )}
                {question?.nextId && (
                  <MdButton variant="filled" href={`/contestant/question?id=${question.nextId}`} trailingIcon="chevron_right" className="ml-auto">
                    Next Question
                  </MdButton>
                )}
              </div>
            </div>

            {isSubmitted && question?.options && (
              <div className="lg:w-72 flex-shrink-0">
                <MdCard variant="outlined" fullWidth style={{ padding: '1.25rem', position: 'sticky', top: '5rem' }}>
                  <AnswerChart
                    options={question.options}
                    optionStats={optionStats}
                    totalAnswered={totalAnswered}
                    correctOptions={correctOptions}
                    selectedOptions={selected}
                  />
                </MdCard>
              </div>
            )}
          </div>
        )}

        {isCoding && (
          <div className="flex items-center gap-3 flex-wrap">
            {question?.prevId && (
              <MdButton variant="outlined" href={`/contestant/question?id=${question.prevId}`} icon="chevron_left">
                Previous
              </MdButton>
            )}
            {question?.nextId && (
              <MdButton variant="filled" href={`/contestant/question?id=${question.nextId}`} trailingIcon="chevron_right" className="ml-auto">
                Next Question
              </MdButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Admin message toast ─── */
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

export default function QuestionPage() {
  const [me, setMe] = useState(null);
  const [endTime, setEndTime] = useState('');
  const [messages, setMessages] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.type !== 'team') router.replace('/');
      else setMe(d);
    }).catch(() => router.replace('/'));
    fetch('/api/config').then(r => r.json()).then(d => setEndTime(d.contestEndTime));
  }, []);

  useEffect(() => {
    if (!me) return;
    let socket;
    import('socket.io-client').then(({ io }) => {
      socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
      socket.on('connect', () => socket.emit('team:join', { teamId: me.teamId }));
      socket.on('message:received', (data) => {
        const id = Date.now();
        setMessages(prev => [...prev, { id, content: data.content }]);
        setTimeout(() => setMessages(prev => prev.filter(m => m.id !== id)), 10000);
      });
      socket.on('quiz:banished', () => router.replace('/?banished=1'));
    });
    return () => socket?.disconnect();
  }, [me?.teamId]);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

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
            {me && <MdAvatar name={me.teamName} size="32" label={me.teamName} />}
          </>
        }
      />
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <MdLoadingIndicator label="Loading" style={{ '--md-loading-indicator-size': '40px' }} />
          </div>
        }
      >
        <QuestionContent />
      </Suspense>
    </div>
  );
}
