'use client';
import { useState, useEffect, useCallback } from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Modal } from '@/components/Modal';
import { useConfirm } from '@/components/DialogProvider';
import { Spinner, Avatar } from './AdminUI';
import { renderMd } from '@/functions/renderMd';
import { AddQuestionModal } from './AddQuestionModal';
import { UploadQuestionsModal } from './UploadQuestionsModal';
import { ManageSectionsModal } from './ManageSectionsModal';
import { ResponsesModal } from './ResponsesModal';
import { EditQuestionModal } from './EditQuestionModal';

export function QuizQuestionsPanel({ quiz, onBack }) {
  const confirm = useConfirm();
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [toggling, setToggling] = useState({});
  const [deleting, setDeleting] = useState({});
  const [bulkRelease, setBulkRelease] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [responsesQ, setResponsesQ] = useState(null);
  const [editQ, setEditQ] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [qdata, sdata] = await Promise.all([
        fetch(`/api/admin/questions?quizId=${quiz.id}`).then(r => r.json()),
        fetch(`/api/admin/sections?quizId=${quiz.id}`).then(r => r.json()),
      ]);
      if (Array.isArray(qdata)) setQuestions(qdata);
      if (Array.isArray(sdata)) setSections(sdata);
    } catch {}
    setLoading(false);
  }, [quiz.id]);

  const loadQuestions = loadAll;

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleRelease = async (q) => {
    setToggling(prev => ({ ...prev, [q.id]: true }));
    try {
      await fetch(`/api/admin/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReleased: !q.isReleased }),
      });
      loadQuestions();
    } catch {}
    setToggling(prev => ({ ...prev, [q.id]: false }));
  };

  const deleteQuestion = async (q) => {
    const ok = await confirm({
      title: 'Delete question?',
      message: `Delete "${q.title}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(prev => ({ ...prev, [q.id]: true }));
    try {
      await fetch(`/api/admin/questions/${q.id}`, { method: 'DELETE' });
      loadQuestions();
    } catch {}
    setDeleting(prev => ({ ...prev, [q.id]: false }));
  };

  const bulkReleaseSection = async (sectionId, release) => {
    setBulkRelease(prev => ({ ...prev, [sectionId]: true }));
    try {
      await fetch(`/api/admin/sections/${sectionId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseAll: release }),
      });
      loadAll();
    } catch {}
    setBulkRelease(prev => ({ ...prev, [sectionId]: false }));
  };

  return (
    <div>
      {showAdd && <AddQuestionModal quizId={quiz.id} sections={sections} onClose={() => setShowAdd(false)} onAdded={loadAll} />}
      {showUpload && <UploadQuestionsModal quizId={quiz.id} onClose={() => setShowUpload(false)} onUploaded={loadAll} />}
      {showSections && <ManageSectionsModal quizId={quiz.id} sections={sections} onClose={() => setShowSections(false)} onChange={loadAll} />}
      {responsesQ && <ResponsesModal question={responsesQ} onClose={() => setResponsesQ(null)} />}
      {editQ && <EditQuestionModal question={editQ} sections={sections} onClose={() => setEditQ(null)} onSaved={loadAll} />}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-sm text-apple-blue hover:underline font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Quizzes
        </button>
        <span className="text-apple-text-3">/</span>
        <span className="text-sm font-semibold text-apple-text">{quiz.title}</span>
        {quiz.isActive && !quiz.isDisabled && <span className="text-xs font-semibold text-apple-green bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Active</span>}
        {quiz.isDisabled && <span className="text-xs font-semibold text-apple-red bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Disabled</span>}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Questions</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{questions.length} total · {questions.filter(q => q.isReleased).length} released{sections.length > 0 ? ` · ${sections.length} section${sections.length !== 1 ? 's' : ''}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSections(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h7"/></svg>
            Sections
          </button>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-brand-orange-deep transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Question
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-apple-text-2 mb-4">No questions yet.</p>
          <button onClick={() => setShowAdd(true)} className="text-apple-blue font-semibold text-sm hover:underline">Add your first question →</button>
        </div>
      ) : (() => {
        // Group questions by section
        const hasSections = questions.some(q => q.sectionId !== null);
        const groups = hasSections ? (() => {
          const g = [];
          const seen = {};
          for (const q of questions) {
            const key = q.sectionId ?? 'none';
            if (!seen[key]) {
              seen[key] = { sectionId: q.sectionId, sectionName: q.sectionName, questions: [] };
              g.push(seen[key]);
            }
            seen[key].questions.push(q);
          }
          return g;
        })() : [{ sectionId: null, sectionName: null, questions }];

        const renderQuestion = (q, i) => {
          const isOpen = expanded === q.id;
          return (
            <div key={q.id} className={`bg-white border rounded-apple-lg shadow-apple-sm overflow-hidden ${q.isReleased ? 'border-apple-green/40' : 'border-apple-gray-2'}`}>
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-apple-gray/40 transition-colors" onClick={() => setExpanded(isOpen ? null : q.id)}>
                <span className="w-6 h-6 rounded-full bg-apple-gray-2 flex items-center justify-center text-xs font-bold text-apple-text-2 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-apple-text truncate">{q.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {q.isReleased ? <span className="text-xs font-semibold text-apple-green">Released</span> : <span className="text-xs text-apple-text-3">Unreleased</span>}
                    {q.type === 'CODING' && <span className="text-xs bg-blue-100 text-apple-blue font-semibold px-1.5 py-0.5 rounded-full">Coding</span>}
                    {q.type !== 'CODING' && q.isMultiAnswer && <span className="text-xs bg-purple-100 text-purple-600 font-semibold px-1.5 py-0.5 rounded-full">Multi</span>}
                    {q.timeLimitSeconds && <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-1.5 py-0.5 rounded-full">{q.timeLimitSeconds}s</span>}
                    <span className="text-xs text-apple-text-3">{q.stats?.attempted || 0} responses</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleRelease(q)} disabled={toggling[q.id]} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${q.isReleased ? 'bg-apple-green' : 'bg-apple-gray-3'} ${toggling[q.id] ? 'opacity-50' : ''}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${q.isReleased ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                  </button>
                  {!q.isReleased && (
                    <button onClick={() => setEditQ(q)} className="p-1.5 text-apple-text-3 hover:text-apple-blue transition-colors" title="Edit question">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                  )}
                  <button onClick={() => setResponsesQ(q)} className="p-1.5 text-apple-text-3 hover:text-apple-blue transition-colors" title="View responses">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                  </button>
                  <button onClick={() => deleteQuestion(q)} disabled={deleting[q.id]} className="p-1.5 text-apple-text-3 hover:text-apple-red transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
                <svg className={`w-4 h-4 text-apple-text-3 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
              </div>
              {isOpen && (
                <div className="border-t border-apple-gray-2 px-5 py-4 space-y-4 bg-apple-gray/20">
                  <div>
                    <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">Content</p>
                    <div className="bg-white border border-apple-gray-2 rounded-apple p-4 md-content text-sm text-apple-text" dangerouslySetInnerHTML={{ __html: renderMd(q.content) }} />
                  </div>
                  {q.type === 'CODING' ? (
                    q.testCases?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">Test Cases ({q.testCases.length})</p>
                        <div className="space-y-2">
                          {q.testCases.map((tc, ti) => (
                            <div key={tc.id} className={`rounded-apple border p-3 text-xs font-mono ${tc.isHidden ? 'border-orange-200 bg-orange-50' : 'border-apple-gray-2 bg-white'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-apple-text-2">Test {ti + 1}</span>
                                {tc.isHidden && <span className="text-orange-600 font-semibold">Hidden</span>}
                              </div>
                              {tc.input && <div><span className="text-apple-text-3">In: </span><span className="whitespace-pre-wrap text-apple-text">{tc.input}</span></div>}
                              <div><span className="text-apple-text-3">Expected: </span><span className="whitespace-pre-wrap text-apple-text">{tc.expectedOutput}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ) : (
                    q.options?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">Options</p>
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => (
                            <div key={opt.id} className={`flex items-start gap-3 rounded-apple p-3 border text-sm ${opt.isCorrect ? 'border-apple-green bg-green-50' : 'border-apple-gray-2 bg-white'}`}>
                              <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${opt.isCorrect ? 'bg-apple-green' : 'bg-apple-gray-4'}`}>{String.fromCharCode(65 + oi)}</span>
                              <span className={opt.isCorrect ? 'text-green-800 font-medium' : 'text-apple-text'}>{opt.content}</span>
                              {opt.isCorrect && <span className="ml-auto text-xs font-semibold text-apple-green flex-shrink-0">✓ Correct</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {groups.map(group => (
              <div key={group.sectionId ?? 'none'}>
                {hasSections && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-apple-text-2 uppercase tracking-widest">
                      {group.sectionName ?? 'No Section'}
                    </span>
                    <span className="text-xs text-apple-text-3">{group.questions.length} question{group.questions.length !== 1 ? 's' : ''}</span>
                    {group.sectionId && (
                      <>
                        <button onClick={() => bulkReleaseSection(group.sectionId, true)} disabled={!!bulkRelease[group.sectionId]} className="text-xs font-semibold text-apple-green hover:underline disabled:opacity-50">Release All</button>
                        <button onClick={() => bulkReleaseSection(group.sectionId, false)} disabled={!!bulkRelease[group.sectionId]} className="text-xs font-semibold text-apple-text-3 hover:text-apple-red hover:underline disabled:opacity-50">Hide All</button>
                      </>
                    )}
                    <div className="flex-1 h-px bg-apple-gray-2" />
                  </div>
                )}
                <div className="space-y-3">
                  {group.questions.map((q, i) => renderQuestion(q, i))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}