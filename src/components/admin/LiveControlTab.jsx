'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useConfirm } from '@/components/DialogProvider';
import { Spinner } from './AdminUI';

function pickDefaultLiveQuiz(quizzes) {
  if (!Array.isArray(quizzes) || quizzes.length === 0) return null;
  return (
    quizzes.find(q => q.isActive && !q.isDisabled) ||
    quizzes.find(q => !q.isDisabled) ||
    null
  );
}

export function LiveControlTab() {
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const selectedQuizIdRef = useRef('');
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [busy, setBusy] = useState({});
  const [switchError, setSwitchError] = useState('');
  const feedRef = useRef(null);

  const setSelected = (id, quiz = null) => {
    selectedQuizIdRef.current = id ? String(id) : '';
    setSelectedQuizId(selectedQuizIdRef.current);
    if (quiz) setActiveQuiz(quiz);
  };

  const loadQuizContent = useCallback(async (quizId) => {
    if (!quizId) {
      setQuestions([]);
      setSections([]);
      return;
    }
    const [qs, secs] = await Promise.all([
      fetch(`/api/admin/questions?quizId=${quizId}`).then(r => r.json()),
      fetch(`/api/admin/sections?quizId=${quizId}`).then(r => r.json()),
    ]);
    if (Array.isArray(qs)) setQuestions(qs);
    else setQuestions([]);
    if (Array.isArray(secs)) setSections(secs);
    else setSections([]);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [qdata, ldata] = await Promise.all([
        fetch('/api/admin/quizzes').then(r => r.json()),
        fetch('/api/admin/live').then(r => r.json()),
      ]);
      if (Array.isArray(qdata)) {
        setQuizzes(qdata);
        const prevId = selectedQuizIdRef.current;
        const prevQuiz = prevId ? qdata.find(q => String(q.id) === String(prevId) && !q.isDisabled) : null;
        const picked = prevQuiz || pickDefaultLiveQuiz(qdata);
        setSelected(picked ? String(picked.id) : '', picked || null);
        await loadQuizContent(picked?.id || null);
      }
      setLiveState(ldata);
    } catch {}
    setLoading(false);
  }, [loadQuizContent]);

  useEffect(() => {
    loadAll();
    const id = setInterval(() => {
      fetch('/api/admin/live').then(r => r.json()).then(setLiveState).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [loadAll]);

  const switchQuiz = async (nextId) => {
    setSwitchError('');
    if (!nextId) return;
    const quiz = quizzes.find(q => String(q.id) === String(nextId));
    if (!quiz) return;
    if (quiz.isDisabled) {
      setSwitchError('That quiz is disabled. Enable it from the Quizzes tab first.');
      return;
    }
    if (String(quiz.id) === String(activeQuiz?.id) && quiz.isActive) {
      setSelected(String(quiz.id), quiz);
      await loadQuizContent(quiz.id);
      return;
    }

    const ok = await confirm({
      title: 'Switch live quiz?',
      message: `Show "${quiz.title}" on Live Control and the projector? This clears the current on-screen question.`,
      confirmLabel: 'Switch quiz',
      tone: 'primary',
    });
    if (!ok) return;

    setSwitching(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${quiz.id}/activate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSwitchError(data.error || 'Failed to switch quiz');
        setSwitching(false);
        return;
      }
      const nextQuiz = { ...quiz, isActive: true, isDisabled: false };
      setSelected(String(quiz.id), nextQuiz);
      setQuizzes(prev => prev.map(q => ({
        ...q,
        isActive: q.id === quiz.id,
      })));
      await loadQuizContent(quiz.id);
      const live = await fetch('/api/admin/live').then(r => r.json());
      setLiveState(live);
    } catch {
      setSwitchError('Network error while switching quiz');
    }
    setSwitching(false);
  };

  const control = async (action, questionId) => {
    const key = `${action}-${questionId || ''}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      await fetch('/api/admin/live/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, questionId }),
      });
      const data = await fetch('/api/admin/live').then(r => r.json());
      setLiveState(data);
    } catch {}
    setBusy(prev => ({ ...prev, [key]: false }));
  };

  const controlSection = async (action, sectionId) => {
    const key = `${action}-${sectionId}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      await fetch('/api/admin/live/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sectionId }),
      });
      if (selectedQuizId) await loadQuizContent(selectedQuizId);
      else await loadAll();
    } catch {}
    setBusy(prev => ({ ...prev, [key]: false }));
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={8} /></div>;

  const currentQId = liveState?.currentQuestion?.id;
  const fastestAnswers = liveState?.fastestAnswers || [];
  const enabledQuizzes = quizzes.filter(q => !q.isDisabled);
  const quizOptions = enabledQuizzes.map(q => ({
    value: String(q.id),
    label: q.isActive ? `${q.title} · Live` : q.title,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Live Control</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">
            Control the projector screen at{' '}
            <a href="/live" target="_blank" className="text-apple-blue hover:underline font-semibold">/live ↗</a>
          </p>
        </div>
        <button onClick={loadAll} className="p-2 text-apple-text-3 hover:text-apple-blue transition-colors" title="Refresh">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-4 shadow-apple-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Quiz on Live</label>
            <SearchableSelect
              value={selectedQuizId}
              onChange={switchQuiz}
              disabled={switching || enabledQuizzes.length === 0}
              placeholder={enabledQuizzes.length === 0 ? 'No enabled quizzes' : 'Select a quiz…'}
              searchPlaceholder="Search quizzes…"
              options={quizOptions}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
            {switching && <Spinner size={4} />}
            {activeQuiz?.isActive && !activeQuiz?.isDisabled ? (
              <span className="text-xs font-semibold text-apple-green bg-green-50 border border-green-200 px-2.5 py-1 rounded-md">Live</span>
            ) : activeQuiz ? (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">Not activated</span>
            ) : null}
          </div>
        </div>
        {switchError && (
          <p className="mt-2 text-sm text-apple-red">{switchError}</p>
        )}
        {enabledQuizzes.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">No enabled quizzes. Create or enable one in the Quizzes tab.</p>
        )}
        {quizzes.some(q => q.isActive && q.isDisabled) && (
          <p className="mt-2 text-sm text-amber-700">A disabled quiz was previously marked active — pick an enabled quiz above to take over Live.</p>
        )}
      </div>

      {!activeQuiz ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-apple-lg p-5 mb-6">
          <p className="text-sm font-semibold text-yellow-700">No quiz selected for Live. Choose an enabled quiz above.</p>
        </div>
      ) : null}

      {sections.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-apple-text-2 uppercase tracking-wide mb-3">Sections</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.map(s => {
              const enableKey = `enableSection-${s.id}`;
              const disableKey = `disableSection-${s.id}`;
              const isBusy = busy[enableKey] || busy[disableKey];
              return (
                <div key={s.id} className={`bg-white border rounded-apple-lg p-4 shadow-apple-sm flex items-center gap-3 ${s.isEnabled ? 'border-apple-green/40' : 'border-apple-gray-2 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-apple-text truncate">{s.name}</p>
                    <p className="text-xs text-apple-text-3">{s.questionCount} question{s.questionCount !== 1 ? 's' : ''} · {s.isEnabled ? <span className="text-apple-green font-semibold">Visible to teams</span> : <span>Hidden from teams</span>}</p>
                  </div>
                  <button
                    onClick={() => controlSection(s.isEnabled ? 'disableSection' : 'enableSection', s.id)}
                    disabled={isBusy}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${s.isEnabled ? 'bg-apple-green' : 'bg-apple-gray-3'} ${isBusy ? 'opacity-50' : ''}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${s.isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions control */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-apple-text-2 uppercase tracking-wide">Questions</h3>
            {currentQId && (
              <button onClick={() => control('hideQuestion')} className="text-xs font-semibold text-apple-red hover:underline">
                Clear Screen
              </button>
            )}
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-apple-text-2 py-4 text-center">{activeQuiz ? 'No questions in this quiz.' : 'Select an active quiz first.'}</p>
          ) : (
            questions.map((q, i) => {
              const isShowing = currentQId === q.id;
              const isShowingResults = isShowing && liveState?.showResults;
              return (
                <div key={q.id} className={`bg-white border rounded-apple-lg p-4 shadow-apple-sm ${isShowing ? 'border-apple-blue/50 bg-blue-50/30' : 'border-apple-gray-2'}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-apple-gray-2 flex items-center justify-center text-xs font-bold text-apple-text-2 flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-apple-text truncate">{q.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {q.isReleased ? <span className="text-xs text-apple-green font-semibold">Released to contestants</span> : <span className="text-xs text-apple-text-3">Not released</span>}
                        {isShowing && <span className="text-xs font-semibold text-apple-blue bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">On screen</span>}
                        {q.sectionName && <span className="text-xs text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full">{q.sectionName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isShowing ? (
                        <>
                          {!isShowingResults ? (
                            <button
                              onClick={() => control('showResults', q.id)}
                              disabled={busy[`showResults-${q.id}`]}
                              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-purple-500 px-3 py-1.5 rounded-apple hover:bg-purple-600 transition-colors disabled:opacity-50"
                            >
                              {busy[`showResults-${q.id}`] ? <Spinner size={3} /> : null}
                              Show Results
                            </button>
                          ) : (
                            <button
                              onClick={() => control('hideResults')}
                              className="flex items-center gap-1.5 text-xs font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-2 px-3 py-1.5 rounded-apple hover:bg-apple-gray-2 transition-colors"
                            >
                              Hide Results
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => control('showQuestion', q.id)}
                          disabled={busy[`showQuestion-${q.id}`]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-apple-blue px-3 py-1.5 rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50"
                        >
                          {busy[`showQuestion-${q.id}`] ? <Spinner size={3} /> : null}
                          Show on Screen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Fastest Fingers Feed */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg shadow-apple-sm overflow-hidden flex flex-col" style={{ maxHeight: '500px' }}>
          <div className="px-4 py-3 border-b border-apple-gray-2 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold text-apple-text">Fastest Fingers</h3>
              <p className="text-xs text-apple-text-3">{fastestAnswers.length} answered</p>
            </div>
            {fastestAnswers.length > 0 && (
              <button onClick={() => control('resetFeed')} className="text-xs font-semibold text-apple-red hover:underline">Reset</button>
            )}
          </div>
          <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {fastestAnswers.length === 0 ? (
              <p className="text-xs text-apple-text-3 text-center py-6">No answers yet for current question.</p>
            ) : (
              fastestAnswers.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-apple border text-sm ${a.isCorrect ? 'border-apple-green/40 bg-green-50' : 'border-apple-gray-2 bg-apple-gray/30'}`}>
                  <span className="text-xs font-bold text-apple-text-3 w-6 text-center">#{a.rank}</span>
                  <span className="font-medium text-apple-text truncate">{a.teamName}</span>
                  <span className={`text-xs font-bold ${a.isCorrect ? 'text-apple-green' : 'text-apple-red'}`}>
                    {a.isCorrect ? '✓' : '✗'}
                  </span>
                  {a.testsTotal > 0 && <span className="text-xs text-apple-text-2">{a.testsPassed}/{a.testsTotal}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}