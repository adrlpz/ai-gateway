import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { api, type KeyUsageLog, type KeyUsageLogsResponse, type KeyUsageOverview, type KeyUsageSummary } from '../lib/api';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relTime(ts: number | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function statusBadge(log: KeyUsageLog) {
  const status = log.status;
  if (!status) return <span className="badge-gray">—</span>;
  if (status < 300) return <span className="badge-green">{status}</span>;
  if (status < 400) return <span className="badge-yellow">{status}</span>;
  return <span className="badge-red">{status}</span>;
}

export default function UsagePage() {
  const [overview, setOverview] = useState<KeyUsageOverview | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [logs, setLogs] = useState<KeyUsageLogsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState('');

  async function loadOverview() {
    setLoadingOverview(true);
    setError('');
    try {
      const result = await api.usage.keys();
      setOverview(result);
      setSelectedKeyId(prev => {
        if (prev && result.keys.some(key => key.id === prev)) return prev;
        return result.keys[0]?.id ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingOverview(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (!selectedKeyId) {
      setLogs(null);
      return;
    }
    setLoadingLogs(true);
    api.usage.keyLogs(selectedKeyId, { page, limit: 50, status: statusFilter || undefined })
      .then(setLogs)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingLogs(false));
  }, [page, selectedKeyId, statusFilter]);

  const selectedKey = useMemo(
    () => overview?.keys.find(key => key.id === selectedKeyId) ?? null,
    [overview, selectedKeyId],
  );

  const summary = overview?.summary;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)] gap-6 max-w-7xl">
      <div className="space-y-6">
        {error && (
          <div className="card text-danger flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-300">API key usage overview</h2>
          <button className="btn-ghost flex items-center gap-1.5" onClick={() => void loadOverview()} disabled={loadingOverview}>
            <RefreshCw size={14} className={loadingOverview ? 'animate-spin' : ''} />
            {loadingOverview ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-muted">Active Keys</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{summary?.active_keys ?? 0}</p>
          </div>
          <div className="card">
            <p className="text-xs text-muted">Lifetime Tokens</p>
            <p className="text-2xl font-bold text-warning mt-1">{fmt(summary?.total_lifetime_tokens ?? 0)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-muted">24h Tokens</p>
            <p className="text-2xl font-bold text-accent mt-1">{fmt(summary?.total_tokens_24h ?? 0)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-muted">Limit Reached</p>
            <p className="text-2xl font-bold text-danger mt-1">{summary?.limit_reached_keys ?? 0}</p>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-base-600 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Per-Key Usage</h3>
              <p className="text-xs text-muted mt-0.5">Lifetime totals and 24h snapshot for every API key</p>
            </div>
            <span className="text-xs text-muted">{overview?.keys.length ?? 0} key(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-base-600 text-muted">
                  <th className="text-left px-4 py-2.5 font-medium">Key</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Lifetime</th>
                  <th className="text-left px-4 py-2.5 font-medium">24h</th>
                  <th className="text-left px-4 py-2.5 font-medium">Limit</th>
                  <th className="text-left px-4 py-2.5 font-medium">Last Used</th>
                </tr>
              </thead>
              <tbody>
                {!overview && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading usage...</td></tr>
                )}
                {overview?.keys.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No API keys yet.</td></tr>
                )}
                {overview?.keys.map((key: KeyUsageSummary) => (
                  <tr
                    key={key.id}
                    className={`border-b border-base-700 cursor-pointer transition-colors hover:bg-base-700 ${selectedKeyId === key.id ? 'bg-accent/10' : ''}`}
                    onClick={() => {
                      setSelectedKeyId(key.id);
                      setPage(1);
                      setExpandedLogId('');
                    }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-gray-100 font-medium truncate">{key.name ?? 'Unnamed Key'}</p>
                        <code className="text-[11px] text-muted">{key.key_preview}</code>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {key.enabled ? <span className="badge-green">Active</span> : <span className="badge-gray">Disabled</span>}
                        {key.limit_reached && <span className="badge-red">Limit reached</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      <div>{fmt(key.tokens_count)} tok</div>
                      <div>{key.requests_count.toLocaleString()} req</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      <div>{fmt(key.tokens_24h)} tok</div>
                      <div>{key.requests_24h.toLocaleString()} req</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {key.token_limit === null ? 'Unlimited' : `${fmt(key.token_limit)} tok`}
                    </td>
                    <td className="px-4 py-2.5 text-muted whitespace-nowrap">{relTime(key.last_used_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Audit View</h3>
              <p className="text-xs text-muted mt-0.5">
                {selectedKey ? `${selectedKey.name ?? 'Unnamed Key'} · ${selectedKey.key_preview}` : 'Select a key to inspect its requests'}
              </p>
            </div>
            <select
              className="input w-28"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              disabled={!selectedKeyId}
            >
              <option value="">All</option>
              <option value="ok">Success</option>
              <option value="error">Error</option>
            </select>
          </div>

          {selectedKey && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-base-700 rounded p-3">
                <p className="text-muted">Lifetime</p>
                <p className="text-sm text-gray-100 mt-1">{fmt(selectedKey.tokens_count)} tok</p>
                <p className="text-sm text-gray-100">{selectedKey.requests_count.toLocaleString()} req</p>
              </div>
              <div className="bg-base-700 rounded p-3">
                <p className="text-muted">Last 24h</p>
                <p className="text-sm text-gray-100 mt-1">{fmt(selectedKey.tokens_24h)} tok</p>
                <p className="text-sm text-gray-100">{selectedKey.requests_24h.toLocaleString()} req</p>
              </div>
            </div>
          )}

          {!selectedKeyId && (
            <p className="text-xs text-muted">No key available. Create an API key first to see usage analytics.</p>
          )}

          {selectedKeyId && !logs && loadingLogs && (
            <p className="text-xs text-muted">Loading request audit...</p>
          )}

          {selectedKeyId && logs?.logs.length === 0 && !loadingLogs && (
            <p className="text-xs text-muted">No request logs found for this key.</p>
          )}

          <div className="space-y-2">
            {logs?.logs.map(log => (
              <div key={log.id} className="bg-base-700 rounded px-3 py-2">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedLogId(prev => prev === log.id ? '' : log.id)}
                >
                  <div className="flex items-center gap-2">
                    {statusBadge(log)}
                    <span className="text-xs font-mono text-gray-200 truncate flex-1">{log.model ?? '—'}</span>
                    <span className="text-[11px] text-muted whitespace-nowrap">{relTime(log.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted">
                    <span>{log.total_tokens?.toLocaleString() ?? 0} tok</span>
                    <span>{log.latency ? `${log.latency}ms` : '—'}</span>
                    <span>{log.provider_id ?? '—'}</span>
                  </div>
                </button>
                {expandedLogId === log.id && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-[11px] text-muted mb-1">Request</p>
                      <pre className="bg-base-900 rounded p-2 text-[11px] overflow-auto max-h-40 whitespace-pre-wrap text-gray-300">
                        {log.request_preview ?? '(empty)'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted mb-1">Response</p>
                      <pre className="bg-base-900 rounded p-2 text-[11px] overflow-auto max-h-40 whitespace-pre-wrap text-gray-300">
                        {log.response_preview ?? log.error ?? '(empty)'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {logs && logs.pages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted pt-1">
              <span>{logs.total} total logs</span>
              <div className="flex items-center gap-2">
                <button className="btn-ghost p-1" disabled={page <= 1} onClick={() => setPage(prev => prev - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <span>Page {page} / {logs.pages}</span>
                <button className="btn-ghost p-1" disabled={page >= logs.pages} onClick={() => setPage(prev => prev + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-medium">Notes</h3>
          <p className="text-xs text-muted">Lifetime totals come from the gateway key counters.</p>
          <p className="text-xs text-muted">The 24h snapshot is calculated from request logs only for requests that used an API key.</p>
        </div>
      </aside>
    </div>
  );
}
