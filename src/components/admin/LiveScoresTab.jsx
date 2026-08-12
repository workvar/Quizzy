'use client';
import { useState, useEffect, useCallback } from 'react';
import { Spinner, Medal } from './AdminUI';

export function LiveScoresTab() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadScores = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/scores').then(r => r.json());
      if (Array.isArray(data)) setScores(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadScores();
    const id = setInterval(loadScores, 5000);
    return () => clearInterval(id);
  }, [loadScores]);

  const maxScore = scores.length > 0 ? Math.max(...scores.map(s => s.score || 0), 1) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Live Scores</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{scores.length} teams · auto-refreshes every 5s</p>
        </div>
        <button onClick={loadScores} className="p-2 text-apple-text-3 hover:text-apple-blue transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : scores.length === 0 ? (
        <div className="text-center py-16 text-apple-text-2">No teams registered yet.</div>
      ) : (
        <div className="space-y-3">
          {scores.map((team, i) => {
            const rank = i + 1;
            const barPct = maxScore > 0 ? Math.round((team.score / maxScore) * 100) : 0;
            return (
              <div key={team.teamId} className={`bg-white border rounded-apple-lg p-4 shadow-apple-sm ${rank === 1 ? 'border-yellow-300' : rank === 2 ? 'border-apple-gray-3' : rank === 3 ? 'border-amber-300' : 'border-apple-gray-2'}`}>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 flex items-center justify-center"><Medal rank={rank} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-apple-text truncate">{team.teamName}</p>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-xs text-apple-text-2">{team.correct}/{team.attempted} correct</span>
                        <span className="text-lg font-bold font-mono text-apple-blue">{team.score}</span>
                        <span className="text-xs text-apple-text-3">pts</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-apple-gray-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${barPct}%`, background: rank === 1 ? '#FF9500' : rank === 2 ? '#8E8E93' : rank === 3 ? '#C17F24' : '#007AFF' }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}