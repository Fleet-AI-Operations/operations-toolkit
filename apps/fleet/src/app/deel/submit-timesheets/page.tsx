'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Send, 
  BarChart3, 
  Settings2, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface SubmitResult {
  success: boolean;
  totalEntries: number;
  entriesSubmitted: number;
  entriesFailed: number;
  entriesSkipped: number;
  errors: Array<{
    entryId: string;
    error: string;
  }>;
}

interface SubmitStats {
  total: number;
  readyToSubmit: number;
  needsContractId: number;
  submitted: number;
  byStatus: Record<string, number>;
}

export default function SubmitTimesheetsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [stats, setStats] = useState<SubmitStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Submit options
  const [entryStatus, setEntryStatus] = useState('pending');
  const [autoApprove, setAutoApprove] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  const [batchDelay, setBatchDelay] = useState(1000);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/deel/submit-timesheets');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/deel/submit-timesheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entryStatus,
          autoApprove,
          batchSize,
          batchDelay,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Submission failed');
      }

      setResult(data.result);

      // Reload stats after submission
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <Link 
          href="/deel" 
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Deel Integration
        </Link>
        <h1 className="text-4xl font-bold mb-3 premium-gradient">Submit Timesheets</h1>
        <p className="text-white/60 text-lg">Batch submit approved time entries to Deel API</p>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="glass-card mb-8">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-400" />
            Current Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="text-xs text-white/50 mb-1">Total Entries</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-4">
              <div className="text-xs text-emerald-400/70 mb-1">Ready to Submit</div>
              <div className="text-2xl font-bold text-emerald-400">{stats.readyToSubmit}</div>
            </div>
            <div className="bg-orange-500/5 rounded-xl border border-orange-500/20 p-4">
              <div className="text-xs text-orange-400/70 mb-1">Need Contract ID</div>
              <div className="text-2xl font-bold text-orange-400">{stats.needsContractId}</div>
            </div>
            <div className="bg-blue-500/5 rounded-xl border border-blue-500/20 p-4">
              <div className="text-xs text-blue-400/70 mb-1">Submitted</div>
              <div className="text-2xl font-bold text-blue-400">{stats.submitted}</div>
            </div>
          </div>

          {Object.keys(stats.byStatus).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-wider">By Status</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-3">
                    <span className="text-xs font-medium text-white/70">{status}</span>
                    <span className="text-sm font-bold text-white leading-none">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit Controls */}
      <div className="glass-card mb-8">
        <h2 className="text-lg font-semibold mb-8 flex items-center gap-2">
          <Settings2 size={20} className="text-blue-400" />
          Submission Settings
        </h2>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/70">
                Time Entry Status
              </label>
              <select
                value={entryStatus}
                onChange={(e) => setEntryStatus(e.target.value)}
                className="input-field text-sm"
                disabled={loading}
              >
                <option value="" className="bg-neutral-900">All Statuses</option>
                <option value="pending" className="bg-neutral-900">Pending Only</option>
                <option value="failed" className="bg-neutral-900">Failed Only (Retry)</option>
              </select>
              <p className="text-xs text-white/40 mt-2">
                Filter which entries to submit by their current status
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/10">
              <input
                type="checkbox"
                id="autoApprove"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                disabled={loading}
              />
              <label htmlFor="autoApprove" className="text-sm text-white/80 cursor-pointer select-none">
                Auto-approve timesheets on submission
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/70">
                Batch Configuration
              </label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    min="1"
                    max="50"
                    placeholder="Size"
                    className="input-field text-sm"
                    disabled={loading}
                  />
                  <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tighter">Size (1-50)</p>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={batchDelay}
                    onChange={(e) => setBatchDelay(Number(e.target.value))}
                    min="0"
                    max="10000"
                    step="100"
                    placeholder="Delay"
                    className="input-field text-sm"
                    disabled={loading}
                  />
                  <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tighter">Delay (ms)</p>
                </div>
              </div>
              <p className="text-xs text-white/40 mt-2">
                Controlled processing to avoid Deel API rate limits
              </p>
            </div>
          </div>
        </div>

        <div className="relative group">
          <button
            onClick={handleSubmit}
            disabled={loading || (stats?.readyToSubmit === 0)}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:bg-white/5 disabled:border-white/10 disabled:text-white/20 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <Clock size={18} className="animate-spin" />
            ) : (
              <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            )}
            {loading ? 'Submitting Batch...' : `Submit ${stats?.readyToSubmit || 0} Timesheets to Deel`}
          </button>
        </div>

        {stats?.needsContractId && stats.needsContractId > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-4">
            <AlertCircle className="text-orange-400 mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-grow">
              <p className="text-sm text-orange-400">
                <span className="font-bold">{stats.needsContractId} entries</span> are missing contract IDs.
              </p>
              <Link 
                href="/deel/sync-contracts" 
                className="inline-flex items-center gap-1 text-xs font-semibold text-orange-400/80 hover:text-orange-300 mt-2 group"
              >
                Run contract sync first
                <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-4">
          <AlertCircle className="text-red-400 mt-0.5 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-red-400 font-bold text-sm mb-1">Execution Error</p>
            <p className="text-red-400/80 text-sm leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className={`glass-card mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
          result.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-orange-500/20 bg-orange-500/5'
        }`}>
          <div className="flex items-center gap-3 mb-6">
            {result.success ? (
              <CheckCircle2 className="text-emerald-400" size={24} />
            ) : (
              <AlertCircle className="text-orange-400" size={24} />
            )}
            <h3 className={`font-bold text-xl ${result.success ? 'text-emerald-400' : 'text-orange-400'}`}>
              Batch {result.success ? 'Successfully Processed' : 'Completed with Issues'}
            </h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8 pt-4 border-t border-white/5">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Processed</div>
              <div className="text-2xl font-bold">{result.totalEntries}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400/40 font-bold">Submitted</div>
              <div className="text-2xl font-bold text-emerald-400">{result.entriesSubmitted}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-red-400/40 font-bold">Failed</div>
              <div className="text-2xl font-bold text-red-400">{result.entriesFailed}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-white/20 font-bold">Skipped</div>
              <div className="text-2xl font-bold text-white/40">{result.entriesSkipped}</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-8 bg-black/20 rounded-xl overflow-hidden border border-white/5">
              <div className="px-4 py-2 bg-red-500/10 border-b border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Detailed Error Log</span>
                <span className="text-[10px] text-white/30">{result.errors.length} instances</span>
              </div>
              <div className="max-h-60 overflow-y-auto p-4 custom-scrollbar">
                <div className="space-y-3">
                  {result.errors.map((err, idx) => (
                    <div key={idx} className="flex gap-4 text-xs font-mono">
                      <span className="text-white/20 whitespace-nowrap">Entry {err.entryId}</span>
                      <span className="text-red-400/80 leading-relaxed">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documentation */}
      <div className="glass-card bg-white/5 border-white/10">
        <h3 className="font-bold mb-6 flex items-center gap-2">
          <Clock size={18} className="text-white/50" />
          How it works
        </h3>
        <div className="grid md:grid-cols-2 gap-8">
          <ol className="space-y-4 text-sm text-white/50 list-decimal list-inside">
            <li className="pl-2">Fetches entries with <code className="text-blue-300">contract_id</code> and <code className="text-blue-300">pending</code> status.</li>
            <li className="pl-2">Converts duration to decimal hours (e.g., 8h 30m = 8.5).</li>
            <li className="pl-2">Submits each entry to Deel API as a professional timesheet.</li>
            <li className="pl-2">Updates status: <code className="text-blue-300">pending</code> → <code className="text-blue-300">processing</code> → <code className="text-emerald-400">sent</code>.</li>
            <li className="pl-2">Stores the unique Deel timesheet ID for full traceability.</li>
          </ol>

          <div className="space-y-6">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs font-bold text-white/30 uppercase mb-3 tracking-widest">Prerequisites</p>
              <ul className="space-y-2 text-xs text-white/50">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-blue-400" />
                  Contract ID must be populated
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-blue-400" />
                  No existing Deel timesheet ID
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
