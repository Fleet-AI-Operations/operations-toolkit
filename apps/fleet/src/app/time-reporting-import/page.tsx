'use client';

import React, { useState, useCallback } from 'react';

interface ImportResult {
  success: boolean;
  importBatchId?: string;
  imported?: number;
  updated?: number;
  skipped?: number;
  total?: number;
  message?: string;
  error?: string;
}

interface ImportBatch {
  batchId: string;
  recordCount: number;
  importedAt: string;
}

export default function TimeReportingImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Fetch existing import batches
  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const response = await fetch('/api/time-reporting/import');
      if (response.ok) {
        const data = await response.json();
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  // Load batches on mount
  React.useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setImportResult(null);
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/time-reporting/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data);
        setFile(null); // Clear file input
        // Refresh batches list
        fetchBatches();
      } else {
        setImportResult({
          success: false,
          error: data.error || 'Import failed',
        });
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        error: error.message || 'Network error during import',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
        padding: '40px',
      }}
    >

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 600,
              marginBottom: '8px',
              background: 'linear-gradient(135deg, var(--accent) 0%, #00d4ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Time Reporting Import
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Import time logging CSV files for workforce analysis
          </p>
        </div>

        {/* Import Section */}
        <div className="glass-card" style={{ marginBottom: '32px', padding: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>
            Upload Time Logging CSV
          </h2>

          {/* File Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border-primary)'}`,
              borderRadius: '12px',
              padding: '48px',
              textAlign: 'center',
              backgroundColor: dragActive ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent',
              marginBottom: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>

            {file ? (
              <div>
                <p style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Selected: <strong>{file.name}</strong>
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Drop your CSV file here or click to browse
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Accepts CSV files with time logging data
                </p>
              </div>
            )}
          </div>

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              opacity: !file || importing ? 0.5 : 1,
              cursor: !file || importing ? 'not-allowed' : 'pointer',
            }}
          >
            {importing ? 'Importing...' : 'Import Time Logs'}
          </button>

          {/* Import Result */}
          {importResult && (
            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: importResult.success
                  ? 'rgba(0, 255, 136, 0.1)'
                  : 'rgba(255, 77, 77, 0.1)',
                border: `1px solid ${importResult.success ? '#00ff88' : '#ff4d4d'}`,
              }}
            >
              {importResult.success ? (
                <div>
                  <p style={{ color: '#00ff88', fontWeight: 600, marginBottom: '8px' }}>
                    ✅ Import Successful
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {importResult.message}
                  </p>
                  <div
                    style={{
                      marginTop: '12px',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <p>• Imported: {importResult.imported} new records</p>
                    <p>• Updated: {importResult.updated} existing records</p>
                    {importResult.skipped! > 0 && <p>• Skipped: {importResult.skipped} records</p>}
                    <p>• Total: {importResult.total} records processed</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#ff4d4d', fontWeight: 600, marginBottom: '8px' }}>
                    ❌ Import Failed
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {importResult.error}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Import History */}
        <div className="glass-card" style={{ padding: '32px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Import History</h2>
            <button onClick={fetchBatches} className="btn-secondary" disabled={loadingBatches}>
              {loadingBatches ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {batches.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px' }}>
              No import history yet. Upload your first CSV file to get started.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-primary)',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Batch ID</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      Record Count
                    </th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      Imported At
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.batchId}
                      style={{ borderBottom: '1px solid var(--border-secondary)' }}
                    >
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>
                        {batch.batchId}
                      </td>
                      <td style={{ padding: '12px' }}>{batch.recordCount}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(batch.importedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
