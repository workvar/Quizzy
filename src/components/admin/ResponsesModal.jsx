'use client';
import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { Spinner } from './AdminUI';
import { AnswerChart } from '@/components/AnswerChart';

export function ResponsesModal({ question, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/admin/questions/${question.id}/answers`).then(r => r.json()).then(setData).catch(() => {});
  }, [question.id]);

  const isCoding = question.type === 'CODING';

  return (
    <Modal title={`Responses: ${question.title}`} onClose={onClose} wide>
      {!data ? (
        <div className="flex justify-center py-8"><Spinner size={8} /></div>
      ) : (
        <div className="space-y-4">
          {!isCoding && (
            <AnswerChart
              options={data.options || []}
              optionStats={data.stats || {}}
              totalAnswered={data.total || 0}
              correctOptions={(data.options || []).filter(o => o.isCorrect).map(o => o.id)}
              selectedOptions={[]}
            />
          )}
          {isCoding && data.total > 0 && (
            <div className="bg-apple-gray border border-apple-gray-2 rounded-apple p-4">
              <p className="text-sm font-semibold text-apple-text mb-1">{data.total} submission{data.total !== 1 ? 's' : ''}</p>
              <p className="text-xs text-apple-text-2">{data.answers?.filter(a => a.isCorrect).length || 0} solved all test cases</p>
            </div>
          )}
          {data.answers?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">Team Answers ({data.total})</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.answers.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-2 rounded-apple text-sm ${r.isCorrect ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                    <div className="flex items-center gap-2">
                      {r.rank && <span className="text-xs text-apple-text-3 font-mono">#{r.rank}</span>}
                      <span className="font-medium text-apple-text">{r.teamName}</span>
                      {isCoding && r.language && <span className="text-xs text-apple-text-3 bg-apple-gray px-1.5 py-0.5 rounded font-mono">{r.language}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {isCoding && r.testsTotal > 0 && (
                        <span className="text-xs text-apple-text-2">{r.testsPassed}/{r.testsTotal} tests</span>
                      )}
                      <span className={`text-xs font-bold ${r.isCorrect ? 'text-apple-green' : 'text-apple-red'}`}>
                        {r.score > 0 ? `+${r.score}` : '0'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}