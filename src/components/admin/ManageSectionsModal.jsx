'use client';
import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { Spinner } from './AdminUI';
import { useConfirm } from '@/components/DialogProvider';

export function ManageSectionsModal({ quizId, sections, onClose, onChange }) {
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [newTimeLimit, setNewTimeLimit] = useState('');
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [timeLimitValue, setTimeLimitValue] = useState('');
  const [busy, setBusy] = useState({});

  const addSection = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await fetch('/api/admin/sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId, name: newName.trim(), timeLimitSeconds: newTimeLimit ? parseInt(newTimeLimit) : null }) });
      setNewName(''); setNewTimeLimit('');
      onChange();
    } catch {}
    setAdding(false);
  };

  const renameSection = async (id) => {
    if (!renamingValue.trim()) return;
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/admin/sections/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renamingValue.trim(), timeLimitSeconds: timeLimitValue ? parseInt(timeLimitValue) : null }) });
      setRenamingId(null);
      onChange();
    } catch {}
    setBusy(prev => ({ ...prev, [id]: false }));
  };

  const releaseAllInSection = async (id, release) => {
    setBusy(prev => ({ ...prev, [`release-${id}`]: true }));
    try {
      await fetch(`/api/admin/sections/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ releaseAll: release }) });
      onChange();
    } catch {}
    setBusy(prev => ({ ...prev, [`release-${id}`]: false }));
  };

  const deleteSection = async (id, name) => {
    const ok = await confirm({
      title: 'Delete section?',
      message: `Delete section "${name}"? Questions in it will become unsectioned.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(prev => ({ ...prev, [`del-${id}`]: true }));
    try {
      await fetch(`/api/admin/sections/${id}`, { method: 'DELETE' });
      onChange();
    } catch {}
    setBusy(prev => ({ ...prev, [`del-${id}`]: false }));
  };

  return (
    <Modal title="Manage Sections" onClose={onClose}>
      <div className="space-y-4">
        {sections.length === 0 ? (
          <p className="text-sm text-apple-text-2 text-center py-4">No sections yet. Add one below.</p>
        ) : (
          <div className="space-y-2">
            {sections.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-3 border border-apple-gray-2 rounded-apple bg-white">
                {renamingId === s.id ? (
                  <div className="flex-1 space-y-2">
                    <input autoFocus value={renamingValue} onChange={e => setRenamingValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') renameSection(s.id); if (e.key === 'Escape') setRenamingId(null); }} className="w-full text-sm px-2 py-1.5 border border-apple-gray-3 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue" placeholder="Section name" />
                    <div className="flex items-center gap-2">
                      <input type="number" value={timeLimitValue} onChange={e => setTimeLimitValue(e.target.value)} min="5" max="600" placeholder="Time limit (sec, optional)" className="flex-1 text-xs px-2 py-1.5 border border-apple-gray-3 rounded-apple focus:outline-none focus:ring-1 focus:ring-apple-blue" />
                      <button onClick={() => renameSection(s.id)} disabled={busy[s.id]} className="text-xs font-semibold text-white bg-apple-blue px-3 py-1.5 rounded-apple hover:bg-brand-orange-deep transition-colors">Save</button>
                      <button onClick={() => setRenamingId(null)} className="text-xs text-apple-text-3 hover:text-apple-text">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-apple-text block">{s.name}</span>
                      <span className="text-xs text-apple-text-3">{s.questionCount} q{s.timeLimitSeconds ? ` · ${s.timeLimitSeconds}s limit` : ''}</span>
                    </div>
                    <button onClick={() => releaseAllInSection(s.id, true)} disabled={busy[`release-${s.id}`]} className="text-xs font-semibold text-apple-green hover:underline whitespace-nowrap" title="Release all questions in section">Release All</button>
                    <button onClick={() => releaseAllInSection(s.id, false)} disabled={busy[`release-${s.id}`]} className="text-xs font-semibold text-apple-text-3 hover:text-apple-red hover:underline whitespace-nowrap" title="Unrelease all">Hide All</button>
                    <button onClick={() => { setRenamingId(s.id); setRenamingValue(s.name); setTimeLimitValue(s.timeLimitSeconds?.toString() || ''); }} className="p-1 text-apple-text-3 hover:text-apple-blue transition-colors" title="Rename">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => deleteSection(s.id, s.name)} disabled={busy[`del-${s.id}`]} className="p-1 text-apple-text-3 hover:text-apple-red transition-colors" title="Delete section">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="pt-2 border-t border-apple-gray-2 space-y-2">
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSection()} placeholder="New section name…" className="flex-1 px-3 py-2 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
            <input type="number" min="5" max="600" value={newTimeLimit} onChange={e => setNewTimeLimit(e.target.value)} placeholder="Sec" className="w-20 px-3 py-2 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" title="Section time limit (seconds)" />
            <button onClick={addSection} disabled={!newName.trim() || adding} className="px-4 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {adding && <Spinner size={3} />}Add
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}