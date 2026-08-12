'use client';

const COLORS = ['#007AFF','#5856D6','#FF9500','#FF2D55','#AF52DE','#34C759','#00C7BE'];

export default function AnswerChart({ options, optionStats, totalAnswered, correctOptions, selectedOptions }) {
  if (!options?.length) return null;
  const total = totalAnswered || 0;

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-3">
        Answer Distribution · {total} {total === 1 ? 'response' : 'responses'}
      </p>
      {options.map((opt, i) => {
        const count = optionStats?.[opt.id] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isCorrect = correctOptions?.includes(opt.id);
        const isSelected = selectedOptions?.includes(opt.id);
        const letter = String.fromCharCode(65 + i);

        return (
          <div key={opt.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${isCorrect ? 'bg-apple-green' : 'bg-apple-gray-5'}`}>
                  {letter}
                </span>
                <span className={`truncate text-sm ${isCorrect ? 'font-semibold text-apple-green' : 'text-apple-text-2'}`}>
                  {opt.content.replace(/[*_`]/g,'').substring(0, 50)}
                  {isSelected && !isCorrect && <span className="ml-1 text-apple-red">(your pick)</span>}
                  {isCorrect && <span className="ml-1 text-apple-green">✓ correct</span>}
                </span>
              </div>
              <span className="font-mono font-semibold text-apple-text-2 ml-2 flex-shrink-0">{pct}%</span>
            </div>
            <div className="h-2 bg-apple-gray-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: isCorrect ? '#34C759' : (isSelected ? '#FF3B30' : COLORS[i % COLORS.length] + '99'),
                }}
              />
            </div>
            <p className="text-xs text-apple-text-3 text-right">{count} {count === 1 ? 'team' : 'teams'}</p>
          </div>
        );
      })}
    </div>
  );
}
