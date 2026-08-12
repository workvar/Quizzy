'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const LANG_OPTIONS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
];

export default function CodeEditor({
  language,
  onLanguageChange,
  value,
  onChange,
  readOnly = false,
  height = '360px',
  allowedLanguages,
}) {
  const visibleOptions = allowedLanguages?.length
    ? LANG_OPTIONS.filter(o => allowedLanguages.includes(o.value))
    : LANG_OPTIONS;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="border border-apple-gray-3 rounded-apple-md overflow-hidden bg-[#1e1e1e]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border-b border-white/10">
        <div className="flex items-center gap-1">
          {visibleOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={readOnly}
              onClick={() => onLanguageChange?.(opt.value)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                language === opt.value
                  ? 'bg-apple-blue text-white'
                  : 'text-white/40 hover:text-white/70'
              } ${readOnly ? 'cursor-default' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-white/20 font-mono">{language}</span>
      </div>

      {/* Editor */}
      {mounted ? (
        <MonacoEditor
          height={height}
          language={language === 'python' ? 'python' : 'javascript'}
          value={value}
          onChange={onChange}
          theme="vs-dark"
          options={{
            readOnly,
            fontSize: 13,
            fontFamily: '"SF Mono", "Fira Code", Menlo, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            tabSize: language === 'python' ? 4 : 2,
            wordWrap: 'off',
            padding: { top: 8, bottom: 8 },
          }}
        />
      ) : (
        <textarea
          value={value}
          onChange={e => onChange?.(e.target.value)}
          readOnly={readOnly}
          className="w-full bg-[#1e1e1e] text-white/90 font-mono text-sm p-4 resize-none focus:outline-none"
          style={{ height }}
        />
      )}
    </div>
  );
}
