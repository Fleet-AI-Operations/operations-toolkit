'use client';

import Link from 'next/link';
import { 
  Settings, 
  RefreshCw, 
  Send, 
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ShieldCheck
} from 'lucide-react';

export default function DeelIndexPage() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 premium-gradient">Deel Integration</h1>
        <p className="text-white/60 text-lg max-w-2xl">
          Manage time entry synchronization with Deel API. Automatically correlate users 
          to contracts and submit time entries as professional timesheets.
        </p>
      </div>

      {/* Quick Links Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <Link href="/deel/settings" className="block group">
          <div className="glass-card h-full flex flex-col hover:border-blue-500/50 transition-all duration-300 group-hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
              <Settings className="text-blue-400" size={24} />
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">Settings</h2>
            <p className="text-sm text-white/50 mb-4 flex-grow">
              Configure Deel API credentials and environment settings.
            </p>
            <div className="flex items-center text-blue-400 text-sm font-medium">
              Configure <ArrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        <Link href="/deel/sync-contracts" className="block group">
          <div className="glass-card h-full flex flex-col hover:border-emerald-500/50 transition-all duration-300 group-hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
              <RefreshCw className="text-emerald-400" size={24} />
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-emerald-400 transition-colors">Sync Contracts</h2>
            <p className="text-sm text-white/50 mb-4 flex-grow">
              Match project users to Deel contracts by email address.
            </p>
            <div className="flex items-center text-emerald-400 text-sm font-medium">
              Sync Data <ArrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        <Link href="/deel/submit-timesheets" className="block group">
          <div className="glass-card h-full flex flex-col hover:border-purple-500/50 transition-all duration-300 group-hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
              <Send className="text-purple-400" size={24} />
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">Submit</h2>
            <p className="text-sm text-white/50 mb-4 flex-grow">
              Batch submit approved time entries as Deel timesheets.
            </p>
            <div className="flex items-center text-purple-400 text-sm font-medium">
              Launch <ArrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Workflow Guide */}
        <div className="glass-card">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Clock size={20} className="text-blue-400" />
            Integration Workflow
          </h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">1</div>
              <div>
                <h3 className="font-semibold text-white/90">Configure API Settings</h3>
                <p className="text-sm text-white/50">Ensure your Deel API token is active and scoped correctly status.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">2</div>
              <div>
                <h3 className="font-semibold text-white/90">Run Contract Sync</h3>
                <p className="text-sm text-white/50">Automatically link time entries to active Deel contracts via emails.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">3</div>
              <div>
                <h3 className="font-semibold text-white/90">Submit Timesheets</h3>
                <p className="text-sm text-white/50">Submit and track the status of your timesheets in Deel.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="space-y-6">
          <div className="glass-card bg-emerald-500/5 border-emerald-500/20">
            <h3 className="font-bold mb-3 flex items-center gap-2 text-emerald-400">
              <ShieldCheck size={18} />
              Status Tracking
            </h3>
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Every entry follows a secure lifecycle to prevent duplicate submissions and ensure data integrity.
            </p>
            <div className="flex flex-wrap gap-2">
              <code className="bg-white/5 px-2 py-1 rounded text-xs text-white/70">pending</code>
              <code className="bg-white/5 px-2 py-1 rounded text-xs text-white/70">processing</code>
              <code className="bg-white/5 px-2 py-1 rounded text-xs text-white/70">sent</code>
              <code className="bg-white/5 px-2 py-1 rounded text-xs text-white/70">failed</code>
            </div>
          </div>

          <div className="glass-card bg-blue-500/5 border-blue-500/20">
            <h3 className="font-bold mb-3 flex items-center gap-2 text-blue-400">
              <BookOpen size={18} />
              Automation Note
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Matching is performed by comparing <code className="text-blue-300">user.email</code> 
              with Deel contractor data. Ensure emails match exactly across both systems.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
