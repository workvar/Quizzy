'use client';
import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CodeEditor } from '@/components/CodeEditor';
import { Spinner } from './AdminUI';
import { renderMd } from '@/functions/renderMd';

export function EditQuestionModal({ question, sections, onClose, onSaved }) {
  const [title, setTitle] = useState(question.title);
  const [content, setContent] = useState(question.content);
  const [sectionId, setSectionId] = useState(question.sectionId?.toString() || '');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(question.timeLimitSeconds?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [isMultiAnswer, setIsMultiAnswer] = useState(question.isMultiAnswer);
  const [options, setOptions] = useState(question.options?.length ? question.options.map(o => ({ content: o.content, isCorrect: o.isCorrect })) : [{ content: '', isCorrect: false }, { content: '', isCorrect: false }]);

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
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Time Limit (sec)</label>
            <input type="number" min="5" max="600" value={timeLimitSeconds} onChange={e => setTimeLimitSeconds(e.target.value)} placeholder="e.g. 60 (optional)" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
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