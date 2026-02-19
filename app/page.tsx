'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { deobfuscate, defaultDeobfuscatorOptions, type DeobfuscatorOptions, type DeobfuscationResult } from './lib/deobfuscator';
import { obfuscateCode, defaultObfuscatorOptions, type ObfuscatorOptions, type ObfuscationResult } from './lib/obfuscator';
import { sampleObfuscatedCode, sampleCleanCode } from './lib/samples';

const CodeEditor = dynamic(() => import('./components/CodeEditor'), { ssr: false });

type Mode = 'deobfuscator' | 'obfuscator';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  exiting?: boolean;
}

function ToggleSwitch({ active, onChange, label }: { active: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group py-1">
      <div className={`toggle-switch ${active ? 'active' : ''}`} onClick={() => onChange(!active)} />
      <span className="text-sm text-[var(--text-dim)] group-hover:text-[var(--text)] transition-colors select-none">{label}</span>
    </label>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('deobfuscator');
  const [deobInput, setDeobInput] = useState('');
  const [deobOutput, setDeobOutput] = useState('');
  const [obfInput, setObfInput] = useState('');
  const [obfOutput, setObfOutput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<DeobfuscationResult | ObfuscationResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [deobOptions, setDeobOptions] = useState<DeobfuscatorOptions>(defaultDeobfuscatorOptions);
  const [obfOptions, setObfOptions] = useState<ObfuscatorOptions>(defaultObfuscatorOptions);

  const toastIdRef = useRef(0);
  const dropRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 2500);
  }, []);

  const inputCode = mode === 'deobfuscator' ? deobInput : obfInput;
  const outputCode = mode === 'deobfuscator' ? deobOutput : obfOutput;
  const setInputCode = mode === 'deobfuscator' ? setDeobInput : setObfInput;

  const inputLines = inputCode ? inputCode.split('\n').length : 0;
  const inputChars = inputCode.length;
  const outputLines = outputCode ? outputCode.split('\n').length : 0;
  const outputChars = outputCode.length;

  const sizeChange = inputChars > 0 && outputChars > 0
    ? ((outputChars - inputChars) / inputChars * 100).toFixed(1)
    : null;

  const handleProcess = useCallback(async () => {
    const code = mode === 'deobfuscator' ? deobInput : obfInput;
    if (!code.trim()) {
      showToast('Please enter some code first', 'error');
      return;
    }

    setProcessing(true);
    setResult(null);

    // Use setTimeout to allow UI to update before heavy processing
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      if (mode === 'deobfuscator') {
        const res = deobfuscate(code, deobOptions);
        setDeobOutput(res.code);
        setResult(res);
        if (res.errors.length > 0) {
          showToast(`Completed with ${res.errors.length} warning(s)`, 'info');
        } else {
          showToast(`Deobfuscated in ${res.timeMs.toFixed(0)}ms`, 'success');
        }
      } else {
        const res = await obfuscateCode(code, obfOptions);
        setObfOutput(res.code);
        setResult(res);
        if (res.error) {
          showToast(res.error, 'error');
        } else {
          showToast(`Obfuscated in ${res.timeMs.toFixed(0)}ms`, 'success');
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Processing failed';
      showToast(msg, 'error');
    } finally {
      setProcessing(false);
    }
  }, [mode, deobInput, obfInput, deobOptions, obfOptions, showToast]);

  const handleCopy = useCallback(async () => {
    const code = outputCode;
    if (!code) {
      showToast('No output to copy', 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      showToast('Copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  }, [outputCode, showToast]);

  const handleDownload = useCallback(() => {
    const code = outputCode;
    if (!code) {
      showToast('No output to download', 'info');
      return;
    }
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'deobfuscator' ? 'deobfuscated.js' : 'obfuscated.js';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded!', 'success');
  }, [outputCode, mode, showToast]);

  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.match(/\.(js|mjs|cjs|jsx|ts|tsx)$/i) && file.type !== 'application/javascript' && file.type !== 'text/javascript' && !file.type.includes('text/')) {
      showToast('Please upload a JavaScript file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInputCode(content);
      showToast(`Loaded ${file.name}`, 'success');
    };
    reader.readAsText(file);
  }, [setInputCode, showToast]);

  const handleLoadSample = useCallback(() => {
    if (mode === 'deobfuscator') {
      setDeobInput(sampleObfuscatedCode);
      setDeobOutput('');
    } else {
      setObfInput(sampleCleanCode);
      setObfOutput('');
    }
    setResult(null);
    showToast('Sample code loaded', 'info');
  }, [mode, showToast]);

  const handleClear = useCallback(() => {
    if (mode === 'deobfuscator') {
      setDeobInput('');
      setDeobOutput('');
    } else {
      setObfInput('');
      setObfOutput('');
    }
    setResult(null);
  }, [mode]);

  const handleSwapOutputToInput = useCallback(() => {
    if (!outputCode) {
      showToast('No output to transfer', 'info');
      return;
    }
    setInputCode(outputCode);
    if (mode === 'deobfuscator') {
      setDeobOutput('');
    } else {
      setObfOutput('');
    }
    setResult(null);
    showToast('Output moved to input', 'info');
  }, [outputCode, setInputCode, mode, showToast]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleProcess();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleProcess]);

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const deobResult = result && 'transformsApplied' in result ? result as DeobfuscationResult : null;
  const obfResult = result && 'error' in result ? result as ObfuscationResult : null;

  const accentColor = mode === 'deobfuscator' ? 'var(--cyan)' : 'var(--magenta)';

  return (
    <div className="min-h-screen flex flex-col" ref={dropRef}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2">
        {toasts.map(toast => (
          <div key={toast.id} className={`px-4 py-2.5 rounded-lg text-sm font-medium backdrop-blur-md shadow-lg ${toast.exiting ? 'toast-exit' : 'toast-enter'} ${
            toast.type === 'success' ? 'bg-[var(--green)]/15 text-[var(--green)] border border-[var(--green)]/30' :
            toast.type === 'error' ? 'bg-[var(--magenta)]/15 text-[var(--magenta)] border border-[var(--magenta)]/30' :
            'bg-[var(--cyan)]/15 text-[var(--cyan)] border border-[var(--cyan)]/30'
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              )}
              {toast.type === 'error' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              )}
              {toast.type === 'info' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              )}
              {toast.message}
            </div>
          </div>
        ))}
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-[9999] bg-[var(--bg-deep)]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="drop-zone drag-over rounded-2xl p-16 text-center">
            <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <p className="text-[var(--cyan)] text-lg font-medium">Drop your .js file here</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--cyan), var(--magenta))' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                </div>
                <h1 className="text-lg font-bold tracking-wider glitch-text" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--cyan)' }}>
                  JS<span className="text-[var(--magenta)]">_</span>DECRYPT
                </h1>
              </div>
              <span className="hidden md:block text-[11px] text-[var(--text-dim)] border-l border-[var(--border)] pl-3 ml-1">
                AST-powered JS reverse engineering
              </span>
            </div>

            {/* Mode tabs */}
            <div className="flex items-center bg-[var(--bg-input)] rounded-lg p-0.5 border border-[var(--border)]">
              <button
                onClick={() => setMode('deobfuscator')}
                className={`relative px-3 sm:px-4 py-1.5 text-xs font-semibold tracking-wider transition-all rounded-md ${
                  mode === 'deobfuscator'
                    ? 'text-[var(--cyan)] bg-[var(--cyan)]/10 shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="hidden sm:inline">DEOBFUSCATE</span>
                <span className="sm:hidden">DEOBF</span>
              </button>
              <button
                onClick={() => setMode('obfuscator')}
                className={`relative px-3 sm:px-4 py-1.5 text-xs font-semibold tracking-wider transition-all rounded-md ${
                  mode === 'obfuscator'
                    ? 'text-[var(--magenta)] bg-[var(--magenta)]/10 shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="hidden sm:inline">OBFUSCATE</span>
                <span className="sm:hidden">OBF</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 sm:px-6 py-3 flex flex-col gap-3 min-h-0">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* File upload */}
            <label className="toolbar-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span className="hidden sm:inline">Upload</span>
              <input type="file" accept=".js,.mjs,.cjs,.jsx,.ts,.tsx" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }} />
            </label>

            <button onClick={handleLoadSample} className="toolbar-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>
              <span className="hidden sm:inline">Sample</span>
            </button>

            <button onClick={handleClear} className="toolbar-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span className="hidden sm:inline">Clear</span>
            </button>

            <div className="w-px h-5 bg-[var(--border)] mx-1 hidden sm:block" />

            <button onClick={() => setSettingsOpen(!settingsOpen)} className={`toolbar-btn ${settingsOpen ? 'toolbar-btn-active' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={handleSwapOutputToInput} className="toolbar-btn" title="Move output to input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>
              <span className="hidden sm:inline">Reuse</span>
            </button>

            <button onClick={handleCopy} className="toolbar-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span className="hidden sm:inline">Copy</span>
            </button>

            <button onClick={handleDownload} className="toolbar-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>

        {/* Settings panel (collapsible) */}
        {settingsOpen && (
          <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-card)] overflow-hidden fade-in">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif", color: accentColor }}>
                  {mode === 'deobfuscator' ? 'Deobfuscation' : 'Obfuscation'} Options
                </span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              {mode === 'deobfuscator' ? (
                <DeobfuscatorSettings options={deobOptions} onChange={setDeobOptions} />
              ) : (
                <ObfuscatorSettings options={obfOptions} onChange={setObfOptions} />
              )}
            </div>
          </div>
        )}

        {/* Editor panels */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0" style={{ minHeight: '420px' }}>
          {/* Input panel */}
          <div className="flex-1 editor-panel min-h-[250px] lg:min-h-0 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-input)]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
                <span className="text-[11px] font-semibold tracking-wider text-[var(--text-dim)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  INPUT
                </span>
              </div>
              <span className="text-[10px] text-[var(--text-dim)] font-mono tabular-nums">
                {inputLines} ln &middot; {formatBytes(inputChars)}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <CodeEditor
                value={inputCode}
                onChange={setInputCode}
                placeholder={mode === 'deobfuscator'
                  ? 'Paste obfuscated JavaScript here...'
                  : 'Paste JavaScript code to obfuscate...'}
              />
            </div>
          </div>

          {/* Center controls */}
          <div className="flex lg:flex-col items-center justify-center gap-3 lg:gap-4 py-1 lg:py-0 lg:px-1 shrink-0">
            <button
              onClick={handleProcess}
              disabled={processing}
              className="process-btn group"
              style={{
                '--btn-color': accentColor,
              } as React.CSSProperties}
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  <span className="hidden sm:inline text-xs tracking-wider">PROCESSING</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <span className="hidden sm:inline text-xs tracking-wider font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {mode === 'deobfuscator' ? 'RUN' : 'RUN'}
                  </span>
                </span>
              )}
            </button>

            <div className="hidden lg:flex flex-col items-center text-[10px] text-[var(--text-dim)] gap-0.5">
              <kbd className="kbd-key">Ctrl</kbd>
              <span>+</span>
              <kbd className="kbd-key">Enter</kbd>
            </div>
          </div>

          {/* Output panel */}
          <div className="flex-1 editor-panel min-h-[250px] lg:min-h-0 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-input)]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--green)]" style={{ boxShadow: '0 0 6px var(--green)' }} />
                <span className="text-[11px] font-semibold tracking-wider text-[var(--text-dim)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  OUTPUT
                </span>
              </div>
              <div className="flex items-center gap-2">
                {sizeChange !== null && outputCode && (
                  <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                    parseFloat(sizeChange) < 0
                      ? 'text-[var(--green)] bg-[var(--green)]/10'
                      : parseFloat(sizeChange) > 0
                      ? 'text-[var(--magenta)] bg-[var(--magenta)]/10'
                      : 'text-[var(--text-dim)]'
                  }`}>
                    {parseFloat(sizeChange) > 0 ? '+' : ''}{sizeChange}%
                  </span>
                )}
                <span className="text-[10px] text-[var(--text-dim)] font-mono tabular-nums">
                  {outputLines} ln &middot; {formatBytes(outputChars)}
                </span>
              </div>
            </div>
            {processing && <div className="processing-bar h-[2px]" />}
            <div className="flex-1 min-h-0">
              <CodeEditor
                value={outputCode}
                readOnly
                placeholder="Output will appear here..."
              />
            </div>
          </div>
        </div>

        {/* Result info bar */}
        {result && !processing && (
          <div className="fade-in rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            {deobResult && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                  <span className="text-xs text-[var(--green)] font-mono font-medium">
                    {deobResult.timeMs.toFixed(0)}ms
                  </span>
                </div>
                {deobResult.transformsApplied.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {deobResult.transformsApplied.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--cyan)]/8 text-[var(--cyan)] border border-[var(--cyan)]/15 font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {deobResult.errors.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--magenta)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span className="text-[11px] text-[var(--magenta)]">
                      {deobResult.errors.length} warning{deobResult.errors.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
            {obfResult && !obfResult.error && (
              <div className="flex items-center gap-2 px-4 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                <span className="text-xs text-[var(--green)] font-mono font-medium">
                  Obfuscated in {obfResult.timeMs.toFixed(0)}ms
                </span>
                {sizeChange && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--magenta)]/8 text-[var(--magenta)] border border-[var(--magenta)]/15 font-mono">
                    Size: {parseFloat(sizeChange) > 0 ? '+' : ''}{sizeChange}%
                  </span>
                )}
              </div>
            )}
            {obfResult?.error && (
              <div className="flex items-center gap-2 px-4 py-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--magenta)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span className="text-xs text-[var(--magenta)]">
                  {obfResult.error}
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-card)]/40 mt-auto">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-dim)] font-mono">10+ deobfuscation techniques</span>
            <span className="text-[10px] text-[var(--text-dim)]">&middot;</span>
            <span className="text-[10px] text-[var(--text-dim)] font-mono">Babel AST engine</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
            <kbd className="kbd-key text-[9px]">Ctrl</kbd>
            <span>+</span>
            <kbd className="kbd-key text-[9px]">Enter</kbd>
            <span className="ml-1">to process</span>
            <span className="mx-2">&middot;</span>
            <span>Drag & drop files</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Deobfuscator Settings */
function DeobfuscatorSettings({ options, onChange }: { options: DeobfuscatorOptions; onChange: (o: DeobfuscatorOptions) => void }) {
  const toggle = (key: keyof DeobfuscatorOptions) => onChange({ ...options, [key]: !options[key] });

  const settings: { key: keyof DeobfuscatorOptions; label: string; desc: string }[] = [
    { key: 'unpackStringArrays', label: 'Unpack String Arrays', desc: 'Decode Base64/RC4/hex encoded strings' },
    { key: 'resolveArrayRotation', label: 'Resolve Array Rotation', desc: 'Handle array shuffle/rotate patterns' },
    { key: 'replaceProxyFunctions', label: 'Replace Proxy Functions', desc: 'Inline proxy/wrapper functions' },
    { key: 'simplifyExpressions', label: 'Simplify Expressions', desc: 'Evaluate constants, remove void 0' },
    { key: 'removeDeadCode', label: 'Remove Dead Code', desc: 'Unreachable branches & injected code' },
    { key: 'undoControlFlowFlattening', label: 'Undo Control Flow', desc: 'Reconstruct switch-case to sequential' },
    { key: 'decodeHexUnicode', label: 'Decode Hex/Unicode', desc: 'Convert \\x41 and \\u0041 to readable' },
    { key: 'simplifyObjectAccess', label: 'Simplify Object Access', desc: 'Convert obj["prop"] to obj.prop' },
    { key: 'renameVariables', label: 'Rename Variables', desc: 'Rename _0x hex vars to readable names' },
    { key: 'beautifyOutput', label: 'Beautify Output', desc: 'Pretty-print the result' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-0.5">
      {settings.map(s => (
        <div key={s.key} className="flex items-center gap-3 py-1.5 group">
          <div className={`toggle-switch ${options[s.key] ? 'active' : ''}`} onClick={() => toggle(s.key)} />
          <div className="min-w-0">
            <span className="text-[12px] text-[var(--text-dim)] group-hover:text-[var(--text)] transition-colors select-none block leading-tight">{s.label}</span>
            <span className="text-[10px] text-[var(--text-dim)]/60 select-none block leading-tight">{s.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Obfuscator Settings */
function ObfuscatorSettings({ options, onChange }: { options: ObfuscatorOptions; onChange: (o: ObfuscatorOptions) => void }) {
  const update = <K extends keyof ObfuscatorOptions>(key: K, value: ObfuscatorOptions[K]) => onChange({ ...options, [key]: value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2">
      {/* String Array Encoding */}
      <div className="flex items-center gap-3 py-1">
        <span className="text-[12px] text-[var(--text-dim)] min-w-[120px]">String Encoding</span>
        <select
          value={options.stringArrayEncoding}
          onChange={e => update('stringArrayEncoding', e.target.value as ObfuscatorOptions['stringArrayEncoding'])}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--magenta)] transition-colors"
        >
          <option value="none">None</option>
          <option value="base64">Base64</option>
          <option value="rc4">RC4</option>
        </select>
      </div>

      {/* Variable Renaming */}
      <div className="flex items-center gap-3 py-1">
        <span className="text-[12px] text-[var(--text-dim)] min-w-[120px]">Variable Renaming</span>
        <select
          value={options.variableRenaming}
          onChange={e => update('variableRenaming', e.target.value as ObfuscatorOptions['variableRenaming'])}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--magenta)] transition-colors"
        >
          <option value="hexadecimal">Hexadecimal</option>
          <option value="mangled">Mangled</option>
        </select>
      </div>

      <div />

      <ToggleSwitch active={options.stringArrayRotation} onChange={v => update('stringArrayRotation', v)} label="String Array Rotation" />
      <ToggleSwitch active={options.stringArrayShuffle} onChange={v => update('stringArrayShuffle', v)} label="String Array Shuffle" />
      <ToggleSwitch active={options.controlFlowFlattening} onChange={v => update('controlFlowFlattening', v)} label="Control Flow Flattening" />
      <ToggleSwitch active={options.unicodeEscapeSequence} onChange={v => update('unicodeEscapeSequence', v)} label="Unicode Escape Sequence" />
      <ToggleSwitch active={options.disableConsoleOutput} onChange={v => update('disableConsoleOutput', v)} label="Disable Console Output" />
      <ToggleSwitch active={options.selfDefending} onChange={v => update('selfDefending', v)} label="Self Defending" />
      <ToggleSwitch active={options.compact} onChange={v => update('compact', v)} label="Compact Output" />
      <ToggleSwitch active={options.numbersToExpressions} onChange={v => update('numbersToExpressions', v)} label="Numbers to Expressions" />

      {/* Dead Code Injection with slider */}
      <div className="sm:col-span-2 xl:col-span-3 flex items-center gap-4 py-1">
        <ToggleSwitch active={options.deadCodeInjection} onChange={v => update('deadCodeInjection', v)} label="Dead Code Injection" />
        {options.deadCodeInjection && (
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={options.deadCodeInjectionThreshold}
              onChange={e => update('deadCodeInjectionThreshold', parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-[var(--text-dim)] font-mono w-8">{options.deadCodeInjectionThreshold.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
