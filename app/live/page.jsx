'use client';
import { useEffect, useState, useRef } from 'react';
import {
  MdChip,
  MdProgressIndicator,
  MdStatusDot,
  MdLoadingIndicator,
} from '@awc-ui/react';
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
  return (
    <span className="text-lg font-bold w-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
      #{rank}
    </span>
  );
}

function CountdownRing({ timeLeft, totalTime }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const pct = totalTime > 0 ? Math.max(0, timeLeft / totalTime) : 0;
  const dash = pct * circ;
  const color = pct > 0.5
    ? 'var(--md-sys-color-tertiary)'
    : pct > 0.25
      ? 'var(--md-sys-color-primary)'
      : 'var(--md-sys-color-error)';
  return (
    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={r} stroke="var(--md-sys-color-outline-variant)" strokeWidth="5" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke={color}
          strokeWidth="5"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
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
  }, [state.currentQuestion?.id, state.currentQuestion?.releasedAt]);

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
  const submissionPct = totalTeams > 0 ? Math.round((submittedList.length / totalTeams) * 100) : 0;

  return (
    <div
      data-theme="dark"
      className="min-h-screen flex flex-col overflow-hidden font-sans bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)]"
    >
      <header
        className="flex items-center justify-between px-6 sm:px-8 py-3 flex-shrink-0 relative"
        style={{
          borderBottom: '1px solid var(--md-sys-color-outline-variant)',
          background: 'var(--md-sys-color-surface-container)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <LogoMark size={28} />
          <div className="min-w-0">
            <p className="font-display text-lg sm:text-xl font-bold tracking-tight truncate text-[var(--md-sys-color-on-surface)]">
              {activeQuizTitle || 'Quizzy Live'}
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--md-sys-color-on-surface-variant)]">
              Live Arena
            </p>
          </div>
        </div>

        {currentQuestion?.timeLimitSeconds && timeLeft !== null && (
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            {(() => {
              const pct = currentQuestion.timeLimitSeconds > 0 ? timeLeft / currentQuestion.timeLimitSeconds : 0;
              const color = pct > 0.5
                ? 'var(--md-sys-color-tertiary)'
                : pct > 0.25
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-error)';
              return (
                <>
                  <span
                    className="text-5xl font-black tabular-nums font-display"
                    style={{
                      color,
                      textShadow: pct < 0.25 ? `0 0 30px color-mix(in srgb, ${color} 40%, transparent)` : 'none',
                      transition: 'color 0.3s, text-shadow 0.3s',
                    }}
                  >
                    {timeLeft}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                    {timeLeft === 0 ? "Time's Up" : 'seconds'}
                  </span>
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
            <MdStatusDot
              inline
              state={connected ? 'online' : 'busy'}
              live={connected}
              label={connected ? 'Live' : 'Connecting'}
              size="small"
            />
            <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
              {connected ? 'Live' : 'Connecting…'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!currentQuestion ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
              <MdLoadingIndicator
                variant="contained"
                label="Waiting for next question"
                style={{ '--md-loading-indicator-size': '72px' }}
              />
              <h1 className="text-4xl font-bold text-[var(--md-sys-color-on-surface-variant)]">
                Waiting for next question
              </h1>
              {activeQuizTitle && (
                <p className="text-lg text-[var(--md-sys-color-on-surface-variant)] opacity-70">
                  {activeQuizTitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-0 overflow-hidden">
            <div className="flex-1 flex flex-col px-10 py-8 overflow-y-auto">
              <div className="mb-4 flex items-center gap-3 flex-wrap">
                {currentQuestion.sectionName && (
                  <MdChip
                    variant="suggestion"
                    appearance="filled"
                    color="primary"
                    label={currentQuestion.sectionName}
                    density="-1"
                  />
                )}
                <MdChip
                  variant="suggestion"
                  appearance="outlined"
                  color={currentQuestion.type === 'CODING' ? 'primary' : undefined}
                  label={
                    currentQuestion.type === 'CODING'
                      ? 'Coding Challenge'
                      : currentQuestion.isMultiAnswer
                        ? 'Select all that apply'
                        : 'Choose one answer'
                  }
                  density="-1"
                />
              </div>

              <div
                className="leading-relaxed mb-8 md-content text-[var(--md-sys-color-on-surface)]"
                dangerouslySetInnerHTML={{ __html: renderMd(currentQuestion.content) }}
                style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)' }}
              />

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
                        className="relative rounded-[var(--md-sys-shape-corner-large,16px)] p-4 overflow-hidden transition-all duration-500"
                        style={{
                          border: `2px solid ${
                            showResults
                              ? isCorrect
                                ? 'var(--md-sys-color-tertiary)'
                                : 'var(--md-sys-color-outline-variant)'
                              : 'var(--md-sys-color-outline)'
                          }`,
                          background: showResults
                            ? isCorrect
                              ? 'var(--md-sys-color-tertiary-container)'
                              : 'var(--md-sys-color-surface-container)'
                            : 'var(--md-sys-color-surface-container-high)',
                          opacity: showResults && !isCorrect ? 0.7 : 1,
                        }}
                      >
                        {showResults && (
                          <div
                            className="absolute inset-y-0 left-0 transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: isCorrect
                                ? 'color-mix(in srgb, var(--md-sys-color-tertiary) 25%, transparent)'
                                : 'color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent)',
                            }}
                          />
                        )}
                        <div className="relative flex items-center gap-4">
                          <span
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                            style={{
                              background: showResults && isCorrect
                                ? 'var(--md-sys-color-tertiary)'
                                : 'var(--md-sys-color-surface-container-highest)',
                              color: showResults && isCorrect
                                ? 'var(--md-sys-color-on-tertiary)'
                                : 'var(--md-sys-color-on-surface-variant)',
                            }}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-base font-medium flex-1 text-[var(--md-sys-color-on-surface)]">
                            {opt.content}
                          </span>
                          {showResults && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isCorrect && (
                                <MdChip
                                  variant="suggestion"
                                  appearance="filled"
                                  color="tertiary"
                                  label="Correct"
                                  density="-2"
                                />
                              )}
                              <span className="text-sm font-bold text-[var(--md-sys-color-on-surface-variant)]">
                                {pct}%
                              </span>
                              <span className="text-xs text-[var(--md-sys-color-outline)]">
                                ({resultStats?.optionStats?.[opt.id] || 0})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'CODING' && showResults && resultStats && (
                <div className="max-w-3xl mt-4 space-y-2">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <MdProgressIndicator
                        variant="linear"
                        value={resultStats.totalAnswered > 0
                          ? Math.round((resultStats.solved / resultStats.totalAnswered) * 100)
                          : 0}
                        max={100}
                        label="Solved rate"
                        thickness={6}
                      />
                    </div>
                    <span className="text-sm flex-shrink-0 text-[var(--md-sys-color-on-surface-variant)]">
                      {resultStats.solved}/{resultStats.totalAnswered} solved
                    </span>
                  </div>
                </div>
              )}

              {showResults && resultStats && currentQuestion.type !== 'CODING' && (
                <div className="mt-6 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  {resultStats.totalAnswered} teams answered
                </div>
              )}
            </div>

            <div
              className="w-72 xl:w-80 flex flex-col flex-shrink-0"
              style={{
                borderLeft: '1px solid var(--md-sys-color-outline-variant)',
                background: 'var(--md-sys-color-surface-container-low)',
              }}
            >
              <div
                className="px-5 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
              >
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--md-sys-color-on-surface-variant)]">
                  Submissions
                </h3>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <MdChip
                    variant="suggestion"
                    appearance="filled"
                    color="tertiary"
                    label={`${submittedList.length} submitted`}
                    density="-2"
                  />
                  {pendingList.length > 0 && (
                    <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      · {pendingList.length} pending
                    </span>
                  )}
                  {totalTeams > 0 && (
                    <span className="text-xs text-[var(--md-sys-color-outline)] ml-auto">
                      {totalTeams} total
                    </span>
                  )}
                </div>
                {totalTeams > 0 && (
                  <div className="mt-2">
                    <MdProgressIndicator
                      variant="linear"
                      value={submissionPct}
                      max={100}
                      label="Submission progress"
                      thickness={4}
                    />
                  </div>
                )}
              </div>

              <div ref={feedRef} className="flex-1 overflow-y-auto py-2">
                {submittedList.length === 0 && pendingList.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    Waiting for answers…
                  </div>
                ) : (
                  <>
                    {submittedList.map((team) => {
                      const isCorrect = submissionsMapRef.current[team.id];
                      const answer = fastestAnswers.find(a => a.teamName === team.name);
                      const isCoding = currentQuestion?.type === 'CODING';
                      return (
                        <div
                          key={team.id}
                          className="flex items-center gap-3 mx-3 px-3 py-2 rounded-lg mb-1.5 transition-all"
                          style={{
                            animation: 'slideIn 0.3s ease-out',
                            background: isCorrect
                              ? 'color-mix(in srgb, var(--md-sys-color-tertiary) 18%, transparent)'
                              : 'var(--md-sys-color-surface-container)',
                            border: `1px solid ${
                              isCorrect
                                ? 'color-mix(in srgb, var(--md-sys-color-tertiary) 35%, transparent)'
                                : 'var(--md-sys-color-outline-variant)'
                            }`,
                          }}
                        >
                          {answer ? <RankBadge rank={answer.rank} /> : (
                            <span className="w-8 text-center text-sm text-[var(--md-sys-color-outline)]">—</span>
                          )}
                          <p className="text-sm font-semibold flex-1 truncate text-[var(--md-sys-color-on-surface)]">
                            {team.name}
                          </p>
                          {isCoding && answer?.testsTotal > 0 ? (
                            <span
                              className="text-xs font-bold flex-shrink-0"
                              style={{
                                color: isCorrect
                                  ? 'var(--md-sys-color-tertiary)'
                                  : 'var(--md-sys-color-on-surface-variant)',
                              }}
                            >
                              {answer.testsPassed}/{answer.testsTotal}
                            </span>
                          ) : (
                            <span
                              className="material-symbols-outlined text-base flex-shrink-0"
                              style={{
                                color: isCorrect
                                  ? 'var(--md-sys-color-tertiary)'
                                  : 'var(--md-sys-color-error)',
                              }}
                            >
                              {isCorrect ? 'check_circle' : 'cancel'}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {pendingList.length > 0 && (
                      <>
                        {submittedList.length > 0 && (
                          <div
                            className="mx-3 my-2"
                            style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}
                          />
                        )}
                        {pendingList.map(team => (
                          <div
                            key={team.id}
                            className="flex items-center gap-3 mx-3 px-3 py-2 rounded-lg mb-1.5 opacity-50"
                            style={{
                              background: 'var(--md-sys-color-surface-container)',
                              border: '1px solid var(--md-sys-color-outline-variant)',
                            }}
                          >
                            <span className="w-8 text-center text-sm text-[var(--md-sys-color-outline)]">…</span>
                            <p className="text-sm flex-1 truncate text-[var(--md-sys-color-on-surface-variant)]">
                              {team.name}
                            </p>
                            <MdChip
                              variant="suggestion"
                              appearance="outlined"
                              label="pending"
                              density="-2"
                            />
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
        .md-content code {
          background: var(--md-sys-color-surface-container-highest);
          padding: 0.1em 0.4em;
          border-radius: 4px;
          font-family: monospace;
        }
        .md-content pre {
          background: var(--md-sys-color-surface-container);
          padding: 1em;
          border-radius: 8px;
          overflow-x: auto;
        }
        .md-content p { margin: 0.3em 0; }
        .md-content li { margin-left: 1.5em; list-style: disc; }
        .md-content strong { font-weight: bold; }
        .md-content em { font-style: italic; }
      `}</style>
    </div>
  );
}
