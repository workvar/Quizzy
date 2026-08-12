export function Avatar({ name, size = 8 }) {
  const colors = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55','#5AC8FA','#FFCC00'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none`} style={{ background: color, fontSize: size <= 8 ? '0.7rem' : '0.9rem' }}>
      {initials}
    </div>
  );
}

export function Spinner({ size = 5 }) {
  return (
    <svg className={`animate-spin h-${size} w-${size} text-apple-blue`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
    </svg>
  );
}

export function Medal({ rank }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-bold text-apple-text-3 w-6 text-center">{rank}</span>;
}