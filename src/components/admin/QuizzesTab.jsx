'use client';
import { useState, useEffect, useCallback } from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Modal } from '@/components/Modal';
import { useConfirm } from '@/components/DialogProvider';
import { Spinner, Avatar } from './AdminUI';
import { CreateQuizModal } from './CreateQuizModal';
import { AssignGroupsModal } from './CreateQuizModal';
import { QuizQuestionsPanel } from './QuizQuestionsPanel';

export function QuizzesTab() {
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [assignQuiz, setAssignQuiz] = useState(null);
  const [activating, setActivating] = useState({});
  const [deleting, setDeleting] = useState({});
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const loadQuizzes = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/quizzes').then(r => r.json());
      if (Array.isArray(data)) setQuizzes(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  const activateQuiz = async (quiz) => {
    const ok = await confirm({
      title: 'Activate quiz?',
      message: `Activate "${quiz.title}"? Assigned team groups can attempt its released questions. Multiple quizzes can be active for different groups.`,
      confirmLabel: 'Activate',
      tone: 'primary',
    });
    if (!ok) return;
    setActivating(prev => ({ ...prev, [quiz.id]: true }));
    try {
      await fetch(`/api/admin/quizzes/${quiz.id}/activate`, { method: 'POST' });
      loadQuizzes();
    } catch {}
    setActivating(prev => ({ ...prev, [quiz.id]: false }));
  };

  const deactivateQuiz = async (quiz) => {
    const ok = await confirm({
      title: 'Deactivate quiz?',
      message: `Deactivate "${quiz.title}"? Teams will no longer see its questions.`,
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (!ok) return;
    setActivating(prev => ({ ...prev, [quiz.id]: true }));
    try {
      await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      loadQuizzes();
    } catch {}
    setActivating(prev => ({ ...prev, [quiz.id]: false }));
  };

  const toggleDisable = async (quiz) => {
    try {
      await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDisabled: !quiz.isDisabled }),
      });
      loadQuizzes();
    } catch {}
  };

  const deleteQuiz = async (quiz) => {
    const ok = await confirm({
      title: 'Delete quiz?',
      message: `Delete quiz "${quiz.title}" and ALL its questions? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(prev => ({ ...prev, [quiz.id]: true }));
    try {
      await fetch(`/api/admin/quizzes/${quiz.id}`, { method: 'DELETE' });
      loadQuizzes();
    } catch {}
    setDeleting(prev => ({ ...prev, [quiz.id]: false }));
  };

  if (selectedQuiz) {
    return (
      <QuizQuestionsPanel
        quiz={selectedQuiz}
        onBack={() => { setSelectedQuiz(null); loadQuizzes(); }}
      />
    );
  }

  return (
    <div>
      {showCreate && <CreateQuizModal onClose={() => setShowCreate(false)} onCreated={loadQuizzes} />}
      {assignQuiz && <AssignGroupsModal quiz={assignQuiz} onClose={() => setAssignQuiz(null)} onSaved={loadQuizzes} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Quizzes</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{quizzes.length} quizzes · assign groups to restrict access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-brand-orange-deep transition-colors shadow-apple-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Create Quiz
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-apple-text-2 mb-4">No quizzes yet.</p>
          <button onClick={() => setShowCreate(true)} className="text-apple-blue font-semibold text-sm hover:underline">Create your first quiz →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(quiz => (
            <div key={quiz.id} className={`bg-white border rounded-apple-lg p-5 shadow-apple-sm transition-all ${quiz.isDisabled ? 'border-apple-red/30 bg-red-50/20 opacity-75' : quiz.isActive ? 'border-apple-green/50 bg-green-50/30' : 'border-apple-gray-2'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-base font-bold text-apple-text">{quiz.title}</h3>
                    {quiz.isDisabled ? <span className="text-xs font-semibold text-apple-red bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">Disabled</span> : quiz.isActive && <span className="text-xs font-semibold text-apple-green bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">Active</span>}
                  </div>
                  {quiz.description && <p className="text-sm text-apple-text-2 mb-2">{quiz.description}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-apple-text-3">{quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''}</p>
                    <span className="text-xs text-apple-text-3">·</span>
                    {quiz.groups?.length ? (
                      <p className="text-xs text-apple-text-2">
                        Groups: {quiz.groups.map(g => g.name).join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs text-apple-text-3">All teams</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  <div className="flex items-center gap-2 border border-apple-gray-2 rounded-apple px-3 py-1.5">
                    <span className="text-xs text-apple-text-2 font-medium">{quiz.isDisabled ? 'Disabled' : 'Enabled'}</span>
                    <button onClick={() => toggleDisable(quiz)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${quiz.isDisabled ? 'bg-apple-red' : 'bg-apple-green'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${quiz.isDisabled ? 'translate-x-0.5' : 'translate-x-4'}`}/>
                    </button>
                  </div>
                  <button onClick={() => setAssignQuiz(quiz)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-3 py-1.5 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors">
                    Groups
                  </button>
                  <button onClick={() => setSelectedQuiz(quiz)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-2 px-3 py-1.5 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Manage
                  </button>
                  {quiz.isActive ? (
                    <button onClick={() => deactivateQuiz(quiz)} disabled={activating[quiz.id]} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-3 py-1.5 rounded-apple hover:border-apple-red hover:text-apple-red transition-colors disabled:opacity-50">
                      {activating[quiz.id] ? <Spinner size={3} /> : null}
                      Deactivate
                    </button>
                  ) : !quiz.isDisabled && (
                    <button onClick={() => activateQuiz(quiz)} disabled={activating[quiz.id]} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-green px-3 py-1.5 rounded-apple hover:bg-green-600 transition-colors disabled:opacity-50">
                      {activating[quiz.id] ? <Spinner size={3} /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                      Activate
                    </button>
                  )}
                  <button onClick={() => deleteQuiz(quiz)} disabled={deleting[quiz.id]} className="p-1.5 text-apple-text-3 hover:text-apple-red transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}