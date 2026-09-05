'use client';
import { useEffect, useState, useRef } from 'react';
import { LogoMark } from '@/components/Logo';

function renderMd(text) {
  if (!text) return '';
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupolis])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="text-lg font-bold text-slate-400 w-8 text-center">#{rank}</span>;
}

function CountdownRing({ timeLeft, totalTime }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const pct = totalTime > 0 ? Math.max(0, timeLeft / totalTime) : 0;
  const dash = pct * circ;
  const color = pct > 0.5 ? '#34C759' : pct > 0.25 ? '#FF9500' : '#FF3B30';
  return (
    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="5" fill="none" />
        <circle cx="40" cy="40" r={r} stroke={color} strokeWidth="5" fill="none"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="text-2xl font-black tabular-nums" style={{ color }}>
        {timeLeft > 0 ? timeLeft : '0'}
      </span>
    </div>
  );
}

export default function LiveScreen() {
  const [state, setState] = useState({
    activeQuizTitle: null,
    currentQuestion: null,
    showResults: false,
    resultStats: null,
    fastestAnswers: [],
    allTeams: [],
    submittedTeamIds: [],
  });
  const [connected, setConnected] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const submissionsMapRef = useRef({});
  const feedRef = useRef(null);
  const socketRef = useRef(null);

  // Countdown timer effect
  useEffect(() => {
    const q = state.currentQuestion;
    if (!q?.timeLimitSeconds || !q?.releasedAt) {
      setTimeLeft(null);
      return;
    }
    const calc = () => {
      const elapsed = Math.floor((Date.now() - new Date(q.releasedAt).getTime()) / 1000);
      return Math.max(0, q.timeLimitSeconds - elapsed);
    };
    setTimeLeft(calc());
    const id = setInterval(() => {
      const rem = calc();
      setTimeLeft(rem);
      if (rem <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [state.currentQuestion?.id, state.currentQuestion?.releasedAt, state.currentQuestion?.timeLimitSeconds]);

  useEffect(() => {
    let socket;
    import('socket.io-client').then(({ io }) => {
      socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      const buildSubmissionsMap = (fastestAnswers, allTeams) => {
        const nameToId = {};
        (allTeams || []).forEach(t => { nameToId[t.name] = t.id; });
        const map = {};
        (fastestAnswers || []).forEach(a => {
          const id = nameToId[a.teamName];
          if (id !== undefined) map[id] = a.isCorrect;
        });
        return map;
      };

      socket.on('state:sync', (data) => {
        submissionsMapRef.current = buildSubmissionsMap(data.fastestAnswers, data.allTeams);
        setState(data);
      });

      socket.on('quiz:activated', (data) => {
        submissionsMapRef.current = {};
        setState(prev => ({
          ...prev,
          activeQuizTitle: data.title,
          currentQuestion: null,
          showResults: false,
          resultStats: null,
          fastestAnswers: [],
          allTeams: [],
          submittedTeamIds: [],
        }));
      });

      socket.on('question:show', ({ question, fastestAnswers, allTeams, submittedTeamIds }) => {
        submissionsMapRef.current = buildSubmissionsMap(fastestAnswers, allTeams);
        setState(prev => ({
          ...prev,
          currentQuestion: question,
          showResults: false,
          resultStats: null,
          fastestAnswers: fastestAnswers || [],
          allTeams: allTeams || [],
          submittedTeamIds: submittedTeamIds || [],
        }));
      });

      socket.on('question:hide', () => {
        submissionsMapRef.current = {};
        setState(prev => ({
          ...prev,
          currentQuestion: null,
          showResults: false,
          resultStats: null,
          fastestAnswers: [],
          allTeams: [],
          submittedTeamIds: [],
        }));
      });

      socket.on('answer:submitted', (data) => {
        submissionsMapRef.current = { ...submissionsMapRef.current, [data.teamId]: data.isCorrect };
        setState(prev => {
          if (prev.currentQuestion?.id !== data.questionId) return prev;
          const updated = [...prev.fastestAnswers, {
            rank: data.rank,
            teamName: data.teamName,
            isCorrect: data.isCorrect,
            testsPassed: data.testsPassed,
            testsTotal: data.testsTotal,
            submittedAt: data.submittedAt,
          }].sort((a, b) => a.rank - b.rank);
          return {
            ...prev,
            fastestAnswers: updated,
            submittedTeamIds: [...(prev.submittedTeamIds || []), data.teamId],
          };
        });
        setTimeout(() => {
          if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }, 50);
      });

      socket.on('results:show', (data) => {
        setState(prev => ({ ...prev, showResults: true, resultStats: data }));
      });

      socket.on('results:hide', () => {
        setState(prev => ({ ...prev, showResults: false, resultStats: null }));
      });

      socket.on('feed:reset', () => {
        submissionsMapRef.current = {};
        setState(prev => ({ ...prev, fastestAnswers: [], submittedTeamIds: [] }));
      });
    });

    return () => { socket?.disconnect(); };
  }, []);

  const { activeQuizTitle, currentQuestion, showResults, resultStats, fastestAnswers, allTeams, submittedTeamIds } = state;
  const submittedSet = new Set(submittedTeamIds || []);
  const submittedList = (allTeams || []).filter(t => submittedSet.has(t.id));
  const pendingList = (allTeams || []).filter(t => !submittedSet.has(t.id));
  const totalTeams = (allTeams || []).length;

  return (
    <div className="min-h-screen bg-[#0E1014] text-white flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-white/10 flex-shrink-0 relative bg-white/[0.03] backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <LogoMark size={28} />
          <div className="min-w-0">
            <p className="font-display text-lg sm:text-xl font-bold tracking-tight text-white truncate">
              {activeQuizTitle || 'Quizzy Live'}
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-semibold">Live Arena</p>
          </div>
        </div>

        {/* Large center timer */}
        {currentQuestion?.timeLimitSeconds && timeLeft !== null && (
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            {(() => {
              const pct = currentQuestion.timeLimitSeconds > 0 ? timeLeft / currentQuestion.timeLimitSeconds : 0;
              const color = pct > 0.5 ? '#22C55E' : pct > 0.25 ? '#F59E0B' : '#EF4444';
              return (
                <>
                  <span className="text-5xl font-black tabular-nums font-display" style={{ color, textShadow: pct < 0.25 ? `0 0 30px ${color}60` : 'none', transition: 'color 0.3s, text-shadow 0.3s' }}>{timeLeft}</span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/30 mt-0.5">{timeLeft === 0 ? "Time's Up" : 'seconds'}</span>
                </>
              );
            })()}
          </div>
        )}

        <div className="flex items-center gap-4">
          {currentQuestion?.timeLimitSeconds && timeLeft !== null && (
            <CountdownRing timeLeft={timeLeft} totalTime={currentQuestion.timeLimitSeconds} />
          )}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
            <span className="text-xs text-white/40">{connected ? 'Live' : 'Connecting…'}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {!currentQuestion ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-8xl mb-6 animate-pulse">⏳</div>
              <h1 className="text-4xl font-bold text-white/60 mb-3">Waiting for next question</h1>
              {activeQuizTitle && <p className="text-lg text-white/30">{activeQuizTitle}</p>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-0 overflow-hidden">
            {/* Left: Question */}
            <div className="flex-1 flex flex-col px-10 py-8 overflow-y-auto">
              <div className="mb-4 flex items-center gap-3">
                {currentQuestion.sectionName && (
                  <span className="text-xs font-bold text-orange-300 uppercase tracking-widest bg-orange-400/10 border border-orange-400/20 px-3 py-1 rounded-md">
                    {currentQuestion.sectionName}
                  </span>
                )}
                <span className={`text-sm font-bold uppercase tracking-widest ${currentQuestion.type === 'CODING' ? 'text-orange-300' : 'text-orange-200/80'}`}>
                  {currentQuestion.type === 'CODING' ? 'Coding Challenge' : currentQuestion.isMultiAnswer ? 'Select all that apply' : 'Choose one answer'}
                </span>
              </div>

              <div
                className="text-2xl leading-relaxed text-white/90 mb-8 md-content"
                dangerouslySetInnerHTML={{ __html: renderMd(currentQuestion.content) }}
                style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)' }}
              />

              {/* MCQ options */}
              {currentQuestion.type !== 'CODING' && currentQuestion.options?.length > 0 && (
                <div className="grid grid-cols-1 gap-3 max-w-3xl">
                  {currentQuestion.options.map((opt, i) => {
                    const isCorrect = showResults && resultStats?.correctOptionIds?.includes(opt.id);
                    const pct = resultStats?.totalAnswered > 0
                      ? Math.round(((resultStats?.optionStats?.[opt.id] || 0) / resultStats.totalAnswered) * 100)
                      : 0;

                    return (
                      <div
                        key={opt.id}
                        className={`relative rounded-xl border-2 p-4 overflow-hidden transition-all duration-500 ${
                          showResults
                            ? isCorrect
                              ? 'border-green-400 bg-green-400/10'
                              : 'border-white/10 bg-white/5 opacity-60'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        {showResults && (
                          <div
                            className={`absolute inset-y-0 left-0 transition-all duration-700 ${isCorrect ? 'bg-green-400/20' : 'bg-white/5'}`}
                            style={{ width: `${pct}%` }}
                          />
                        )}
                        <div className="relative flex items-center gap-4">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                            showResults && isCorrect ? 'bg-green-400 text-black' : 'bg-white/10 text-white/60'
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-base font-medium text-white/90 flex-1">{opt.content}</span>
                          {showResults && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isCorrect && <span className="text-green-400 font-bold text-sm">✓ Correct</span>}
                              <span className="text-sm font-bold text-white/50">{pct}%</span>
                              <span className="text-xs text-white/30">({resultStats?.optionStats?.[opt.id] || 0})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Coding results summary */}
              {currentQuestion.type === 'CODING' && showResults && resultStats && (
                <div className="max-w-3xl mt-4 space-y-2">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full transition-all duration-700"
                        style={{ width: `${resultStats.totalAnswered > 0 ? Math.round((resultStats.solved / resultStats.totalAnswered) * 100) : 0}%` }} />
                    </div>
                    <span className="text-sm text-white/50 flex-shrink-0">{resultStats.solved}/{resultStats.totalAnswered} solved</span>
                  </div>
                </div>
              )}

              {showResults && resultStats && currentQuestion.type !== 'CODING' && (
                <div className="mt-6 text-sm text-white/40">
                  {resultStats.totalAnswered} teams answered
                </div>
              )}
            </div>

            {/* Right: Submissions Panel */}
            <div className="w-72 xl:w-80 border-l border-white/10 flex flex-col flex-shrink-0">
              {/* Panel header */}
              <div className="px-5 py-4 border-b border-white/10 flex-shrink-0">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Submissions</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-green-400 font-semibold">{submittedList.length} submitted</span>
                  {pendingList.length > 0 && (
                    <span className="text-xs text-white/30">· {pendingList.length} pending</span>
                  )}
                  {totalTeams > 0 && (
                    <span className="text-xs text-white/20 ml-auto">{totalTeams} total</span>
                  )}
                </div>
                {totalTeams > 0 && (
                  <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((submittedList.length / totalTeams) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              <div ref={feedRef} className="flex-1 overflow-y-auto py-2">
                {submittedList.length === 0 && pendingList.length === 0 ? (
                  <div className="text-center py-8 text-white/20 text-sm">Waiting for answers…</div>
                ) : (
                  <>
                    {/* Submitted teams */}
                    {submittedList.map((team, i) => {
                      const isCorrect = submissionsMapRef.current[team.id];
                      const answer = fastestAnswers.find(a => a.teamName === team.name);
                      const isCoding = currentQuestion?.type === 'CODING';
                      return (
                        <div
                          key={team.id}
                          className={`flex items-center gap-3 mx-3 px-3 py-2 rounded-lg mb-1.5 transition-all ${
                            isCorrect ? 'bg-green-500/15 border border-green-500/20' : 'bg-white/5 border border-white/5'
                          }`}
                          style={{ animation: 'slideIn 0.3s ease-out' }}
                        >
                          {answer ? <RankBadge rank={answer.rank} /> : <span className="w-8 text-center text-white/20 text-sm">—</span>}
                          <p className="text-sm font-semibold text-white flex-1 truncate">{team.name}</p>
                          {isCoding && answer?.testsTotal > 0 ? (
                            <span className={`text-xs font-bold flex-shrink-0 ${isCorrect ? 'text-green-400' : 'text-white/40'}`}>
                              {answer.testsPassed}/{answer.testsTotal}
                            </span>
                          ) : (
                            <span className={`text-base flex-shrink-0 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                              {isCorrect ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Pending teams */}
                    {pendingList.length > 0 && (
                      <>
                        {submittedList.length > 0 && (
                          <div className="mx-3 my-2 border-t border-white/5" />
                        )}
                        {pendingList.map(team => (
                          <div
                            key={team.id}
                            className="flex items-center gap-3 mx-3 px-3 py-2 rounded-lg mb-1.5 bg-white/3 border border-white/5 opacity-50"
                          >
                            <span className="w-8 text-center text-white/20 text-sm">…</span>
                            <p className="text-sm text-white/50 flex-1 truncate">{team.name}</p>
                            <span className="text-xs text-white/20">pending</span>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .md-content h1, .md-content h2, .md-content h3 { font-weight: bold; margin: 0.5em 0; }
        .md-content h1 { font-size: 1.5em; }
        .md-content h2 { font-size: 1.25em; }
        .md-content code { background: rgba(255,255,255,0.1); padding: 0.1em 0.4em; border-radius: 4px; font-family: monospace; }
        .md-content pre { background: rgba(255,255,255,0.05); padding: 1em; border-radius: 8px; overflow-x: auto; }
        .md-content p { margin: 0.3em 0; }
        .md-content li { margin-left: 1.5em; list-style: disc; }
        .md-content strong { font-weight: bold; }
        .md-content em { font-style: italic; }
      `}</style>
    </div>
  );
}
