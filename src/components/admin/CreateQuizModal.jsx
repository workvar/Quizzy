'use client';
import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { Spinner } from './AdminUI';

export function CreateQuizModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsPerQuestion, setPointsPerQuestion] = useState('10');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState('');
  const [groups, setGroups] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      if (d.pointsPerQuestion) setPointsPerQuestion(String(d.pointsPerQuestion));
    }).catch(() => {});
    fetch('/api/admin/groups').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setGroups(d);
    }).catch(() => {});
  }, []);

  const toggleGroup = (id) => {
    setGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          pointsPerQuestion: parseInt(pointsPerQuestion) || 10,
          timeLimitSeconds: timeLimitSeconds ? parseInt(timeLimitSeconds) : null,
          groupIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onCreated(data);
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Create Quiz" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Quiz Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Crypto Basics Round 1" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Short description..." className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Points Per Question</label>
            <input type="number" min="1" max="1000" value={pointsPerQuestion} onChange={e => setPointsPerQuestion(e.target.value)} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Time Limit (sec, optional)</label>
            <input type="number" min="5" max="600" value={timeLimitSeconds} onChange={e => setTimeLimitSeconds(e.target.value)} placeholder="e.g. 60" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Team Groups (optional)</label>
          <p className="text-xs text-apple-text-3 mb-2">Leave empty to allow all teams. Select groups to restrict who can attempt this quiz.</p>
          {groups.length === 0 ? (
            <p className="text-xs text-apple-text-3">No groups yet — create them under Teams.</p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1.5 border border-apple-gray-2 rounded-apple p-2 bg-apple-gray/40">
              {groups.map(g => (
                <label key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-apple hover:bg-white cursor-pointer">
                  <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} className="rounded border-apple-gray-3 text-apple-blue focus:ring-apple-blue" />
                  <span className="text-sm text-apple-text">{g.name}</span>
                  <span className="text-xs text-apple-text-3 ml-auto">{g.teamCount} team{g.teamCount !== 1 ? 's' : ''}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Quiz'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AssignGroupsModal({ quiz, onClose, onSaved }) {
  const [groups, setGroups] = useState([]);
  const [groupIds, setGroupIds] = useState(quiz.groupIds || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/groups').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setGroups(d);
    }).catch(() => {});
  }, []);

  const toggleGroup = (id) => {
    setGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onSaved();
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title={`Assign Groups: ${quiz.title}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <p className="text-sm text-apple-text-2">Only teams in the selected groups can attempt this quiz. Clear all to allow every team.</p>
        {groups.length === 0 ? (
          <p className="text-sm text-apple-text-3">No team groups yet. Create groups under the Teams tab first.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1.5 border border-apple-gray-2 rounded-apple p-2 bg-apple-gray/40">
            {groups.map(g => (
              <label key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-apple hover:bg-white cursor-pointer">
                <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} className="rounded border-apple-gray-3 text-apple-blue focus:ring-apple-blue" />
                <span className="text-sm text-apple-text">{g.name}</span>
                <span className="text-xs text-apple-text-3 ml-auto">{g.teamCount} team{g.teamCount !== 1 ? 's' : ''}</span>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-between gap-3 pt-2">
          <button type="button" onClick={() => setGroupIds([])} className="px-3 py-2 text-sm font-semibold text-apple-text-2 hover:text-apple-blue">Clear all</button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
            <button onClick={save} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Spinner size={4} />}{saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}