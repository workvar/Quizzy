'use client';
import { useState, useRef } from 'react';
import { Modal } from '@/components/Modal';
import { Spinner } from './AdminUI';

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

export function UploadQuestionsModal({ quizId, onClose, onUploaded }) {
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