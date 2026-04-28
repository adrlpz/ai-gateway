import { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, ToggleLeft, ToggleRight, Eye, EyeOff, Check } from 'lucide-react';
import { api, type GatewayKey } from '../lib/api';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function parseTokenLimitInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new Error('Token limit must be a non-negative integer.');
  }
  return parsed;
}

function quotaLabel(key: GatewayKey): string {
  if (key.token_limit === null) return 'Unlimited';
  return `${fmt(key.tokens_count)} / ${fmt(key.token_limit)} tokens`;
}

function limitReached(key: GatewayKey): boolean {
  return key.token_limit !== null && key.tokens_count >= key.token_limit;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<GatewayKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [savingLimitId, setSavingLimitId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => api.keys.list().then(setKeys).catch(console.error);
  useEffect(() => { load(); }, []);

  function draftValue(key: GatewayKey): string {
    return limitDrafts[key.id] ?? (key.token_limit?.toString() ?? '');
  }

  async function create() {
    setCreating(true);
    try {
      const token_limit = parseTokenLimitInput(newLimit);
      const result = await api.keys.create({
        name: newName || undefined,
        token_limit,
      });
      setNewKey(result.key);
      setNewName('');
      setNewLimit('');
      setShowNewKey(true);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this API key?')) return;
    await api.keys.delete(id);
    load();
  }

  async function toggle(k: GatewayKey) {
    await api.keys.toggle(k.id, !k.enabled);
    load();
  }

  async function saveLimit(key: GatewayKey) {
    setSavingLimitId(key.id);
    try {
      const token_limit = parseTokenLimitInput(draftValue(key));
      await api.keys.update(key.id, { token_limit });
      setLimitDrafts(prev => {
        const next = { ...prev };
        delete next[key.id];
        return next;
      });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingLimitId('');
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  const activeKeys = keys.filter(k => k.enabled).length;
  const limitedKeys = keys.filter(k => k.token_limit !== null).length;
  const reachedKeys = keys.filter(limitReached).length;
  const totalRequests = keys.reduce((sum, k) => sum + k.requests_count, 0);
  const totalTokens = keys.reduce((sum, k) => sum + k.tokens_count, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(16rem,1fr)] gap-6 max-w-7xl">
      <div className="space-y-6">
        <div className="card space-y-3">
          <h3 className="text-sm font-medium">Create New Gateway Key</h3>
          <p className="text-xs text-muted">
            Gateway keys protect your proxy endpoints. Leave token limit blank for unlimited usage, or set a lifetime quota such as 2000000.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_14rem_auto] gap-2">
            <input
              className="input"
              placeholder="Key name (optional)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !creating && create()}
            />
            <input
              className="input font-mono"
              placeholder="Token limit (optional)"
              value={newLimit}
              onChange={e => setNewLimit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !creating && create()}
            />
            <button className="btn-primary flex items-center justify-center gap-1.5" onClick={create} disabled={creating}>
              <Plus size={14} /> {creating ? 'Generating...' : 'Generate Key'}
            </button>
          </div>
        </div>

        {newKey && (
          <div className="card border-success/30 bg-success/5 space-y-2">
            <p className="text-sm text-success font-medium">Key created — copy it now, it won't be shown again!</p>
            <div className="flex items-center gap-2">
              <code className={`flex-1 text-xs font-mono bg-base-900 rounded px-3 py-2 ${showNewKey ? 'text-gray-100' : 'blur-sm select-none'}`}>
                {newKey}
              </code>
              <button className="btn-ghost p-1.5" onClick={() => setShowNewKey(!showNewKey)}>
                {showNewKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button className="btn-primary p-1.5" onClick={() => copy(newKey)} title="Copy">
                <Copy size={16} />
              </button>
            </div>
            <button className="text-xs text-muted hover:text-gray-300" onClick={() => setNewKey(null)}>Dismiss</button>
          </div>
        )}

        <div className="space-y-2">
          {keys.length === 0 && (
            <div className="card text-center text-muted text-sm py-8">
              No keys yet. Gateway is in <strong className="text-warning">open mode</strong> — anyone can use it.
            </div>
          )}
          {keys.map(key => (
            <div
              key={key.id}
              className={`card flex items-start gap-3 ${!key.enabled ? 'opacity-50' : ''} ${limitReached(key) ? 'border border-danger/30 bg-danger/5' : ''}`}
            >
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-100">{key.name ?? 'Unnamed Key'}</span>
                    {key.enabled ? <span className="badge-green">Active</span> : <span className="badge-gray">Disabled</span>}
                    {key.token_limit === null ? <span className="badge-blue">Unlimited</span> : <span className="badge-yellow">Limited</span>}
                    {limitReached(key) && <span className="badge-red">Limit reached</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
                    <code className="font-mono text-gray-400">{key.key_preview}</code>
                    <span>{key.requests_count.toLocaleString()} requests</span>
                    <span>{quotaLabel(key)}</span>
                    {key.last_used_at && <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[14rem_auto] gap-2">
                  <input
                    className="input font-mono"
                    placeholder="Unlimited"
                    value={draftValue(key)}
                    onChange={e => setLimitDrafts(prev => ({ ...prev, [key.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && savingLimitId !== key.id && saveLimit(key)}
                  />
                  <button
                    className="btn-ghost flex items-center justify-center gap-1.5"
                    onClick={() => saveLimit(key)}
                    disabled={savingLimitId === key.id}
                  >
                    <Check size={14} /> {savingLimitId === key.id ? 'Saving...' : 'Save Limit'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button className="btn-ghost p-1.5" onClick={() => copy(key.key_preview)} title="Copy preview">
                  <Copy size={14} />
                </button>
                <button className="btn-ghost p-1.5" onClick={() => toggle(key)}>
                  {key.enabled ? <ToggleRight size={18} className="text-success" /> : <ToggleLeft size={18} />}
                </button>
                <button className="btn-danger p-1.5" onClick={() => remove(key.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card bg-base-700 space-y-2">
          <h4 className="text-xs font-medium text-gray-300">Using Your Key</h4>
          <div className="space-y-1 text-xs font-mono">
            <p className="text-muted"># OpenAI SDK</p>
            <p className="text-gray-300">openai.api_key = <span className="text-accent">"sk-gw-xxxx"</span></p>
            <p className="text-muted mt-2"># Anthropic SDK</p>
            <p className="text-gray-300">anthropic.api_key = <span className="text-accent">"sk-gw-xxxx"</span></p>
            <p className="text-muted mt-2"># HTTP header</p>
            <p className="text-gray-300">Authorization: Bearer <span className="text-accent">sk-gw-xxxx</span></p>
            <p className="text-gray-300">   — or —</p>
            <p className="text-gray-300">x-api-key: <span className="text-accent">sk-gw-xxxx</span></p>
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="card space-y-3">
          <h3 className="text-sm font-medium">Key Summary</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-base-700 rounded p-3">
              <p className="text-muted">Active</p>
              <p className="text-lg text-success mt-1">{activeKeys}</p>
            </div>
            <div className="bg-base-700 rounded p-3">
              <p className="text-muted">Total</p>
              <p className="text-lg text-gray-100 mt-1">{keys.length}</p>
            </div>
            <div className="bg-base-700 rounded p-3">
              <p className="text-muted">Limited</p>
              <p className="text-lg text-warning mt-1">{limitedKeys}</p>
            </div>
            <div className="bg-base-700 rounded p-3">
              <p className="text-muted">Reached</p>
              <p className="text-lg text-danger mt-1">{reachedKeys}</p>
            </div>
            <div className="bg-base-700 rounded p-3 col-span-2">
              <p className="text-muted">Usage</p>
              <p className="text-sm text-gray-100 mt-1">{totalRequests.toLocaleString()} requests</p>
              <p className="text-sm text-gray-100">{fmt(totalTokens)} tokens</p>
            </div>
          </div>
        </div>
        <div className="card space-y-2">
          <h3 className="text-sm font-medium">Quota Rules</h3>
          <p className="text-xs text-muted">Blank limit means unlimited lifetime usage.</p>
          <p className="text-xs text-muted">Requests are blocked only after recorded usage reaches the quota, so the final successful request can go slightly over the limit.</p>
        </div>
      </aside>
    </div>
  );
}
