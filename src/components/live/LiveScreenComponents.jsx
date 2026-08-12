'use client';

export function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="text-lg font-bold text-slate-400 w-8 text-center">#{rank}</span>;
}

export function CountdownRing({ timeLeft, totalTime }) {
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

export function buildSubmissionsMap(fastestAnswers, allTeams) {
  const nameToId = {};
  (allTeams || []).forEach(t => { nameToId[t.name] = t.id; });
  const map = {};
  (fastestAnswers || []).forEach(a => {
    const id = nameToId[a.teamName];
    if (id !== undefined) map[id] = a.isCorrect;
  });
  return map;
}