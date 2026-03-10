'use client';

import { useState, useEffect } from 'react';
import { KeyRound, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';

interface ApiToken {
    id: string;
    name: string;
    tokenPrefix: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
}

interface CreatedToken extends Omit<ApiToken, 'lastUsedAt' | 'revokedAt'> {
    token: string;
}

function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function TokenStatus({ token }: { token: ApiToken }) {
    if (token.revokedAt) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Revoked</span>;
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Expired</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>;
}

export default function ApiTokensClient() {
    const [tokens, setTokens] = useState<ApiToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
    const [copied, setCopied] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { fetchTokens(); }, []);

    const fetchTokens = async () => {
        try {
            const res = await fetch('/api/admin/api-tokens');
            if (!res.ok) throw new Error('Failed to load tokens');
            setTokens(await res.json());
        } catch {
            setError('Failed to load tokens');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/api-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, expiresAt: expiresAt || undefined }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create token');
            }
            const data: CreatedToken = await res.json();
            setCreatedToken(data);
            setName('');
            setExpiresAt('');
            setShowForm(false);
            await fetchTokens();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create token');
        } finally {
            setIsCreating(false);
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('Revoke this token? This cannot be undone.')) return;
        setRevokingId(id);
        try {
            const res = await fetch(`/api/admin/api-tokens/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to revoke token');
            await fetchTokens();
        } catch {
            setError('Failed to revoke token');
        } finally {
            setRevokingId(null);
        }
    };

    const handleCopy = async () => {
        if (!createdToken) return;
        await navigator.clipboard.writeText(createdToken.token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-6 max-w-4xl">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-gray-600" />
                    <h1 className="text-xl font-semibold">API Tokens</h1>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-primary flex items-center gap-2"
                        style={{ padding: '8px 20px', fontSize: '0.875rem' }}
                    >
                        <Plus className="w-4 h-4" />
                        New Token
                    </button>
                )}
            </div>

            <p className="text-sm text-gray-500 mb-6">
                Bearer tokens for programmatic API access. Tokens inherit your role permissions.
                Use them in API requests with the header: <code className="bg-gray-100 px-1 rounded">Authorization: Bearer otk_...</code>
            </p>

            {error && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* New token revealed */}
            {createdToken && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-medium text-green-800 mb-1">Token created — copy it now, it won&apos;t be shown again.</p>
                    <div className="flex items-center gap-2 mt-2">
                        <code className="flex-1 text-sm bg-white border border-green-200 rounded px-3 py-2 font-mono break-all">
                            {createdToken.token}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <button onClick={() => setCreatedToken(null)} className="mt-3 text-xs text-green-700 underline">Dismiss</button>
                </div>
            )}

            {/* Create form */}
            {showForm && (
                <form onSubmit={handleCreate} className="mb-6 p-4 border rounded bg-gray-50">
                    <h2 className="text-sm font-medium mb-3">Create New Token</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Ingest Script"
                                required
                                className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Expires (optional)</label>
                            <input
                                type="date"
                                value={expiresAt}
                                onChange={e => setExpiresAt(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="btn-primary disabled:opacity-50"
                            style={{ padding: '8px 20px', fontSize: '0.875rem' }}
                        >
                            {isCreating ? 'Creating…' : 'Create Token'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowForm(false); setName(''); setExpiresAt(''); }}
                            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* Token list */}
            {loading ? (
                <p className="text-sm text-gray-500">Loading…</p>
            ) : tokens.length === 0 ? (
                <p className="text-sm text-gray-500">No tokens yet. Create one to get started.</p>
            ) : (
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 border-b">
                            <th className="pb-2 pr-4 font-medium">Name</th>
                            <th className="pb-2 pr-4 font-medium">Prefix</th>
                            <th className="pb-2 pr-4 font-medium">Status</th>
                            <th className="pb-2 pr-4 font-medium">Last used</th>
                            <th className="pb-2 pr-4 font-medium">Expires</th>
                            <th className="pb-2 font-medium">Created</th>
                            <th className="pb-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {tokens.map(token => (
                            <tr key={token.id} className="border-b last:border-0">
                                <td className="py-2 pr-4 font-medium">{token.name}</td>
                                <td className="py-2 pr-4 font-mono text-xs text-gray-500">otk_{token.tokenPrefix}…</td>
                                <td className="py-2 pr-4"><TokenStatus token={token} /></td>
                                <td className="py-2 pr-4 text-gray-500">{formatDate(token.lastUsedAt)}</td>
                                <td className="py-2 pr-4 text-gray-500">{formatDate(token.expiresAt)}</td>
                                <td className="py-2 pr-4 text-gray-500">{formatDate(token.createdAt)}</td>
                                <td className="py-2 text-right">
                                    {!token.revokedAt && (
                                        <button
                                            onClick={() => handleRevoke(token.id)}
                                            disabled={revokingId === token.id}
                                            className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-40"
                                            title="Revoke token"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
