'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Countdown from '@/components/Countdown';
import NotificationBanner from '@/components/NotificationBanner';
import AnswerChart from '@/components/AnswerChart';
import CodeEditor from '@/components/CodeEditor';
import AppHeader from '@/components/AppHeader';

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

/* ─── Avatar ─── */
function Avatar({ name, size = 8 }) {
  const colors = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55','#5AC8FA','#FFCC00'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none`} style={{ background: color, fontSize: '0.7rem' }}>
      {initials}
    </div>
  );
}

/* ─── Test case results panel ─── */
function TestResultsPanel({ results, passed, total, running }) {
  if (running) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 bg-apple-blue rounded-full" style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <span className="text-xs font-semibold text-apple-text-2">Running your code against test cases…</span>
        </div>
        {Array.from({ length: total || 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border border-apple-gray-2 rounded-apple bg-white overflow-hidden relative" style={{ animation: `fadeSlideIn 0.3s ease-out ${i * 0.1}s both` }}>
            <div className="absolute inset-0 bg-gradient-to-r from-apple-gray via-white to-apple-gray opacity-60" style={{ animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
            <div className="relative flex items-center gap-3 w-full">
              <div className="w-5 h-5 rounded-full border-2 border-apple-blue/30 border-t-apple-blue flex-shrink-0" style={{ animation: 'spin 0.8s linear infinite' }} />
              <div className="flex-1">
                <div className="h-2.5 bg-apple-gray-3 rounded w-16 mb-1.5" />
                <div className="h-2 bg-apple-gray-2 rounded w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!results?.length) return null;
  return (
    <div className="space-y-2">
      {results.map((r, i) => (
        <div key={i} className={`rounded-apple-md border overflow-hidden text-xs font-mono transition-all`} style={{ animation: `fadeSlideIn 0.25s ease-out ${i * 0.06}s both` }}>
          <div className={`flex items-center justify-between px-3 py-2 ${r.passed ? 'bg-green-50 border-b border-apple-green/20' : 'bg-red-50 border-b border-apple-red/20'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${r.passed ? 'bg-apple-green' : 'bg-apple-red'}`}>{r.passed ? '✓' : '✗'}</span>
              <span className={`font-bold text-sm ${r.passed ? 'text-apple-green' : 'text-apple-red'}`}>Test {i + 1}{r.hidden ? ' (hidden)' : ''}</span>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.passed ? 'text-apple-green bg-green-100' : 'text-apple-red bg-red-100'}`}>{r.passed ? 'Passed' : 'Failed'}</span>
          </div>
          {!r.hidden && (
            <div className={`px-3 py-2.5 space-y-1.5 ${r.passed ? 'bg-green-50/40' : 'bg-red-50/40'}`}>
              {r.input && <div><span className="text-apple-text-3 font-semibold">Input: </span><span className="text-apple-text whitespace-pre-wrap">{r.input}</span></div>}
              <div><span className="text-apple-text-3 font-semibold">Expected: </span><span className="text-apple-text whitespace-pre-wrap">{r.expectedOutput}</span></div>
              <div><span className="text-apple-text-3 font-semibold">Got: </span><span className={`whitespace-pre-wrap ${r.passed ? 'text-apple-text' : 'text-apple-red'}`}>{r.actualOutput || '(no output)'}</span></div>
              {r.stderr && <div className="text-apple-red whitespace-pre-wrap border-t border-apple-red/10 pt-1.5 mt-1">{r.stderr}</div>}
            </div>
          )}
        </div>
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

  // Init starter code when question/language changes
  useEffect(() => {
    if (question?.starterCode?.[language]) {
      setCode(question.starterCode[language]);
    } else {
      setCode('');
    }
    setRunResults(null);
  }, [question?.id, language]);

  // If already submitted, show submitted code
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

      {/* Visible test cases reference */}
      {!isSubmitted && question?.visibleTestCases?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">Sample Cases</p>
          <div className="space-y-2">
            {question.visibleTestCases.map((tc, i) => (
              <div key={tc.id} className="bg-apple-gray border border-apple-gray-2 rounded-apple p-3 text-xs font-mono">
                {tc.input && (
                  <div><span className="text-apple-text-3">Input: </span><span className="text-apple-text whitespace-pre-wrap">{tc.input}</span></div>
                )}
                <div><span className="text-apple-text-3">Expected: </span><span className="text-apple-text whitespace-pre-wrap">{tc.expectedOutput}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run results */}
      {(running || runResults) && (
        <div>
          <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">
            {running ? 'Running…' : `Results: ${runResults?.passed ?? 0}/${runResults?.total ?? 0} passed`}
          </p>
          {runResults?.error ? (
            <div className="text-sm text-apple-red bg-red-50 border border-red-200 rounded-apple p-3">{runResults.error}</div>
          ) : (
            <TestResultsPanel results={runResults?.results} passed={runResults?.passed} total={runResults?.total} running={running} />
          )}
        </div>
      )}

      {/* Submit results */}
      {isSubmitted && (
        <div className={`rounded-apple-md border p-4 ${result?.isCorrect || question?.isCorrect ? 'border-apple-green bg-green-50' : 'border-apple-red bg-red-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`font-bold text-sm ${result?.isCorrect || question?.isCorrect ? 'text-apple-green' : 'text-apple-red'}`}>
              {result?.isCorrect || question?.isCorrect ? '✓ All tests passed!' : '✗ Some tests failed'}
            </span>
            <span className="text-sm font-bold text-apple-blue">
              {passed}/{total} tests · +{result?.score ?? question?.score ?? 0} pts
            </span>
          </div>
          {result?.testResults && (
            <TestResultsPanel results={result.testResults} passed={passed} total={total} running={false} />
          )}
        </div>
      )}

      {/* Action buttons */}
      {!isSubmitted && (
        <div className="flex items-center gap-3">
          <button
            onClick={runCode}
            disabled={!code.trim() || running || timeLeft === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-white border border-apple-gray-3 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors disabled:opacity-50 text-apple-text shadow-apple-sm"
          >
            {running ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Running…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Run Tests</>
            )}
          </button>
          <button
            onClick={submit}
            disabled={!code.trim() || submitting || timeLeft === 0}
            className="flex items-center gap-2 bg-apple-blue text-white font-semibold px-6 py-2.5 rounded-apple text-sm hover:bg-brand-orange-deep active:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Submitting…</>
            ) : 'Submit Solution'}
          </button>
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

  // Countdown timer — uses effective remaining from server, then ticks locally
  useEffect(() => {
    if (!question || result) { setTimeLeft(null); return; }
    const effectiveLimit = question.timeLimitSeconds;
    const releasedAt = question.releasedAt;
    if (question.timeRemaining != null) {
      // Prefer server-computed remaining (accounts for quiz/section budgets)
      let remaining = question.timeRemaining;
      setTimeLeft(remaining);
      if (remaining <= 0) return;
      const id = setInterval(() => {
        remaining -= 1;
        setTimeLeft(Math.max(0, remaining));
        if (remaining <= 0) clearInterval(id);
      }, 1000);
      return () => clearInterval(id);
    }
    if (!effectiveLimit || !releasedAt) { setTimeLeft(null); return; }
    const calc = () => {
      const elapsed = Math.floor((Date.now() - new Date(releasedAt).getTime()) / 1000);
      return Math.max(0, effectiveLimit - elapsed);
    };
    setTimeLeft(calc());
    const id = setInterval(() => { const rem = calc(); setTimeLeft(rem); if (rem <= 0) clearInterval(id); }, 1000);
    return () => clearInterval(id);
  }, [question?.id, question?.releasedAt, question?.timeLimitSeconds, question?.timeRemaining, result]);

  // Auto-submit for MCQ when timer hits 0
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
    : timeLeft > (question?.timeLimitSeconds || 0) * 0.5 ? 'text-apple-green'
    : timeLeft > (question?.timeLimitSeconds || 0) * 0.25 ? 'text-orange-500'
    : 'text-apple-red';

  if (loading) return (
    <div className="flex justify-center py-24">
      <svg className="animate-spin h-8 w-8 text-apple-blue" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
    </div>
  );

  if (error) return (
    <div className="text-center py-24">
      <p className="text-apple-red font-semibold">{error}</p>
      <a href="/contestant" className="text-apple-blue text-sm mt-4 inline-block">← Back to Questions</a>
    </div>
  );

  const isSubmitted = !!result || question?.submitted;
  const isCoding = question?.type === 'CODING';
  const optionStats = result?.optionStats || question?.optionStats;
  const totalAnswered = result?.totalAnswered ?? question?.totalAnswered ?? 0;
  const correctOptions = result?.correctOptions || question?.correctOptions || [];

  return (
    <div className="max-w-5xl mx-auto px-5 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <a href="/contestant" className="flex items-center gap-1.5 text-sm text-apple-text-2 hover:text-apple-blue transition-colors font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Questions
        </a>

        {/* Large timer — center */}
        {timeLeft !== null && !isSubmitted && (
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <span className={`text-4xl font-black tabular-nums tracking-tight ${timerColor}`} style={{ fontVariantNumeric: 'tabular-nums', textShadow: timeLeft <= (question?.timeLimitSeconds || 0) * 0.25 ? '0 0 20px rgba(255,59,48,0.3)' : 'none' }}>
              {timeLeft}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-widest ${timerColor} opacity-60`}>{timeLeft === 0 ? "Time's up!" : 'seconds left'}</span>
            {(question?.timing?.quizRemaining != null || question?.timing?.sectionRemaining != null) && timeLeft > 0 && (
              <div className="flex gap-2 mt-1 opacity-70">
                {question.timing.quizRemaining != null && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-apple-text-3">Quiz {question.timing.quizRemaining}s</span>
                )}
                {question.timing.sectionRemaining != null && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-apple-text-3">Section {question.timing.sectionRemaining}s</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          {question && (
            <span className="text-xs text-apple-text-3 font-medium bg-apple-gray border border-apple-gray-2 px-2.5 py-1 rounded-full">{question.questionNumber} / {question.totalQuestions}</span>
          )}
          {me && <Avatar name={me.teamName} size={8} />}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Question header */}
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold text-apple-text-3 uppercase tracking-wide">Question {question?.questionNumber}</span>
            {isCoding && (
              <span className="text-xs bg-blue-100 text-apple-blue font-semibold px-2.5 py-0.5 rounded-full">Coding</span>
            )}
            {!isCoding && question?.isMultiAnswer && (
              <span className="text-xs bg-purple-100 text-purple-600 font-semibold px-2.5 py-0.5 rounded-full">Select all that apply</span>
            )}
            {isSubmitted && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${(result?.isCorrect ?? question?.isCorrect) ? 'bg-green-100 text-apple-green' : 'bg-red-100 text-apple-red'}`}>
                {(result?.isCorrect ?? question?.isCorrect) ? `✓ Correct · +${result?.score ?? question?.score} pts` : `✗ Incorrect · +${result?.score ?? question?.score ?? 0} pts`}
              </span>
            )}
            {timeLeft !== null && !isSubmitted && question?.timeLimitSeconds && (
              <div className="w-full mt-2 h-1.5 bg-apple-gray-2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 linear ${timeLeft > question.timeLimitSeconds * 0.5 ? 'bg-apple-green' : timeLeft > question.timeLimitSeconds * 0.25 ? 'bg-orange-400' : 'bg-apple-red'}`} style={{ width: `${Math.max(0, (timeLeft / question.timeLimitSeconds) * 100)}%` }} />
              </div>
            )}
          </div>

          {/* Question content */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-apple-lg p-6 mb-5 shadow-apple-sm" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset' }}>
            <div className="md-content text-apple-text text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMd(question?.content || '') }} />
          </div>
        </div>

        {/* Coding or MCQ body */}
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
              {/* Options */}
              <div className="space-y-2.5 mb-6">
                {question?.options?.map((opt, i) => {
                  const isSelected = selected.includes(opt.id);
                  const isCorrect = correctOptions.includes(opt.id);
                  const isWrong = isSubmitted && isSelected && !isCorrect;
                  const letter = String.fromCharCode(65 + i);

                  let classes = 'border border-apple-gray-2 bg-white';
                  if (isSubmitted) {
                    if (isCorrect) classes = 'border-apple-green bg-green-50';
                    else if (isWrong) classes = 'border-apple-red bg-red-50';
                    else if (isSelected) classes = 'border-apple-gray-3 bg-apple-gray';
                  } else {
                    if (isSelected) classes = 'border-apple-blue bg-blue-50';
                    else classes = 'border-apple-gray-2 bg-white hover:border-apple-blue hover:bg-blue-50/50 cursor-pointer';
                  }

                  return (
                    <div key={opt.id} className={`flex items-start gap-3 rounded-apple-md p-4 transition-all ${classes}`} onClick={() => !isSubmitted && toggleOption(opt.id)}>
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isSubmitted ? isCorrect ? 'bg-apple-green text-white' : isWrong ? 'bg-apple-red text-white' : 'bg-apple-gray-3 text-apple-text-2' : isSelected ? 'bg-apple-blue text-white' : 'bg-apple-gray-2 text-apple-text-2'}`}>{letter}</div>
                      <div className={`flex-1 text-sm leading-relaxed md-content ${isSubmitted && isCorrect ? 'text-green-800 font-medium' : isWrong ? 'text-red-800' : 'text-apple-text'}`} dangerouslySetInnerHTML={{ __html: renderMd(opt.content) }} />
                      {isSubmitted && isCorrect && <svg className="w-5 h-5 text-apple-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                      {isWrong && <svg className="w-5 h-5 text-apple-red flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>}
                    </div>
                  );
                })}
              </div>

              {/* Submit / Nav */}
              <div className="flex items-center gap-3 flex-wrap">
                {!isSubmitted && (
                  <button onClick={() => submitMCQ()} disabled={!selected.length || submitting || timeLeft === 0} className="bg-apple-blue text-white font-semibold px-6 py-2.5 rounded-apple text-sm hover:bg-brand-orange-deep active:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                    {submitting ? (<><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Submitting…</>) : 'Submit Answer'}
                  </button>
                )}
                {question?.prevId && (<a href={`/contestant/question?id=${question.prevId}`} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2.5 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>Previous</a>)}
                {question?.nextId && (<a href={`/contestant/question?id=${question.nextId}`} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2.5 rounded-apple hover:bg-brand-orange-deep transition-colors shadow-apple-sm ml-auto">Next Question<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></a>)}
              </div>
            </div>

            {/* Right: Chart */}
            {isSubmitted && question?.options && (
              <div className="lg:w-72 flex-shrink-0">
                <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm sticky top-20">
                  <AnswerChart options={question.options} optionStats={optionStats} totalAnswered={totalAnswered} correctOptions={correctOptions} selectedOptions={selected} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nav for coding */}
        {isCoding && (
          <div className="flex items-center gap-3 flex-wrap">
            {question?.prevId && (<a href={`/contestant/question?id=${question.prevId}`} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2.5 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>Previous</a>)}
            {question?.nextId && (<a href={`/contestant/question?id=${question.nextId}`} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2.5 rounded-apple hover:bg-brand-orange-deep transition-colors shadow-apple-sm ml-auto">Next Question<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></a>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Admin message toast ─── */
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
    <>
      <NotificationBanner />
      <MessageToast messages={messages} onDismiss={id => setMessages(prev => prev.filter(m => m.id !== id))} />
      <AppHeader
        href="/contestant"
        maxWidthClass="max-w-5xl"
        right={
          <>
            {endTime && <Countdown endTime={endTime} />}
            <button onClick={logout} className="text-sm text-brand-ink-2 hover:text-brand-orange transition-colors font-medium">Sign Out</button>
            {me && <Avatar name={me.teamName} size={8} />}
          </>
        }
      />
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
      <Suspense fallback={<div className="flex justify-center py-24"><svg className="animate-spin h-8 w-8 text-brand-orange" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg></div>}>
        <QuestionContent />
      </Suspense>
    </>
  );
}
