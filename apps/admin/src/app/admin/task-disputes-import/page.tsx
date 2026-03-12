'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle2, XCircle } from 'lucide-react';

interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  matched: number;
  errors: string[];
}

export default function TaskDisputesImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/task-disputes/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed');
      } else {
        setResult(data.summary);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Disputes CSV</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Upload the <code className="bg-[var(--card-bg)] px-1 rounded">feedback_disputes_report.csv</code> export.
          Existing rows are updated by external ID; new rows are inserted.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center mb-6 transition-colors ${
            file ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)]'
          }`}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const dropped = e.dataTransfer.files[0];
            if (dropped?.name.endsWith('.csv')) setFile(dropped);
          }}
        >
          {file ? (
            <div>
              <CheckCircle2 className="w-10 h-10 text-[var(--accent)] mx-auto mb-3" />
              <div className="font-medium">{file.name}</div>
              <div className="text-sm text-[var(--text-secondary)] mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              <button
                onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] mt-3 underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <Upload className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3" />
              <div className="text-[var(--text-secondary)] mb-3">Drop CSV file here or click to browse</div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary"
              >
                Select file
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm mb-4">
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
            <div className="font-medium text-green-800 dark:text-green-300 mb-2">Import complete</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-green-700 dark:text-green-400">
              <div>New rows imported: <span className="font-medium">{result.imported}</span></div>
              <div>Existing rows updated: <span className="font-medium">{result.updated}</span></div>
              <div>Rows skipped: <span className="font-medium">{result.skipped}</span></div>
              <div>Matched to data_records: <span className="font-medium">{result.matched}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                <div className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
                  {result.errors.length} row error(s)
                </div>
                <ul className="text-xs text-orange-600 dark:text-orange-400 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="btn-primary disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
