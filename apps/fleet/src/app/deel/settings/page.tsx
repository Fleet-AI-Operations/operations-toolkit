'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  Save, 
  TestTube, 
  Shield, 
  Key, 
  Globe, 
  Info,
  ArrowLeft,
  Clock,
  Zap,
  RefreshCw
} from 'lucide-react';

interface DeelSettings {
  hasToken: boolean;
  tokenPreview: string | null;
  baseUrl: string;
  isProduction: boolean;
  autoSyncEnabled: boolean;
}

export default function DeelSettingsPage() {
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<DeelSettings | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [apiToken, setApiToken] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showToken, setShowToken] = useState(false);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/deel/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings(data);
      setBaseUrl(data.baseUrl);
      setAutoSyncEnabled(data.autoSyncEnabled);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveCredentials = async () => {
    setLoadingCredentials(true);
    setError(null);
    setSuccess(null);

    try {
      if (apiToken.trim() === '') {
        setError('Please enter an API token');
        setLoadingCredentials(false);
        return;
      }

      const response = await fetch('/api/deel/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken: apiToken.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to save API token');
      }

      setSuccess('API token saved successfully');
      setApiToken('');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingCredentials(false);
    }
  };

  const handleSave = async () => {
    setLoadingAll(true);
    setError(null);
    setSuccess(null);

    try {
      const updates: { apiToken?: string; baseUrl?: string; autoSyncEnabled?: boolean } = {};

      // Only include autoSyncEnabled if it differs from current settings
      if (autoSyncEnabled !== settings?.autoSyncEnabled) {
        updates.autoSyncEnabled = autoSyncEnabled;
      }

      if (apiToken.trim() !== '') {
        updates.apiToken = apiToken.trim();
      }

      if (baseUrl !== settings?.baseUrl) {
        updates.baseUrl = baseUrl.trim();
      }

      if (Object.keys(updates).length === 0) {
        setError('No changes to save');
        setLoadingAll(false);
        return;
      }

      const response = await fetch('/api/deel/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to save settings');
      }

      setSuccess('Settings saved successfully');
      setApiToken('');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingAll(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/deel/sync-contracts');
      if (response.ok) {
        setSuccess('Connection test successful');
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Connection test failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    loadSettings();
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold mb-3 premium-gradient">Deel API Settings</h1>
            <p className="text-white/60 text-lg">Manage your integration credentials and automation preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={loadingAll}
            className="btn-primary flex items-center justify-center gap-2 px-8 group shadow-xl shadow-blue-500/20"
          >
            <Save size={18} className="group-hover:scale-110 transition-transform" />
            {loadingAll ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar - Status & Info */}
        <div className="lg:col-span-4 space-y-6">
          {/* Current Status Card */}
          {settings && (
            <div className="glass-card border-blue-500/10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-6 flex items-center gap-2">
                <Shield size={16} />
                Connection Status
              </h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50 font-medium uppercase tracking-tighter">API Token</div>
                  <div className="flex items-center gap-2">
                    {settings.hasToken ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                        <CheckCircle2 size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
                        <XCircle size={12} />
                        Missing
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest px-1">Active Endpoint</div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 font-mono text-[11px] break-all text-white/70">
                    {settings.baseUrl}
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Environment</div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    settings.isProduction
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  }`}>
                    {settings.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="mt-8 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 text-xs font-bold text-white/70 uppercase tracking-widest group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={testing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                {testing ? 'Testing...' : 'Trigger Test Sync'}
              </button>
            </div>
          )}

          {/* Configuration Priority Note */}
          <div className="glass-card">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Info size={14} />
              Priority Chain
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Database Settings', desc: 'Managed via this page', icon: Shield, active: true },
                { label: 'Env Variables', desc: 'Server-side .env file', icon: Key },
                { label: 'Defaults', desc: 'Hardcoded fallbacks', icon: Globe },
              ].map((item, i) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className={`mt-1 h-1.5 w-1.5 rounded-full ${item.active ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'bg-white/20'}`} />
                  <div>
                    <div className={`text-[11px] font-bold ${item.active ? 'text-white' : 'text-white/40'}`}>{item.label}</div>
                    <div className="text-[10px] text-white/20">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Main Column - Grouped Settings */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Status Messages for Desktop (Top of form) */}
          {(success || error) && (
            <div className="animate-in fade-in slide-in-from-top-4">
              {success && (
                <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                  <CheckCircle2 className="text-emerald-400" size={18} />
                  <p className="text-emerald-400 text-sm font-medium">{success}</p>
                </div>
              )}
              {error && (
                <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <XCircle className="text-red-400" size={18} />
                  <p className="text-red-400 text-sm font-medium">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Section 1: API Credentials */}
          <div className="glass-card">
            <h2 className="text-lg font-bold mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Key size={18} className="text-blue-400" />
              </div>
              API Credentials
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 px-1">
                  Deel API Token
                </label>
                <div className="relative group">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder={settings?.hasToken ? "••••••••••••••••" : "Enter Deel API Token"}
                    className="input-field pr-24 font-mono text-sm h-12 border-white/10 group-focus-within:border-blue-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors text-white/30 hover:text-white"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="mt-3 flex items-start gap-2 px-1">
                  <Info size={12} className="text-white/20 mt-0.5" />
                  <p className="text-[11px] text-white/30 leading-relaxed">
                    Retrieve this from the <a href="https://app.letsdeel.com/developer-center" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Deel Developer Center</a>.
                    Tokens are stored securely in the database.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveCredentials}
                disabled={loadingCredentials || apiToken.trim() === ''}
                className="w-full btn-primary flex items-center justify-center gap-2 h-12 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-blue-500/20"
              >
                <Save size={18} className="group-hover:scale-110 transition-transform" />
                {loadingCredentials ? 'Saving...' : 'Save API Token'}
              </button>
            </div>
          </div>

          {/* Section 2: Automation Preferences */}
          <div className="glass-card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <h2 className="text-lg font-bold flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Zap size={18} className="text-yellow-400" />
                </div>
                Automation Engine
              </h2>
              
              {/* More Robust Toggle Implementation */}
              <label className="relative inline-flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={autoSyncEnabled}
                  onChange={() => setAutoSyncEnabled(!autoSyncEnabled)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-blue-600 border border-white/5"></div>
                <span className="ml-3 text-sm font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">
                  {autoSyncEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            <div className={`p-5 rounded-2xl transition-all duration-300 ${
              autoSyncEnabled 
                ? 'bg-blue-500/5 border border-blue-500/20 shadow-lg shadow-blue-500/5' 
                : 'bg-white/5 border border-white/5 opacity-60'
            }`}>
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  autoSyncEnabled ? 'bg-blue-400/20 text-blue-400' : 'bg-white/10 text-white/30'
                }`}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className={`text-sm font-bold mb-1 ${autoSyncEnabled ? 'text-white' : 'text-white/50'}`}>
                    10-Minute Recursive Sync
                  </h3>
                  <p className="text-xs text-white/30 leading-relaxed mb-4">
                    Automatically scans for <code className="text-blue-300">pending</code> time entries, 
                    correlates them with Deel contracts, and submits batches to the API.
                  </p>
                  
                  {autoSyncEnabled && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-500/10">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400/80">
                        <CheckCircle2 size={12} />
                        Contract Mapping Support
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400/80">
                        <CheckCircle2 size={12} />
                        Automated Submission
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Environment Configuration */}
          <div className="glass-card">
            <h2 className="text-lg font-bold mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Globe size={18} className="text-emerald-400" />
              </div>
              Network Environment
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 px-1">
                  Base API Endpoint
                </label>
                <div className="space-y-4">
                  {[
                    { id: 'local', value: 'http://localhost:4000', label: 'Development', desc: 'Mock API Server' },
                    { id: 'prod', value: 'https://api.letsdeel.com', label: 'Production', desc: 'Real Deel API' },
                  ].map((env) => (
                    <button
                      key={env.id}
                      onClick={() => setBaseUrl(env.value)}
                      className={`w-full p-5 rounded-xl border text-left transition-all flex items-center justify-between gap-4 ${
                        baseUrl === env.value
                          ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20'
                          : 'bg-white/10 border-white/20 hover:bg-white/15'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={`text-base font-bold mb-0.5 ${baseUrl === env.value ? 'text-white' : 'text-white/80'}`}>
                          {env.label}
                        </div>
                        <div className={`text-xs mb-2 ${baseUrl === env.value ? 'text-blue-300' : 'text-white/50'}`}>
                          {env.desc}
                        </div>
                        <div className={`font-mono text-xs ${baseUrl === env.value ? 'text-blue-400/80' : 'text-white/40'}`}>
                          {env.value}
                        </div>
                      </div>
                      {baseUrl === env.value && (
                        <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)]" />
                      )}
                    </button>
                  ))}
                  
                  <div className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    !['http://localhost:4000', 'https://api.letsdeel.com'].includes(baseUrl)
                      ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20' 
                      : 'bg-white/5 border-white/10 border-dashed hover:border-white/30'
                  }`}
                  onClick={() => !['http://localhost:4000', 'https://api.letsdeel.com'].includes(baseUrl) ? null : setBaseUrl('')}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${!['http://localhost:4000', 'https://api.letsdeel.com'].includes(baseUrl) ? 'text-blue-400' : 'text-white'}`}>
                        Custom Manual Endpoint
                      </span>
                      {!['http://localhost:4000', 'https://api.letsdeel.com'].includes(baseUrl) && (
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)]" />
                      )}
                    </div>
                    {['http://localhost:4000', 'https://api.letsdeel.com'].includes(baseUrl) ? (
                      <div className="text-[11px] text-white/40 italic">Click to enter manual endpoint</div>
                    ) : (
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="https://api.custom.com"
                        className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] font-mono w-full focus:ring-1 focus:ring-blue-500 outline-none text-white placeholder:text-white/20"
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Security Details */}
          <div className="glass-card bg-white/5 border-none">
            <h2 className="text-sm font-bold text-white/40 mb-6 flex items-center gap-2">
              <Shield size={16} />
              Platform Requirements
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                  <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 px-1">Critical Scopes</div>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-xs text-white/60">
                      <div className="w-1 h-1 rounded-full bg-orange-400" />
                      <code className="bg-orange-400/10 px-1 py-0.5 rounded text-[10px]">contracts:read</code>
                    </li>
                    <li className="flex items-center gap-2 text-xs text-white/60">
                      <div className="w-1 h-1 rounded-full bg-orange-400" />
                      <code className="bg-orange-400/10 px-1 py-0.5 rounded text-[10px]">timesheets:write</code>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] text-white/30 leading-relaxed">
                  We verify your token periodically by performing a dry-run fetch of the active contract count. 
                  Partial token previews are shown only to users with <code className="text-blue-300">ADMIN</code> or <code className="text-blue-300">FLEET</code> privileges.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
