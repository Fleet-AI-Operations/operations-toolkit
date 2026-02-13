'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RefreshCw, 
  Database, 
  Settings2, 
  CheckCircle2, 
  AlertCircle, 
  Users,
  Search,
  ChevronRight
} from 'lucide-react';

interface SyncResult {
  success: boolean;
  totalContracts: number;
  totalTimeEntries: number;
  entriesUpdated: number;
  entriesWithoutContract: number;
  errors: string[];
}

interface SyncStats {
  total: number;
  withContract: number;
  withoutContract: number;
  byStatus: Record<string, { withContract: number; withoutContract: number }>;
}

export default function SyncContractsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync options
  const [entryStatus, setEntryStatus] = useState('pending');
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/deel/sync-contracts');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/deel/sync-contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entryStatus,
          overwriteExisting,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Sync failed');
      }

      setResult(data.result);

      // Reload stats after sync
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
        <h1 className="text-4xl font-bold mb-3 premium-gradient">Contract Sync</h1>
        <p className="text-white/60 text-lg">Match project users to Deel contracts by email address</p>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="glass-card mb-8">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Database size={20} className="text-blue-400" />
            Current Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="text-xs text-white/50 mb-1">Total Entries</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-4">
              <div className="text-xs text-emerald-400/70 mb-1">With Contract ID</div>
              <div className="text-2xl font-bold text-emerald-400">{stats.withContract}</div>
            </div>
            <div className="bg-orange-500/5 rounded-xl border border-orange-500/20 p-4">
              <div className="text-xs text-orange-400/70 mb-1">Without Contract ID</div>
              <div className="text-2xl font-bold text-orange-400">{stats.withoutContract}</div>
            </div>
          </div>

          {Object.keys(stats.byStatus).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-wider">Breakdown by Status</h3>
              <div className="bg-black/20 rounded-xl overflow-hidden border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left px-4 py-3 font-semibold text-white/70">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-emerald-400/70">Linked</th>
                      <th className="text-right px-4 py-3 font-semibold text-orange-400/70">Unlinked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(stats.byStatus).map(([status, counts]) => (
                      <tr key={status} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-white/80">{status}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-bold">{counts.withContract}</td>
                        <td className="px-4 py-3 text-right text-orange-400 font-bold">{counts.withoutContract}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync Controls */}
      <div className="glass-card mb-8">
        <h2 className="text-lg font-semibold mb-8 flex items-center gap-2">
          <Settings2 size={20} className="text-blue-400" />
          Sync Settings
        </h2>

        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium mb-3 text-white/70">
              Filter by Entry Status
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['pending', 'processing', 'sent', 'failed'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setEntryStatus(status)}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    entryStatus === status 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                  disabled={loading}
                >
                  {status}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEntryStatus('')}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  entryStatus === '' 
                    ? 'bg-blue-600 border-blue-500 text-white' 
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
                disabled={loading}
              >
                All Statuses
              </button>
            </div>
            <p className="text-xs text-white/40 mt-3 font-light">
              Only entries matching the selected status will be synchronized with Deel contractor data.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/10">
            <input
              type="checkbox"
              id="overwriteExisting"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500/50"
              disabled={loading}
            />
            <label htmlFor="overwriteExisting" className="text-sm text-white/80 cursor-pointer select-none">
              Overwrite existing contract IDs
            </label>
          </div>

          <button
            onClick={handleSync}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-3 group"
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : (
              <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
            )}
            {loading ? 'Syncing with Deel...' : 'Start Contract Sync'}
          </button>
        </div>
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
              Sync {result.success ? 'Successfully Completed' : 'Completed with Issues'}
            </h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8 pt-4 border-t border-white/5">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Contracts</div>
              <div className="text-2xl font-bold">{result.totalContracts}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Processed</div>
              <div className="text-2xl font-bold">{result.totalTimeEntries}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400/40 font-bold">Updated</div>
              <div className="text-2xl font-bold text-emerald-400">{result.entriesUpdated}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-orange-400/40 font-bold">Unmatched</div>
              <div className="text-2xl font-bold text-orange-400">{result.entriesWithoutContract}</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-8 bg-black/20 rounded-xl overflow-hidden border border-white/5">
              <div className="px-4 py-2 bg-red-500/10 border-b border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Error Log</span>
                <span className="text-[10px] text-white/30">{result.errors.length} instances</span>
              </div>
              <div className="max-h-60 overflow-y-auto p-4 custom-scrollbar">
                <ul className="space-y-2">
                  {result.errors.map((err, idx) => (
                    <li key={idx} className="text-xs font-mono text-red-400/80 leading-relaxed flex gap-3">
                      <span className="text-white/20 select-none">•</span>
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documentation */}
      <div className="glass-card bg-white/5 border-white/10">
        <h3 className="font-bold mb-6 flex items-center gap-2">
          <ChevronRight size={18} className="text-white/50" />
          How it works
        </h3>
        <div className="grid md:grid-cols-2 gap-8">
          <ol className="space-y-4 text-sm text-white/50 list-decimal list-inside">
            <li className="pl-2">Fetches active contracts from Deel API.</li>
            <li className="pl-2">Maps emails to unique Deel contract IDs.</li>
            <li className="pl-2">Queries entries missing <code className="text-blue-300">contract_id</code>.</li>
            <li className="pl-2">Automatically matches entries via contractor email.</li>
            <li className="pl-2">Updates database with valid relationships.</li>
          </ol>

          <div className="bg-blue-500/5 rounded-xl p-5 border border-blue-500/20">
            <h4 className="text-xs font-bold text-blue-400 uppercase mb-4 tracking-widest flex items-center gap-2">
              <Users size={14} />
              Identity Matching
            </h4>
            <p className="text-xs text-white/50 leading-relaxed">
              We compare user primary emails with Deel's <code className="text-blue-300">contractor.email</code>. 
              Ensure your team uses the same email across both Fleet and Deel for automated pairing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
