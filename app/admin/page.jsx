'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AnswerChart from '@/components/AnswerChart';
import CodeEditor from '@/components/CodeEditor';
import SearchableSelect from '@/components/SearchableSelect';
import { useConfirm } from '@/components/DialogProvider';
import { LogoMark } from '@/components/Logo';
import AppHeader from '@/components/AppHeader';

/* ─── Markdown renderer ─── */
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

/* ─── Modal ─── */
function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div className={`relative bg-white/90 backdrop-blur-xl border border-white/60 rounded-apple-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`} style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.5) inset' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 flex-shrink-0">
          <h2 className="text-base font-bold text-apple-text">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors text-apple-text-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── Avatar ─── */
function Avatar({ name, size = 8 }) {
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

/* ─── Spinner ─── */
function Spinner({ size = 5 }) {
  return (
    <svg className={`animate-spin h-${size} w-${size} text-apple-blue`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
    </svg>
  );
}

/* ─── Medal ─── */
function Medal({ rank }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-bold text-apple-text-3 w-6 text-center">{rank}</span>;
}

/* ════════════════════════════════════════
   ADD QUESTION MODAL
   ════════════════════════════════════════ */
function AddQuestionModal({ quizId, sections, onClose, onAdded }) {
  const [type, setType] = useState('MCQ');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // MCQ state
  const [isMultiAnswer, setIsMultiAnswer] = useState(false);
  const [options, setOptions] = useState([
    { content: '', isCorrect: false }, { content: '', isCorrect: false },
    { content: '', isCorrect: false }, { content: '', isCorrect: false },
  ]);

  // Coding state
  const [starterLang, setStarterLang] = useState('javascript');
  const [starterJS, setStarterJS] = useState('');
  const [starterPy, setStarterPy] = useState('');
  const [allowedLanguages, setAllowedLanguages] = useState(['javascript', 'python']);
  const [testCases, setTestCases] = useState([{ input: '', expectedOutput: '', isHidden: false }]);
  // Common
  const [questionTimeLimit, setQuestionTimeLimit] = useState('');

  const toggleLanguage = (lang) => {
    setAllowedLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const updateOption = (i, field, value) => {
    setOptions(prev => {
      const next = [...prev];
      if (field === 'isCorrect' && !isMultiAnswer) {
        next.forEach((o, idx) => { next[idx] = { ...o, isCorrect: idx === i ? value : false }; });
      } else {
        next[i] = { ...next[i], [field]: value };
      }
      return next;
    });
  };

  const updateTestCase = (i, field, value) => {
    setTestCases(prev => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
  };

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (!content.trim()) { setError('Content is required'); return; }

    if (type === 'MCQ') {
      const filled = options.filter(o => o.content.trim());
      if (filled.length < 2) { setError('At least 2 options required'); return; }
      if (!filled.some(o => o.isCorrect)) { setError('At least one correct answer required'); return; }
      setSaving(true);
      try {
        const res = await fetch('/api/admin/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizId, title: title.trim(), content: content.trim(), type: 'MCQ', isMultiAnswer, options: filled, sectionId: sectionId || null, timeLimitSeconds: questionTimeLimit ? parseInt(questionTimeLimit) : null }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
        onAdded(); onClose();
      } catch { setError('Network error'); }
      setSaving(false);
    } else {
      if (allowedLanguages.length === 0) { setError('At least one language must be allowed'); return; }
      const filledCases = testCases.filter(tc => tc.expectedOutput.trim());
      if (filledCases.length === 0) { setError('At least one test case with expected output is required'); return; }
      const starterCode = {};
      if (starterJS.trim()) starterCode.javascript = starterJS;
      if (starterPy.trim()) starterCode.python = starterPy;
      setSaving(true);
      try {
        const res = await fetch('/api/admin/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizId, title: title.trim(), content: content.trim(), type: 'CODING', starterCode: Object.keys(starterCode).length ? starterCode : null, testCases: filledCases, sectionId: sectionId || null, allowedLanguages, timeLimitSeconds: questionTimeLimit ? parseInt(questionTimeLimit) : null }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
        onAdded(); onClose();
      } catch { setError('Network error'); }
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Question" onClose={onClose} wide>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}

        {/* Type selector */}
        <div className="flex gap-2 p-1 bg-apple-gray rounded-apple">
          {['MCQ', 'CODING'].map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${type === t ? 'bg-white shadow text-apple-text' : 'text-apple-text-3 hover:text-apple-text'}`}>
              {t === 'MCQ' ? 'Multiple Choice' : 'Coding Challenge'}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Title / Short Label</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'MCQ' ? 'e.g. What is Bitcoin?' : 'e.g. FizzBuzz'} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">{type === 'CODING' ? 'Problem Statement (Markdown)' : 'Question Content (Markdown)'}</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder={type === 'CODING' ? 'Describe the problem, constraints, and examples...' : 'Full question text, supports **markdown**...'} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-y font-mono" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {sections?.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Section (optional)</label>
              <SearchableSelect
                value={sectionId}
                onChange={setSectionId}
                placeholder="No section"
                searchPlaceholder="Search sections…"
                options={[
                  { value: '', label: 'No section' },
                  ...sections.map(s => ({ value: String(s.id), label: s.name })),
                ]}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Question time (sec, optional)</label>
            <input type="number" min="1" max="7200" value={questionTimeLimit} onChange={e => setQuestionTimeLimit(e.target.value)} placeholder="e.g. 60 (overrides defaults)" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>

        {type === 'MCQ' ? (
          <>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMultiAnswer(v => !v)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMultiAnswer ? 'bg-apple-blue' : 'bg-apple-gray-3'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isMultiAnswer ? 'translate-x-6' : 'translate-x-1'}`}/>
              </button>
              <span className="text-sm text-apple-text font-medium">Multi-answer</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Options</label>
                {options.length < 8 && <button onClick={() => setOptions(p => [...p, { content: '', isCorrect: false }])} className="text-xs font-semibold text-apple-blue hover:underline">+ Add option</button>}
              </div>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className={`flex items-center gap-2 p-3 rounded-apple border transition-colors ${opt.isCorrect ? 'border-apple-green bg-green-50' : 'border-apple-gray-2 bg-white'}`}>
                    <span className="w-5 h-5 rounded-full bg-apple-gray-3 flex items-center justify-center text-xs font-bold text-apple-text-2 flex-shrink-0">{String.fromCharCode(65 + i)}</span>
                    <input value={opt.content} onChange={e => updateOption(i, 'content', e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1 bg-transparent text-sm text-apple-text focus:outline-none placeholder-apple-text-3" />
                    <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
                      <input type={isMultiAnswer ? 'checkbox' : 'radio'} name="correct" checked={opt.isCorrect} onChange={e => updateOption(i, 'isCorrect', e.target.checked)} className="accent-apple-green" />
                      <span className="text-xs text-apple-text-2">Correct</span>
                    </label>
                    {options.length > 2 && (
                      <button onClick={() => setOptions(p => p.filter((_, idx) => idx !== i))} className="text-apple-text-3 hover:text-apple-red">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Allowed languages */}
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Allowed Languages</label>
              <div className="flex gap-4">
                {[{ value: 'javascript', label: 'JavaScript' }, { value: 'python', label: 'Python' }].map(lang => (
                  <label key={lang.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allowedLanguages.includes(lang.value)} onChange={() => toggleLanguage(lang.value)} className="accent-apple-blue" />
                    <span className="text-sm text-apple-text">{lang.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Starter code */}
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Starter Code (optional)</label>
              <CodeEditor language={starterLang} onLanguageChange={setStarterLang} value={starterLang === 'javascript' ? starterJS : starterPy} onChange={v => starterLang === 'javascript' ? setStarterJS(v || '') : setStarterPy(v || '')} height="180px" allowedLanguages={allowedLanguages} />
              <p className="text-xs text-apple-text-3 mt-1">Contestants will see this pre-filled. Set per-language by switching tabs.</p>
            </div>

            {/* Test cases */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Test Cases</label>
                <button onClick={() => setTestCases(p => [...p, { input: '', expectedOutput: '', isHidden: false }])} className="text-xs font-semibold text-apple-blue hover:underline">+ Add case</button>
              </div>
              <div className="space-y-3">
                {testCases.map((tc, i) => (
                  <div key={i} className={`p-3 rounded-apple border ${tc.isHidden ? 'border-orange-200 bg-orange-50' : 'border-apple-gray-2 bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-apple-text-2">Test {i + 1}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={tc.isHidden} onChange={e => updateTestCase(i, 'isHidden', e.target.checked)} className="accent-orange-500" />
                          <span className="text-xs text-apple-text-2">Hidden</span>
                        </label>
                        {testCases.length > 1 && (
                          <button onClick={() => setTestCases(p => p.filter((_, idx) => idx !== i))} className="text-apple-text-3 hover:text-apple-red">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-apple-text-3 mb-1">Input (stdin)</label>
                        <textarea value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)} rows={2} placeholder="(empty if no input)" className="w-full px-2 py-1.5 bg-apple-gray border border-apple-gray-3 rounded text-xs font-mono text-apple-text focus:outline-none focus:ring-1 focus:ring-apple-blue resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-apple-text-3 mb-1">Expected Output *</label>
                        <textarea value={tc.expectedOutput} onChange={e => updateTestCase(i, 'expectedOutput', e.target.value)} rows={2} placeholder="Expected stdout output" className="w-full px-2 py-1.5 bg-apple-gray border border-apple-gray-3 rounded text-xs font-mono text-apple-text focus:outline-none focus:ring-1 focus:ring-apple-blue resize-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-apple-text-3 mt-1">Hidden tests are used for scoring but not shown to contestants.</p>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Question'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   UPLOAD QUESTIONS CSV MODAL
   ════════════════════════════════════════ */
function DropZone({ file, onFile, accept = '.csv,text/csv' }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all ${dragging ? 'border-apple-blue bg-blue-50 scale-[1.01]' : file ? 'border-apple-green bg-green-50/60' : 'border-apple-gray-3 bg-apple-gray/40 hover:border-apple-blue hover:bg-blue-50/40'}`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => onFile(e.target.files[0])} />
      {file ? (
        <>
          <div className="w-12 h-12 rounded-full bg-apple-green/15 flex items-center justify-center">
            <svg className="w-6 h-6 text-apple-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-apple-text">{file.name}</p>
            <p className="text-xs text-apple-text-3 mt-0.5">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
          </div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-apple-blue/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-apple-text">Drop your CSV here</p>
            <p className="text-xs text-apple-text-3 mt-0.5">or click to browse files</p>
          </div>
        </>
      )}
    </div>
  );
}

function UploadQuestionsModal({ quizId, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file) { setError('Please select a CSV file'); return; }
    setError(''); setUploading(true);
    const form = new FormData();
    form.append('csv', file);
    try {
      const res = await fetch(`/api/admin/questions/upload?quizId=${quizId}`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); setUploading(false); return; }
      setResult(data);
      onUploaded();
    } catch { setError('Network error'); }
    setUploading(false);
  };

  const downloadTemplate = () => {
    const csv = `Section,Question,isMultiAnswer,Option1,Option2,Option3,Option4,CorrectAnswers\n"Round 1","What is BTC?",false,"Digital gold","A stock","A bond","CBDC","1"\n"Round 1","Pick all correct options",true,"opt1","opt2","opt3","opt4","1,3"\n,"No section question",false,"A","B","C","D","2"\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'questions_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Import Questions from CSV" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        {result ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-apple-green/15 flex items-center justify-center">
              <svg className="w-8 h-8 text-apple-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-apple-text">Import Complete</p>
              <p className="text-sm text-apple-text-2 mt-1">{result.created} question{result.created !== 1 ? 's' : ''} imported successfully</p>
            </div>
            <button onClick={onClose} className="px-6 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors">Done</button>
          </div>
        ) : (
          <>
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none bg-apple-gray/60 border border-apple-gray-2 rounded-apple px-4 py-3 hover:bg-apple-gray transition-colors">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide">CSV Format Guide</span>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={e => { e.preventDefault(); downloadTemplate(); }} className="text-xs font-semibold text-apple-blue hover:underline">Download Template</button>
                  <svg className="w-4 h-4 text-apple-text-3 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </div>
              </summary>
              <div className="mt-2 bg-[#1e1e1e] rounded-apple overflow-hidden">
                <pre className="text-xs text-green-400 font-mono p-4 overflow-x-auto leading-relaxed">{`Section,Question,isMultiAnswer,Option1,Option2,Option3,Option4,CorrectAnswers\n"Round 1","What is BTC?",false,"Digital gold","A stock","A bond","CBDC","1"\n"Round 1","Multi-select Q",true,"opt1","opt2","opt3","opt4","1,3"\n,"No section",false,"A","B","C","D","2"`}</pre>
              </div>
              <p className="text-xs text-apple-text-3 mt-1.5 px-1">Section column is optional — leave blank for no section.</p>
            </details>

            <DropZone file={file} onFile={setFile} />

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
              <button onClick={upload} disabled={!file || uploading} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
                {uploading ? <><Spinner size={4} />Importing…</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Import Questions</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   CREATE QUIZ MODAL
   ════════════════════════════════════════ */
function CreateQuizModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsPerQuestion, setPointsPerQuestion] = useState('10');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState('');
  const [defaultQuestionTimeSeconds, setDefaultQuestionTimeSeconds] = useState('');
  const [timeEnforcement, setTimeEnforcement] = useState('QUESTION');
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
          defaultQuestionTimeSeconds: defaultQuestionTimeSeconds ? parseInt(defaultQuestionTimeSeconds) : null,
          timeEnforcement,
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
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Points Per Question</label>
          <input type="number" min="1" max="1000" value={pointsPerQuestion} onChange={e => setPointsPerQuestion(e.target.value)} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div className="rounded-apple border border-apple-gray-2 bg-apple-gray/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-apple-text uppercase tracking-wide">Timing</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Quiz duration (sec)</label>
              <input type="number" min="1" max="86400" value={timeLimitSeconds} onChange={e => setTimeLimitSeconds(e.target.value)} placeholder="e.g. 3600 (=1h)" className="w-full px-4 py-2.5 bg-white border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
              <p className="text-[11px] text-apple-text-3 mt-1">Total session budget for the whole quiz</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Default question time (sec)</label>
              <input type="number" min="1" max="7200" value={defaultQuestionTimeSeconds} onChange={e => setDefaultQuestionTimeSeconds(e.target.value)} placeholder="e.g. 60" className="w-full px-4 py-2.5 bg-white border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
              <p className="text-[11px] text-apple-text-3 mt-1">Used when a question has no override</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Enforce maximum</label>
            <select value={timeEnforcement} onChange={e => setTimeEnforcement(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all">
              <option value="QUESTION">Question time — each question’s timer binds</option>
              <option value="SECTION">Section time — section budget is the max</option>
              <option value="QUIZ">Quiz time — quiz budget is the max</option>
              <option value="STRICTEST">Strictest — earliest of quiz / section / question wins</option>
            </select>
            <p className="text-[11px] text-apple-text-3 mt-1">
              Example: quiz 60m + 90×1m questions → enforce Quiz ends at 60m; enforce Question allows up to 90m.
            </p>
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

function EditQuizTimingModal({ quiz, onClose, onSaved }) {
  const [title, setTitle] = useState(quiz.title || '');
  const [description, setDescription] = useState(quiz.description || '');
  const [pointsPerQuestion, setPointsPerQuestion] = useState(String(quiz.pointsPerQuestion || 10));
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(quiz.timeLimitSeconds?.toString() || '');
  const [defaultQuestionTimeSeconds, setDefaultQuestionTimeSeconds] = useState(quiz.defaultQuestionTimeSeconds?.toString() || '');
  const [timeEnforcement, setTimeEnforcement] = useState(quiz.timeEnforcement || 'QUESTION');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          pointsPerQuestion: parseInt(pointsPerQuestion) || 10,
          timeLimitSeconds: timeLimitSeconds ? parseInt(timeLimitSeconds) : null,
          defaultQuestionTimeSeconds: defaultQuestionTimeSeconds ? parseInt(defaultQuestionTimeSeconds) : null,
          timeEnforcement,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onSaved();
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Edit Quiz" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Quiz Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Points Per Question</label>
          <input type="number" min="1" max="1000" value={pointsPerQuestion} onChange={e => setPointsPerQuestion(e.target.value)} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div className="rounded-apple border border-apple-gray-2 bg-apple-gray/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-apple-text uppercase tracking-wide">Timing</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Quiz duration (sec)</label>
              <input type="number" min="1" max="86400" value={timeLimitSeconds} onChange={e => setTimeLimitSeconds(e.target.value)} placeholder="e.g. 3600" className="w-full px-4 py-2.5 bg-white border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Default question time (sec)</label>
              <input type="number" min="1" max="7200" value={defaultQuestionTimeSeconds} onChange={e => setDefaultQuestionTimeSeconds(e.target.value)} placeholder="e.g. 60" className="w-full px-4 py-2.5 bg-white border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Enforce maximum</label>
            <select value={timeEnforcement} onChange={e => setTimeEnforcement(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all">
              <option value="QUESTION">Question time — each question’s timer binds</option>
              <option value="SECTION">Section time — section budget is the max</option>
              <option value="QUIZ">Quiz time — quiz budget is the max</option>
              <option value="STRICTEST">Strictest — earliest of quiz / section / question wins</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssignGroupsModal({ quiz, onClose, onSaved }) {
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

/* ════════════════════════════════════════
   RESPONSES MODAL
   ════════════════════════════════════════ */
function ResponsesModal({ question, onClose }) {
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

/* ════════════════════════════════════════
   LIVE SCORES TAB
   ════════════════════════════════════════ */
function LiveScoresTab() {
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

/* ════════════════════════════════════════
   MANAGE SECTIONS MODAL
   ════════════════════════════════════════ */
function ManageSectionsModal({ quizId, sections, onClose, onChange }) {
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [newTimeLimit, setNewTimeLimit] = useState('');
  const [newDefaultQTime, setNewDefaultQTime] = useState('');
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [timeLimitValue, setTimeLimitValue] = useState('');
  const [defaultQTimeValue, setDefaultQTimeValue] = useState('');
  const [busy, setBusy] = useState({});

  const addSection = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          name: newName.trim(),
          timeLimitSeconds: newTimeLimit ? parseInt(newTimeLimit) : null,
          defaultQuestionTimeSeconds: newDefaultQTime ? parseInt(newDefaultQTime) : null,
        }),
      });
      setNewName(''); setNewTimeLimit(''); setNewDefaultQTime('');
      onChange();
    } catch {}
    setAdding(false);
  };

  const renameSection = async (id) => {
    if (!renamingValue.trim()) return;
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/admin/sections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: renamingValue.trim(),
          timeLimitSeconds: timeLimitValue ? parseInt(timeLimitValue) : null,
          defaultQuestionTimeSeconds: defaultQTimeValue ? parseInt(defaultQTimeValue) : null,
        }),
      });
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

  const formatSec = (s) => {
    if (!s) return null;
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
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
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={timeLimitValue} onChange={e => setTimeLimitValue(e.target.value)} min="1" max="86400" placeholder="Section duration (sec)" className="text-xs px-2 py-1.5 border border-apple-gray-3 rounded-apple focus:outline-none focus:ring-1 focus:ring-apple-blue" />
                      <input type="number" value={defaultQTimeValue} onChange={e => setDefaultQTimeValue(e.target.value)} min="1" max="7200" placeholder="Default Q time (sec)" className="text-xs px-2 py-1.5 border border-apple-gray-3 rounded-apple focus:outline-none focus:ring-1 focus:ring-apple-blue" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => renameSection(s.id)} disabled={busy[s.id]} className="text-xs font-semibold text-white bg-apple-blue px-3 py-1.5 rounded-apple hover:bg-brand-orange-deep transition-colors">Save</button>
                      <button onClick={() => setRenamingId(null)} className="text-xs text-apple-text-3 hover:text-apple-text">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-apple-text block">{s.name}</span>
                      <span className="text-xs text-apple-text-3">
                        {s.questionCount} q
                        {s.timeLimitSeconds ? ` · section ${formatSec(s.timeLimitSeconds)}` : ''}
                        {s.defaultQuestionTimeSeconds ? ` · Q default ${formatSec(s.defaultQuestionTimeSeconds)}` : ''}
                      </span>
                    </div>
                    <button onClick={() => releaseAllInSection(s.id, true)} disabled={busy[`release-${s.id}`]} className="text-xs font-semibold text-apple-green hover:underline whitespace-nowrap" title="Release all questions in section">Release All</button>
                    <button onClick={() => releaseAllInSection(s.id, false)} disabled={busy[`release-${s.id}`]} className="text-xs font-semibold text-apple-text-3 hover:text-apple-red hover:underline whitespace-nowrap" title="Unrelease all">Hide All</button>
                    <button onClick={() => {
                      setRenamingId(s.id);
                      setRenamingValue(s.name);
                      setTimeLimitValue(s.timeLimitSeconds?.toString() || '');
                      setDefaultQTimeValue(s.defaultQuestionTimeSeconds?.toString() || '');
                    }} className="p-1 text-apple-text-3 hover:text-apple-blue transition-colors" title="Edit">
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
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSection()} placeholder="New section name…" className="w-full px-3 py-2 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          <div className="flex gap-2">
            <input type="number" min="1" max="86400" value={newTimeLimit} onChange={e => setNewTimeLimit(e.target.value)} placeholder="Section sec" className="flex-1 px-3 py-2 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" title="Section duration (seconds)" />
            <input type="number" min="1" max="7200" value={newDefaultQTime} onChange={e => setNewDefaultQTime(e.target.value)} placeholder="Q default" className="flex-1 px-3 py-2 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" title="Default question time (seconds)" />
            <button onClick={addSection} disabled={!newName.trim() || adding} className="px-4 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {adding && <Spinner size={3} />}Add
            </button>
          </div>
          <p className="text-xs text-apple-text-3">Section duration = total budget for the section. Q default overrides the quiz default for questions in this section. Enforcement is set on the quiz.</p>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   EDIT QUESTION MODAL
   ════════════════════════════════════════ */
function EditQuestionModal({ question, sections, onClose, onSaved }) {
  const [title, setTitle] = useState(question.title);
  const [content, setContent] = useState(question.content);
  const [sectionId, setSectionId] = useState(question.sectionId?.toString() || '');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(question.timeLimitSeconds?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // MCQ
  const [isMultiAnswer, setIsMultiAnswer] = useState(question.isMultiAnswer);
  const [options, setOptions] = useState(question.options?.length ? question.options.map(o => ({ content: o.content, isCorrect: o.isCorrect })) : [{ content: '', isCorrect: false }, { content: '', isCorrect: false }]);

  // Coding
  const [starterLang, setStarterLang] = useState('javascript');
  const starterCodeObj = question.starterCode ? JSON.parse(question.starterCode) : {};
  const [starterJS, setStarterJS] = useState(starterCodeObj.javascript || '');
  const [starterPy, setStarterPy] = useState(starterCodeObj.python || '');
  const [allowedLanguages, setAllowedLanguages] = useState(question.allowedLanguages || ['javascript', 'python']);
  const [testCases, setTestCases] = useState(question.testCases?.length ? question.testCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput, isHidden: tc.isHidden })) : [{ input: '', expectedOutput: '', isHidden: false }]);

  const isCoding = question.type === 'CODING';

  const updateOption = (i, field, value) => {
    setOptions(prev => {
      const next = [...prev];
      if (field === 'isCorrect' && !isMultiAnswer) next.forEach((o, idx) => { next[idx] = { ...o, isCorrect: idx === i ? value : false }; });
      else next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const updateTestCase = (i, field, value) => setTestCases(prev => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });

  const toggleLanguage = (lang) => setAllowedLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (!content.trim()) { setError('Content is required'); return; }
    if (!isCoding) {
      const filled = options.filter(o => o.content.trim());
      if (filled.length < 2) { setError('At least 2 options required'); return; }
      if (!filled.some(o => o.isCorrect)) { setError('At least one correct answer required'); return; }
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/questions/${question.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), content: content.trim(), isMultiAnswer, options: filled, sectionId: sectionId ? parseInt(sectionId) : null, timeLimitSeconds: timeLimitSeconds ? parseInt(timeLimitSeconds) : null }) });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
        onSaved(); onClose();
      } catch { setError('Network error'); }
    } else {
      if (allowedLanguages.length === 0) { setError('At least one language must be allowed'); return; }
      const filledCases = testCases.filter(tc => tc.expectedOutput.trim());
      if (filledCases.length === 0) { setError('At least one test case required'); return; }
      const starterCode = {};
      if (starterJS.trim()) starterCode.javascript = starterJS;
      if (starterPy.trim()) starterCode.python = starterPy;
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/questions/${question.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), content: content.trim(), starterCode: Object.keys(starterCode).length ? starterCode : null, allowedLanguages, testCases: filledCases, sectionId: sectionId ? parseInt(sectionId) : null, timeLimitSeconds: timeLimitSeconds ? parseInt(timeLimitSeconds) : null }) });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
        onSaved(); onClose();
      } catch { setError('Network error'); }
    }
    setSaving(false);
  };

  return (
    <Modal title={`Edit: ${question.title}`} onClose={onClose} wide>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">{isCoding ? 'Problem Statement (Markdown)' : 'Content (Markdown)'}</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-y font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {sections?.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Section</label>
              <SearchableSelect
                value={sectionId}
                onChange={setSectionId}
                placeholder="No section"
                searchPlaceholder="Search sections…"
                options={[
                  { value: '', label: 'No section' },
                  ...sections.map(s => ({ value: String(s.id), label: s.name })),
                ]}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Question time (sec)</label>
            <input type="number" min="1" max="7200" value={timeLimitSeconds} onChange={e => setTimeLimitSeconds(e.target.value)} placeholder="e.g. 60 (optional)" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>

        {!isCoding ? (
          <>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMultiAnswer(v => !v)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMultiAnswer ? 'bg-apple-blue' : 'bg-apple-gray-3'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isMultiAnswer ? 'translate-x-6' : 'translate-x-1'}`}/>
              </button>
              <span className="text-sm text-apple-text font-medium">Multi-answer</span>
            </div>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className={`flex items-center gap-2 p-3 rounded-apple border transition-colors ${opt.isCorrect ? 'border-apple-green bg-green-50' : 'border-apple-gray-2 bg-white'}`}>
                  <span className="w-5 h-5 rounded-full bg-apple-gray-3 flex items-center justify-center text-xs font-bold text-apple-text-2 flex-shrink-0">{String.fromCharCode(65 + i)}</span>
                  <input value={opt.content} onChange={e => updateOption(i, 'content', e.target.value)} className="flex-1 bg-transparent text-sm text-apple-text focus:outline-none" />
                  <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
                    <input type={isMultiAnswer ? 'checkbox' : 'radio'} name="edit-correct" checked={opt.isCorrect} onChange={e => updateOption(i, 'isCorrect', e.target.checked)} className="accent-apple-green" />
                    <span className="text-xs text-apple-text-2">Correct</span>
                  </label>
                  {options.length > 2 && <button onClick={() => setOptions(p => p.filter((_, idx) => idx !== i))} className="text-apple-text-3 hover:text-apple-red"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                </div>
              ))}
              {options.length < 8 && <button onClick={() => setOptions(p => [...p, { content: '', isCorrect: false }])} className="text-xs font-semibold text-apple-blue hover:underline">+ Add option</button>}
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Allowed Languages</label>
              <div className="flex gap-4">
                {[{ value: 'javascript', label: 'JavaScript' }, { value: 'python', label: 'Python' }].map(lang => (
                  <label key={lang.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allowedLanguages.includes(lang.value)} onChange={() => toggleLanguage(lang.value)} className="accent-apple-blue" />
                    <span className="text-sm text-apple-text">{lang.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Starter Code (optional)</label>
              <CodeEditor language={starterLang} onLanguageChange={setStarterLang} value={starterLang === 'javascript' ? starterJS : starterPy} onChange={v => starterLang === 'javascript' ? setStarterJS(v || '') : setStarterPy(v || '')} height="160px" allowedLanguages={allowedLanguages} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Test Cases</label>
                <button onClick={() => setTestCases(p => [...p, { input: '', expectedOutput: '', isHidden: false }])} className="text-xs font-semibold text-apple-blue hover:underline">+ Add case</button>
              </div>
              <div className="space-y-3">
                {testCases.map((tc, i) => (
                  <div key={i} className={`p-3 rounded-apple border ${tc.isHidden ? 'border-orange-200 bg-orange-50' : 'border-apple-gray-2 bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-apple-text-2">Test {i + 1}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={tc.isHidden} onChange={e => updateTestCase(i, 'isHidden', e.target.checked)} className="accent-orange-500" /><span className="text-xs text-apple-text-2">Hidden</span></label>
                        {testCases.length > 1 && <button onClick={() => setTestCases(p => p.filter((_, idx) => idx !== i))} className="text-apple-text-3 hover:text-apple-red"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-xs text-apple-text-3 mb-1">Input (stdin)</label><textarea value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)} rows={2} className="w-full px-2 py-1.5 bg-apple-gray border border-apple-gray-3 rounded text-xs font-mono text-apple-text focus:outline-none focus:ring-1 focus:ring-apple-blue resize-none" /></div>
                      <div><label className="block text-xs text-apple-text-3 mb-1">Expected Output *</label><textarea value={tc.expectedOutput} onChange={e => updateTestCase(i, 'expectedOutput', e.target.value)} rows={2} className="w-full px-2 py-1.5 bg-apple-gray border border-apple-gray-3 rounded text-xs font-mono text-apple-text focus:outline-none focus:ring-1 focus:ring-apple-blue resize-none" /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   QUESTIONS LIST (inside a quiz)
   ════════════════════════════════════════ */
function QuizQuestionsPanel({ quiz, onBack }) {
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

/* ════════════════════════════════════════
   QUIZZES TAB
   ════════════════════════════════════════ */
function QuizzesTab() {
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [assignQuiz, setAssignQuiz] = useState(null);
  const [editQuiz, setEditQuiz] = useState(null);
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
      {editQuiz && <EditQuizTimingModal quiz={editQuiz} onClose={() => setEditQuiz(null)} onSaved={loadQuizzes} />}

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
                    {quiz.timeLimitSeconds && (
                      <>
                        <span className="text-xs text-apple-text-3">·</span>
                        <span className="text-xs text-apple-text-2">Quiz {quiz.timeLimitSeconds >= 60 ? `${Math.round(quiz.timeLimitSeconds / 60)}m` : `${quiz.timeLimitSeconds}s`}</span>
                      </>
                    )}
                    {quiz.defaultQuestionTimeSeconds && (
                      <>
                        <span className="text-xs text-apple-text-3">·</span>
                        <span className="text-xs text-apple-text-2">Q {quiz.defaultQuestionTimeSeconds}s</span>
                      </>
                    )}
                    {quiz.timeEnforcement && quiz.timeEnforcement !== 'QUESTION' && (
                      <>
                        <span className="text-xs text-apple-text-3">·</span>
                        <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">Enforce {quiz.timeEnforcement.toLowerCase()}</span>
                      </>
                    )}
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
                  <button onClick={() => setEditQuiz(quiz)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-3 py-1.5 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors">
                    Timing
                  </button>
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

/* ════════════════════════════════════════
   TEAMS TAB
   ════════════════════════════════════════ */
function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) { setError('Group name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onCreated(data);
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Create Team Group" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Group Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Track A · Juniors" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateTeamModal({ onClose, onCreated, groups, onGroupsChange }) {
  const [teamname, setTeamname] = useState('');
  const [password, setPassword] = useState('');
  const [groupId, setGroupId] = useState('__none__');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const groupOptions = [
    { value: '__none__', label: 'No group' },
    ...groups.map(g => ({ value: String(g.id), label: g.name })),
  ];

  const createGroup = async (name) => {
    const res = await fetch('/api/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    onGroupsChange?.();
    setGroupId(String(data.id));
  };

  const submit = async () => {
    setError('');
    if (!teamname.trim()) { setError('Team name is required'); return; }
    if (!password.trim()) { setError('Password is required'); return; }
    setSaving(true);
    try {
      const payload = { name: teamname.trim(), password };
      if (groupId && groupId !== '__none__') payload.groupId = parseInt(groupId);
      const res = await fetch('/api/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onCreated();
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Create Team" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Team Name</label>
          <input value={teamname} onChange={e => setTeamname(e.target.value)} placeholder="e.g. TeamAlpha" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Password</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Team login password" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Team Group</label>
          <SearchableSelect
            value={groupId}
            onChange={setGroupId}
            options={groupOptions}
            placeholder="Select group…"
            searchPlaceholder="Search or add group…"
            creatable
            onCreate={async (name) => {
              try { await createGroup(name); } catch (e) { setError(e.message); }
            }}
            createLabel={(q) => `Add new: “${q}”`}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Team'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UploadTeamsModal({ onClose, onUploaded, groups, onGroupsChange }) {
  const [file, setFile] = useState(null);
  const [groupId, setGroupId] = useState('__none__');
  const [pendingNewName, setPendingNewName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const groupOptions = [
    { value: '__none__', label: 'No group (optional)' },
    ...groups.map(g => ({ value: String(g.id), label: g.name })),
  ];

  const createGroup = async (name) => {
    const res = await fetch('/api/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    onGroupsChange?.();
    setPendingNewName('');
    setGroupId(String(data.id));
    return data;
  };

  const upload = async () => {
    if (!file) { setError('Please select a CSV file'); return; }
    setError(''); setUploading(true);
    const form = new FormData();
    form.append('csv', file);
    if (groupId && groupId !== '__none__') {
      form.append('groupId', groupId);
    } else if (pendingNewName.trim()) {
      form.append('groupName', pendingNewName.trim());
    }
    try {
      const res = await fetch('/api/admin/teams/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); setUploading(false); return; }
      setResult(data);
      onGroupsChange?.();
      onUploaded();
    } catch { setError('Network error'); }
    setUploading(false);
  };

  const downloadTemplate = () => {
    const csv = `name,password\nTeamAlpha,pass123\nTeamBeta,securepass\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'teams_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Import Teams from CSV" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        {result ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-apple-green/15 flex items-center justify-center">
              <svg className="w-8 h-8 text-apple-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-apple-text">Import Complete</p>
              <p className="text-sm text-apple-text-2 mt-1">{result.created} team{result.created !== 1 ? 's' : ''} imported</p>
              {result.errors?.length > 0 && result.errors.map((e, i) => <p key={i} className="text-xs text-apple-red mt-1">{e}</p>)}
            </div>
            <button onClick={onClose} className="px-6 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors">Done</button>
          </div>
        ) : (
          <>
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none bg-apple-gray/60 border border-apple-gray-2 rounded-apple px-4 py-3 hover:bg-apple-gray transition-colors">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide">CSV Format Guide</span>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={e => { e.preventDefault(); downloadTemplate(); }} className="text-xs font-semibold text-apple-blue hover:underline">Download Template</button>
                  <svg className="w-4 h-4 text-apple-text-3 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </div>
              </summary>
              <div className="mt-2 bg-[#1e1e1e] rounded-apple overflow-hidden">
                <pre className="text-xs text-green-400 font-mono p-4 leading-relaxed">{`name,password\nTeamAlpha,pass123\nTeamBeta,securepass`}</pre>
              </div>
            </details>

            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Assign to Team Group</label>
              <p className="text-xs text-apple-text-3 mb-2">Search for a group, or type a new name and choose Add new.</p>
              <SearchableSelect
                value={pendingNewName ? `__new__:${pendingNewName}` : groupId}
                onChange={(v) => {
                  setPendingNewName('');
                  setGroupId(v);
                }}
                options={
                  pendingNewName
                    ? [...groupOptions, { value: `__new__:${pendingNewName}`, label: pendingNewName }]
                    : groupOptions
                }
                placeholder="Select group for this CSV…"
                searchPlaceholder="Search or add group…"
                creatable
                onCreate={async (name) => {
                  try {
                    await createGroup(name);
                  } catch {
                    // Keep typed name so upload can create via groupName
                    setPendingNewName(name);
                    setGroupId('__none__');
                  }
                }}
                createLabel={(q) => `Add new: “${q}”`}
              />
              {pendingNewName && (
                <p className="text-xs text-apple-blue mt-1.5">Will create group “{pendingNewName}” on import.</p>
              )}
            </div>

            <DropZone file={file} onFile={setFile} />

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
              <button onClick={upload} disabled={!file || uploading} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
                {uploading ? <><Spinner size={4} />Importing…</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Import Teams</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function TeamsTab() {
  const confirm = useConfirm();
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [banning, setBanning] = useState({});
  const [updatingGroup, setUpdatingGroup] = useState({});

  const loadGroups = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/groups').then(r => r.json());
      if (Array.isArray(data)) setGroups(data);
    } catch {}
  }, []);

  const loadTeams = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/teams').then(r => r.json());
      if (Array.isArray(data)) setTeams(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTeams(); loadGroups(); }, [loadTeams, loadGroups]);

  const deleteTeam = async (team) => {
    const ok = await confirm({
      title: 'Delete team?',
      message: `Delete team "${team.name}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(prev => ({ ...prev, [team.id]: true }));
    try {
      await fetch('/api/admin/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: team.id }) });
      loadTeams();
      loadGroups();
    } catch {}
    setDeleting(prev => ({ ...prev, [team.id]: false }));
  };

  const deleteGroup = async (group) => {
    const ok = await confirm({
      title: 'Delete group?',
      message: `Delete group "${group.name}"? Teams in this group will be unassigned.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await fetch(`/api/admin/groups/${group.id}`, { method: 'DELETE' });
      loadGroups();
      loadTeams();
    } catch {}
  };

  const toggleBan = async (team) => {
    const action = team.isBanned ? 'unban' : 'ban';
    const ok = await confirm({
      title: action === 'ban' ? 'Ban team?' : 'Unban team?',
      message: `${action === 'ban' ? 'Ban' : 'Unban'} team "${team.name}"?`,
      confirmLabel: action === 'ban' ? 'Ban' : 'Unban',
      tone: action === 'ban' ? 'danger' : 'primary',
    });
    if (!ok) return;
    setBanning(prev => ({ ...prev, [team.id]: true }));
    try {
      await fetch(`/api/admin/teams/${team.id}/ban`, { method: 'POST' });
      loadTeams();
    } catch {}
    setBanning(prev => ({ ...prev, [team.id]: false }));
  };

  const setTeamGroup = async (team, nextGroupId) => {
    setUpdatingGroup(prev => ({ ...prev, [team.id]: true }));
    try {
      await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: nextGroupId === '__none__' ? null : parseInt(nextGroupId) }),
      });
      loadTeams();
      loadGroups();
    } catch {}
    setUpdatingGroup(prev => ({ ...prev, [team.id]: false }));
  };

  const groupSelectOptions = [
    { value: '__none__', label: 'No group' },
    ...groups.map(g => ({ value: String(g.id), label: g.name })),
  ];

  return (
    <div>
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreated={() => { loadGroups(); }} />}
      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} onCreated={loadTeams} groups={groups} onGroupsChange={loadGroups} />}
      {showUpload && <UploadTeamsModal onClose={() => setShowUpload(false)} onUploaded={loadTeams} groups={groups} onGroupsChange={loadGroups} />}

      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Teams</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{teams.length} registered · {groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowCreateGroup(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            Create Group
          </button>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-brand-orange-deep transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Create Team
          </button>
        </div>
      </div>

      <div className="mb-6 bg-white border border-apple-gray-2 rounded-apple-lg p-4 shadow-apple-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-apple-text">Team Groups</h3>
          <button onClick={() => setShowCreateGroup(true)} className="text-xs font-semibold text-apple-blue hover:underline">Add group</button>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-apple-text-3">No groups yet. Create one to assign teams and restrict quiz access.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <div key={g.id} className="inline-flex items-center gap-2 bg-apple-gray border border-apple-gray-2 rounded-apple px-3 py-1.5">
                <span className="text-sm font-semibold text-apple-text">{g.name}</span>
                <span className="text-xs text-apple-text-3">{g.teamCount} team{g.teamCount !== 1 ? 's' : ''}</span>
                <button onClick={() => deleteGroup(g)} className="text-apple-text-3 hover:text-apple-red" title="Delete group">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-apple-text-2 mb-4">No teams yet.</p>
          <button onClick={() => setShowCreate(true)} className="text-apple-blue font-semibold text-sm hover:underline">Create your first team →</button>
        </div>
      ) : (
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg shadow-apple-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-apple-gray border-b border-apple-gray-2">
                <th className="text-left px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Team Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden md:table-cell">Group</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Score</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Correct</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Attempted</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-gray-2">
              {teams.map(team => (
                <tr key={team.id} className="hover:bg-apple-gray/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={team.name} size={8} />
                      <div>
                        <p className="text-sm font-semibold text-apple-text">{team.name}</p>
                        <p className="text-xs text-apple-text-3 font-mono">#{team.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell min-w-[160px]">
                    <SearchableSelect
                      value={team.groupId ? String(team.groupId) : '__none__'}
                      onChange={(v) => setTeamGroup(team, v)}
                      options={groupSelectOptions}
                      disabled={!!updatingGroup[team.id]}
                      placeholder="No group"
                      searchPlaceholder="Search groups…"
                      className="min-w-[140px]"
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right"><span className="text-sm font-bold font-mono text-apple-blue">{team.total_score || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell"><span className="text-sm text-apple-green font-semibold">{team.correct_count || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell"><span className="text-sm text-apple-text-2">{team.attempted_count || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                    {team.isBanned
                      ? <span className="text-xs font-semibold text-apple-red bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Banned</span>
                      : <span className="text-xs text-apple-text-3">Active</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleBan(team)} disabled={banning[team.id]} title={team.isBanned ? 'Unban' : 'Ban'} className={`p-1.5 transition-colors ${team.isBanned ? 'text-apple-green hover:text-green-600' : 'text-orange-400 hover:text-orange-600'}`}>
                        {team.isBanned
                          ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                          : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                        }
                      </button>
                      <button onClick={() => deleteTeam(team)} disabled={deleting[team.id]} className="p-1.5 text-apple-text-3 hover:text-apple-red transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   SETTINGS TAB
   ════════════════════════════════════════ */
function Toggle({ on, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-3 w-full text-left">
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${on ? 'bg-apple-blue' : 'bg-apple-gray-3'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
      <span className="text-sm text-apple-text font-medium">{label}</span>
    </button>
  );
}

function SettingsTab() {
  const confirm = useConfirm();
  const [config, setConfig] = useState({
    contestEndTime: '',
    contestStartTime: '',
    pointsPerQuestion: 10,
    allowLateSubmit: false,
    teamLoginEnabled: true,
    arenaTagline: '',
    loginBanner: '',
  });
  const [stats, setStats] = useState(null);
  const [pistonUrl, setPistonUrl] = useState('');
  const [pistonStatus, setPistonStatus] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPassword2, setAdminPassword2] = useState('');
  const [teams, setTeams] = useState([]);
  const [message, setMessage] = useState('');
  const [messageTo, setMessageTo] = useState('everyone');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgSent, setMsgSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([
        fetch('/api/admin/settings').then(r => r.json()),
        fetch('/api/admin/teams').then(r => r.json()),
      ]);
      setConfig({
        contestEndTime: d.contestEndTime ? new Date(d.contestEndTime).toISOString().slice(0, 16) : '',
        contestStartTime: d.contestStartTime ? new Date(d.contestStartTime).toISOString().slice(0, 16) : '',
        pointsPerQuestion: d.pointsPerQuestion || 10,
        allowLateSubmit: !!d.allowLateSubmit,
        teamLoginEnabled: d.teamLoginEnabled !== false,
        arenaTagline: d.arenaTagline || '',
        loginBanner: d.loginBanner || '',
      });
      setStats(d.stats || null);
      setPistonUrl(d.pistonUrl || '');
      if (Array.isArray(t)) setTeams(t.filter(x => !x.isBanned));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError(''); setSaving(true); setSaved(false);
    if (adminPassword && adminPassword !== adminPassword2) {
      setError('Admin password confirmation does not match');
      setSaving(false);
      return;
    }
    try {
      const body = {
        contestEndTime: config.contestEndTime ? new Date(config.contestEndTime).toISOString() : '',
        contestStartTime: config.contestStartTime ? new Date(config.contestStartTime).toISOString() : '',
        pointsPerQuestion: parseInt(config.pointsPerQuestion) || 10,
        allowLateSubmit: config.allowLateSubmit,
        teamLoginEnabled: config.teamLoginEnabled,
        arenaTagline: config.arenaTagline,
        loginBanner: config.loginBanner,
      };
      if (adminPassword) body.adminPassword = adminPassword;
      const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return; }
      setSaved(true);
      setAdminPassword('');
      setAdminPassword2('');
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const runAction = async (action, extra = {}) => {
    setError('');
    setActionBusy(action);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Action failed'); setActionBusy(''); return data; }
      if (action === 'checkPiston') {
        setPistonStatus(data);
      } else {
        await load();
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
      setActionBusy('');
      return data;
    } catch {
      setError('Network error');
      setActionBusy('');
      return null;
    }
  };

  const sendBroadcast = async () => {
    if (!message.trim()) return;
    setSendingMsg(true); setMsgSent(false); setError('');
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.trim(), to: messageTo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send'); setSendingMsg(false); return; }
      setMessage('');
      setMsgSent(true);
      setTimeout(() => setMsgSent(false), 2500);
    } catch { setError('Network error'); }
    setSendingMsg(false);
  };

  const dangerAction = async (action, title, msg) => {
    const ok = await confirm({ title, message: msg, confirmLabel: 'Continue', tone: 'danger' });
    if (!ok) return;
    const data = await runAction(action);
    if (data?.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={8} /></div>;

  const endMs = config.contestEndTime ? new Date(config.contestEndTime).getTime() : null;
  const contestEnded = endMs && !Number.isNaN(endMs) && Date.now() > endMs;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-apple-text tracking-tight">Settings</h2>
        <p className="text-sm text-apple-text-2 mt-0.5">Contest timing, access, messaging, and ops controls</p>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
      {saved && <div className="mb-4 bg-green-50 border border-green-200 text-apple-green text-sm rounded-apple px-4 py-2.5 font-semibold">Settings saved.</div>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            ['Teams', stats.teams],
            ['Banned', stats.bannedTeams],
            ['Quizzes', stats.quizzes],
            ['Questions', stats.questions],
            ['Answers', stats.answers],
            ['Live quiz', stats.activeQuizTitle || '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-apple-gray-2 rounded-apple-lg p-3 shadow-apple-sm min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-apple-text-3">{label}</p>
              <p className="text-sm font-bold text-apple-text truncate mt-1" title={String(value)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Contest timing */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-apple-text">Contest timing</h3>
              <p className="text-xs text-apple-text-3 mt-0.5">Countdown + submission window</p>
            </div>
            {contestEnded ? (
              <span className="text-xs font-semibold text-apple-red bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">Ended</span>
            ) : config.contestEndTime ? (
              <span className="text-xs font-semibold text-apple-green bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">Scheduled</span>
            ) : (
              <span className="text-xs font-semibold text-apple-text-3 bg-apple-gray border border-apple-gray-2 px-2 py-0.5 rounded-md">No end</span>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Start time (optional)</label>
            <input type="datetime-local" value={config.contestStartTime} onChange={e => setConfig(prev => ({ ...prev, contestStartTime: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">End time</label>
            <input type="datetime-local" value={config.contestEndTime} onChange={e => setConfig(prev => ({ ...prev, contestEndTime: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <Toggle
            on={config.allowLateSubmit}
            onChange={v => setConfig(prev => ({ ...prev, allowLateSubmit: v }))}
            label="Allow submissions after contest end"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => runAction('endContestNow')} disabled={!!actionBusy} className="text-xs font-semibold px-3 py-1.5 rounded-apple bg-apple-red text-white hover:bg-red-600 disabled:opacity-50">End now</button>
            <button type="button" onClick={() => runAction('extendContest', { minutes: 30 })} disabled={!!actionBusy} className="text-xs font-semibold px-3 py-1.5 rounded-apple bg-apple-gray border border-apple-gray-2 text-apple-text hover:border-apple-blue disabled:opacity-50">+30 min</button>
            <button type="button" onClick={() => runAction('extendContest', { minutes: 60 })} disabled={!!actionBusy} className="text-xs font-semibold px-3 py-1.5 rounded-apple bg-apple-gray border border-apple-gray-2 text-apple-text hover:border-apple-blue disabled:opacity-50">+60 min</button>
            <button type="button" onClick={() => runAction('clearContestEnd')} disabled={!!actionBusy} className="text-xs font-semibold px-3 py-1.5 rounded-apple bg-apple-gray border border-apple-gray-2 text-apple-text hover:border-apple-blue disabled:opacity-50">Clear end</button>
          </div>
        </div>

        {/* Access & scoring */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-text">Access & scoring</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Defaults applied to new quizzes and logins</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Default points per question</label>
            <input type="number" min="1" max="1000" value={config.pointsPerQuestion} onChange={e => setConfig(prev => ({ ...prev, pointsPerQuestion: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <Toggle
            on={config.teamLoginEnabled}
            onChange={v => setConfig(prev => ({ ...prev, teamLoginEnabled: v }))}
            label="Allow team login"
          />
          <div className="pt-2 border-t border-apple-gray-2 space-y-3">
            <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Admin password</p>
            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="New password (leave blank to keep)" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
            <input type="password" value={adminPassword2} onChange={e => setAdminPassword2(e.target.value)} placeholder="Confirm new password" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-text">Login branding</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Shown on the contestant login page</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Arena tagline</label>
            <textarea rows={2} value={config.arenaTagline} onChange={e => setConfig(prev => ({ ...prev, arenaTagline: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-y" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Banner message (optional)</label>
            <input value={config.loginBanner} onChange={e => setConfig(prev => ({ ...prev, loginBanner: e.target.value }))} placeholder="e.g. Round 2 starts at 4:00 PM" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>

        {/* Broadcast */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-text">Broadcast message</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Push a toast to contestant screens</p>
          </div>
          {msgSent && <div className="bg-green-50 border border-green-200 text-apple-green text-sm rounded-apple px-3 py-2 font-semibold">Message sent.</div>}
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Send to</label>
            <SearchableSelect
              value={messageTo}
              onChange={setMessageTo}
              options={[
                { value: 'everyone', label: 'Everyone' },
                ...teams.map(t => ({ value: `team-${t.id}`, label: t.name })),
              ]}
              placeholder="Everyone"
              searchPlaceholder="Search teams…"
            />
          </div>
          <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Message to teams…" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-y" />
          <button type="button" onClick={sendBroadcast} disabled={sendingMsg || !message.trim()} className="flex items-center gap-2 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-brand-orange-deep disabled:opacity-50">
            {sendingMsg && <Spinner size={4} />}Send message
          </button>
        </div>

        {/* Code runner */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-text">Code execution</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Piston runner used for coding questions</p>
          </div>
          <div className="text-sm text-apple-text-2 break-all">
            <span className="text-xs font-semibold uppercase tracking-wide text-apple-text-3 block mb-1">PISTON_URL</span>
            {pistonUrl || 'http://localhost:2000'}
          </div>
          <button type="button" onClick={() => runAction('checkPiston')} disabled={actionBusy === 'checkPiston'} className="flex items-center gap-2 text-sm font-semibold text-apple-text bg-apple-gray border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue disabled:opacity-50">
            {actionBusy === 'checkPiston' && <Spinner size={4} />}Check connection
          </button>
          {pistonStatus && (
            <div className={`text-sm rounded-apple px-3 py-2 border ${pistonStatus.ok ? 'bg-green-50 border-green-200 text-apple-green' : 'bg-red-50 border-red-200 text-apple-red'}`}>
              {pistonStatus.ok
                ? `Online · ${pistonStatus.runtimeCount} runtime(s)`
                : `Offline · ${pistonStatus.error || `HTTP ${pistonStatus.status}`}`}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="bg-white border border-red-200 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-apple-red">Danger zone</h3>
            <p className="text-xs text-apple-text-3 mt-0.5">Affects the currently active quiz only</p>
          </div>
          <button
            type="button"
            onClick={() => dangerAction('unreleaseAllActive', 'Unrelease all questions?', 'All released questions on the active quiz will be hidden from contestants.')}
            disabled={!!actionBusy}
            className="w-full text-sm font-semibold text-apple-red bg-red-50 border border-red-200 px-4 py-2.5 rounded-apple hover:bg-red-100 disabled:opacity-50"
          >
            Unrelease all active-quiz questions
          </button>
          <button
            type="button"
            onClick={() => dangerAction('clearAnswersActive', 'Clear all answers?', 'Deletes every team submission for the active quiz. This cannot be undone.')}
            disabled={!!actionBusy}
            className="w-full text-sm font-semibold text-apple-red bg-red-50 border border-red-200 px-4 py-2.5 rounded-apple hover:bg-red-100 disabled:opacity-50"
          >
            Clear all answers on active quiz
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-apple-blue text-white font-semibold px-6 py-2.5 rounded-apple text-sm hover:bg-brand-orange-deep transition-colors disabled:opacity-50">
          {saving && <Spinner size={4} />}{saving ? 'Saving…' : 'Save Settings'}
        </button>
        <button onClick={load} className="text-sm font-semibold text-apple-text-2 hover:text-apple-blue">Reset form</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   LIVE CONTROL TAB
   ════════════════════════════════════════ */
function pickDefaultLiveQuiz(quizzes) {
  if (!Array.isArray(quizzes) || quizzes.length === 0) return null;
  return (
    quizzes.find(q => q.isActive && !q.isDisabled) ||
    quizzes.find(q => !q.isDisabled) ||
    null
  );
}

function LiveControlTab() {
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const selectedQuizIdRef = useRef('');
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [busy, setBusy] = useState({});
  const [switchError, setSwitchError] = useState('');
  const feedRef = useRef(null);

  const setSelected = (id, quiz = null) => {
    selectedQuizIdRef.current = id ? String(id) : '';
    setSelectedQuizId(selectedQuizIdRef.current);
    if (quiz) setActiveQuiz(quiz);
  };

  const loadQuizContent = useCallback(async (quizId) => {
    if (!quizId) {
      setQuestions([]);
      setSections([]);
      return;
    }
    const [qs, secs] = await Promise.all([
      fetch(`/api/admin/questions?quizId=${quizId}`).then(r => r.json()),
      fetch(`/api/admin/sections?quizId=${quizId}`).then(r => r.json()),
    ]);
    if (Array.isArray(qs)) setQuestions(qs);
    else setQuestions([]);
    if (Array.isArray(secs)) setSections(secs);
    else setSections([]);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [qdata, ldata] = await Promise.all([
        fetch('/api/admin/quizzes').then(r => r.json()),
        fetch('/api/admin/live').then(r => r.json()),
      ]);
      if (Array.isArray(qdata)) {
        setQuizzes(qdata);
        const prevId = selectedQuizIdRef.current;
        const prevQuiz = prevId ? qdata.find(q => String(q.id) === String(prevId) && !q.isDisabled) : null;
        const picked = prevQuiz || pickDefaultLiveQuiz(qdata);
        setSelected(picked ? String(picked.id) : '', picked || null);
        await loadQuizContent(picked?.id || null);
      }
      setLiveState(ldata);
    } catch {}
    setLoading(false);
  }, [loadQuizContent]);

  useEffect(() => {
    loadAll();
    const id = setInterval(() => {
      fetch('/api/admin/live').then(r => r.json()).then(setLiveState).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [loadAll]);

  const switchQuiz = async (nextId) => {
    setSwitchError('');
    if (!nextId) return;
    const quiz = quizzes.find(q => String(q.id) === String(nextId));
    if (!quiz) return;
    if (quiz.isDisabled) {
      setSwitchError('That quiz is disabled. Enable it from the Quizzes tab first.');
      return;
    }
    if (String(quiz.id) === String(activeQuiz?.id) && quiz.isActive) {
      setSelected(String(quiz.id), quiz);
      await loadQuizContent(quiz.id);
      return;
    }

    const ok = await confirm({
      title: 'Switch live quiz?',
      message: `Show "${quiz.title}" on Live Control and the projector? This clears the current on-screen question.`,
      confirmLabel: 'Switch quiz',
      tone: 'primary',
    });
    if (!ok) return;

    setSwitching(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${quiz.id}/activate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSwitchError(data.error || 'Failed to switch quiz');
        setSwitching(false);
        return;
      }
      const nextQuiz = { ...quiz, isActive: true, isDisabled: false };
      setSelected(String(quiz.id), nextQuiz);
      setQuizzes(prev => prev.map(q => ({
        ...q,
        isActive: q.id === quiz.id,
      })));
      await loadQuizContent(quiz.id);
      const live = await fetch('/api/admin/live').then(r => r.json());
      setLiveState(live);
    } catch {
      setSwitchError('Network error while switching quiz');
    }
    setSwitching(false);
  };

  const control = async (action, questionId) => {
    const key = `${action}-${questionId || ''}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      await fetch('/api/admin/live/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, questionId }),
      });
      const data = await fetch('/api/admin/live').then(r => r.json());
      setLiveState(data);
    } catch {}
    setBusy(prev => ({ ...prev, [key]: false }));
  };

  const controlSection = async (action, sectionId) => {
    const key = `${action}-${sectionId}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      await fetch('/api/admin/live/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sectionId }),
      });
      if (selectedQuizId) await loadQuizContent(selectedQuizId);
      else await loadAll();
    } catch {}
    setBusy(prev => ({ ...prev, [key]: false }));
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={8} /></div>;

  const currentQId = liveState?.currentQuestion?.id;
  const fastestAnswers = liveState?.fastestAnswers || [];
  const enabledQuizzes = quizzes.filter(q => !q.isDisabled);
  const quizOptions = enabledQuizzes.map(q => ({
    value: String(q.id),
    label: q.isActive ? `${q.title} · Live` : q.title,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Live Control</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">
            Control the projector screen at{' '}
            <a href="/live" target="_blank" className="text-apple-blue hover:underline font-semibold">/live ↗</a>
          </p>
        </div>
        <button onClick={loadAll} className="p-2 text-apple-text-3 hover:text-apple-blue transition-colors" title="Refresh">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-4 shadow-apple-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Quiz on Live</label>
            <SearchableSelect
              value={selectedQuizId}
              onChange={switchQuiz}
              disabled={switching || enabledQuizzes.length === 0}
              placeholder={enabledQuizzes.length === 0 ? 'No enabled quizzes' : 'Select a quiz…'}
              searchPlaceholder="Search quizzes…"
              options={quizOptions}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
            {switching && <Spinner size={4} />}
            {activeQuiz?.isActive && !activeQuiz?.isDisabled ? (
              <span className="text-xs font-semibold text-apple-green bg-green-50 border border-green-200 px-2.5 py-1 rounded-md">Live</span>
            ) : activeQuiz ? (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">Not activated</span>
            ) : null}
          </div>
        </div>
        {switchError && (
          <p className="mt-2 text-sm text-apple-red">{switchError}</p>
        )}
        {enabledQuizzes.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">No enabled quizzes. Create or enable one in the Quizzes tab.</p>
        )}
        {quizzes.some(q => q.isActive && q.isDisabled) && (
          <p className="mt-2 text-sm text-amber-700">A disabled quiz was previously marked active — pick an enabled quiz above to take over Live.</p>
        )}
      </div>

      {!activeQuiz ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-apple-lg p-5 mb-6">
          <p className="text-sm font-semibold text-yellow-700">No quiz selected for Live. Choose an enabled quiz above.</p>
        </div>
      ) : null}

      {sections.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-apple-text-2 uppercase tracking-wide mb-3">Sections</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.map(s => {
              const enableKey = `enableSection-${s.id}`;
              const disableKey = `disableSection-${s.id}`;
              const isBusy = busy[enableKey] || busy[disableKey];
              return (
                <div key={s.id} className={`bg-white border rounded-apple-lg p-4 shadow-apple-sm flex items-center gap-3 ${s.isEnabled ? 'border-apple-green/40' : 'border-apple-gray-2 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-apple-text truncate">{s.name}</p>
                    <p className="text-xs text-apple-text-3">{s.questionCount} question{s.questionCount !== 1 ? 's' : ''} · {s.isEnabled ? <span className="text-apple-green font-semibold">Visible to teams</span> : <span>Hidden from teams</span>}</p>
                  </div>
                  <button
                    onClick={() => controlSection(s.isEnabled ? 'disableSection' : 'enableSection', s.id)}
                    disabled={isBusy}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${s.isEnabled ? 'bg-apple-green' : 'bg-apple-gray-3'} ${isBusy ? 'opacity-50' : ''}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${s.isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions control */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-apple-text-2 uppercase tracking-wide">Questions</h3>
            {currentQId && (
              <button onClick={() => control('hideQuestion')} className="text-xs font-semibold text-apple-red hover:underline">
                Clear Screen
              </button>
            )}
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-apple-text-2 py-4 text-center">{activeQuiz ? 'No questions in this quiz.' : 'Select an active quiz first.'}</p>
          ) : (
            questions.map((q, i) => {
              const isShowing = currentQId === q.id;
              const isShowingResults = isShowing && liveState?.showResults;
              return (
                <div key={q.id} className={`bg-white border rounded-apple-lg p-4 shadow-apple-sm ${isShowing ? 'border-apple-blue/50 bg-blue-50/30' : 'border-apple-gray-2'}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-apple-gray-2 flex items-center justify-center text-xs font-bold text-apple-text-2 flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-apple-text truncate">{q.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {q.isReleased ? <span className="text-xs text-apple-green font-semibold">Released to contestants</span> : <span className="text-xs text-apple-text-3">Not released</span>}
                        {isShowing && <span className="text-xs font-semibold text-apple-blue bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">On screen</span>}
                        {q.sectionName && <span className="text-xs text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full">{q.sectionName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isShowing ? (
                        <>
                          {!isShowingResults ? (
                            <button
                              onClick={() => control('showResults', q.id)}
                              disabled={busy[`showResults-${q.id}`]}
                              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-purple-500 px-3 py-1.5 rounded-apple hover:bg-purple-600 transition-colors disabled:opacity-50"
                            >
                              {busy[`showResults-${q.id}`] ? <Spinner size={3} /> : null}
                              Show Results
                            </button>
                          ) : (
                            <button
                              onClick={() => control('hideResults')}
                              className="flex items-center gap-1.5 text-xs font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-2 px-3 py-1.5 rounded-apple hover:bg-apple-gray-2 transition-colors"
                            >
                              Hide Results
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => control('showQuestion', q.id)}
                          disabled={busy[`showQuestion-${q.id}`]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-apple-blue px-3 py-1.5 rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50"
                        >
                          {busy[`showQuestion-${q.id}`] ? <Spinner size={3} /> : null}
                          Show on Screen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Fastest Fingers Feed */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg shadow-apple-sm overflow-hidden flex flex-col" style={{ maxHeight: '500px' }}>
          <div className="px-4 py-3 border-b border-apple-gray-2 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold text-apple-text">Fastest Fingers</h3>
              <p className="text-xs text-apple-text-3">{fastestAnswers.length} answered</p>
            </div>
            {fastestAnswers.length > 0 && (
              <button onClick={() => control('resetFeed')} className="text-xs font-semibold text-apple-red hover:underline">Reset</button>
            )}
          </div>
          <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {fastestAnswers.length === 0 ? (
              <p className="text-xs text-apple-text-3 text-center py-6">No answers yet for current question.</p>
            ) : (
              fastestAnswers.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-apple border text-sm ${a.isCorrect ? 'border-apple-green/40 bg-green-50' : 'border-apple-gray-2 bg-apple-gray/30'}`}>
                  <span className="font-bold text-apple-text-3 w-6 text-center flex-shrink-0">
                    {a.rank === 1 ? '🥇' : a.rank === 2 ? '🥈' : a.rank === 3 ? '🥉' : `#${a.rank}`}
                  </span>
                  <span className="font-semibold text-apple-text flex-1 truncate">{a.teamName}</span>
                  <span className={`flex-shrink-0 ${a.isCorrect ? 'text-apple-green' : 'text-apple-red'}`}>
                    {a.isCorrect ? '✓' : '✗'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN ADMIN PAGE
   ════════════════════════════════════════ */
export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-brand-orange" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
        </svg>
      </div>
    }>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const VALID_TABS = ['scores', 'quizzes', 'teams', 'settings', 'live'];
  const tabParam = searchParams.get('tab');
  const tab = VALID_TABS.includes(tabParam) ? tabParam : 'scores';
  const setTab = (key) => router.replace(`/admin?tab=${key}`, { scroll: false });
  const [me, setMe] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.type === 'admin') setMe(d);
      setAuthChecked(true);
    }).catch(() => setAuthChecked(true));
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamname: 'admin', password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        // Re-fetch me to set admin state
        const me2 = await fetch('/api/me').then(r => r.json());
        setMe(me2);
      } else {
        setLoginError(data.error || 'Invalid password');
      }
    } catch {
      setLoginError('Connection error');
    }
    setLoginLoading(false);
  };

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  const TABS = [
    { key: 'scores', label: 'Live Scores', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
    { key: 'quizzes', label: 'Quizzes', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg> },
    { key: 'teams', label: 'Teams', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
    { key: 'settings', label: 'Settings', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
    { key: 'live', label: 'Live', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> },
  ];

  // Show login form if auth check is done but not authenticated as admin
  if (authChecked && !me) {
    return (
      <div className="min-h-screen bg-brand-mesh flex items-center justify-center p-5 relative overflow-hidden">
        <div className="brand-orb w-80 h-80 -top-16 -left-10 bg-brand-orange-soft/40" />
        <div className="w-full max-w-sm relative z-10 animate-brand-fade-up">
          <div className="text-center mb-8">
            <div className="inline-flex mb-4">
              <LogoMark size="xl" className="shadow-brand rounded-[16px]" />
            </div>
            <h1 className="font-display text-2xl font-bold text-brand-ink tracking-tight">Admin Portal</h1>
            <p className="text-brand-ink-2 text-sm mt-1">Sign in to run Quizzy</p>
          </div>
          <div className="bg-white/90 backdrop-blur-xl border border-white/70 rounded-apple-xl shadow-apple-md p-8">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-ink-2 uppercase tracking-wide mb-1.5">Admin Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 bg-brand-surface border border-brand-line rounded-apple text-brand-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all"
                />
              </div>
              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{loginError}</div>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-brand-orange text-white font-semibold py-3 rounded-apple text-sm hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-brand"
              >
                {loginLoading ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Signing in…</>
                ) : 'Sign In'}
              </button>
            </form>
            <div className="mt-4 text-center">
              <a href="/" className="text-xs text-brand-ink-3 hover:text-brand-orange transition-colors">← Back to contestant login</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show spinner while auth check is in flight
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-apple-gray flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-apple-blue" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      <AppHeader
        href="/admin"
        badge={<span className="text-[11px] font-semibold text-brand-orange bg-brand-mist border border-orange-200/70 px-2 py-0.5 rounded-md">Admin</span>}
        right={
          <>
            {me && <span className="text-sm text-brand-ink-2 hidden sm:block">{me.username || 'Admin'}</span>}
            <a href="/live" target="_blank" className="text-sm text-brand-ink-2 hover:text-brand-orange transition-colors font-medium hidden sm:block">Live Screen ↗</a>
            <button onClick={logout} className="text-sm text-brand-ink-2 hover:text-brand-orange transition-colors font-medium">Sign Out</button>
          </>
        }
      />

      <div className="max-w-6xl mx-auto px-5 py-6">
        <div className="flex items-center gap-1 bg-white border border-brand-line rounded-apple-lg p-1 shadow-apple-sm mb-7 w-fit overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-apple text-sm font-semibold transition-all whitespace-nowrap ${tab === t.key ? 'bg-brand-orange text-white shadow-apple-sm' : 'text-brand-ink-2 hover:text-brand-ink hover:bg-brand-surface'}`}>
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === 'scores' && <LiveScoresTab />}
        {tab === 'quizzes' && <QuizzesTab />}
        {tab === 'teams' && <TeamsTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'live' && <LiveControlTab />}
      </div>
    </div>
  );
}
