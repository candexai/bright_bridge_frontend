import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import {
  Loader2,
  AlertCircle,
  Search,
  X,
  CheckCircle,
  RotateCcw,
  Trash2,
  ChevronDown,
} from 'lucide-react';

type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

interface AlertRow {
  _id: string;
  type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  schoolId?: string | null;
  schoolName?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
  occurrenceCount: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  resolvedAt?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
}

interface AlertsResponse {
  alerts: AlertRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const SEVERITY_OPTIONS: AlertSeverity[] = ['INFO', 'WARNING', 'CRITICAL'];
const STATUS_OPTIONS: AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];

const severityClass = (s: AlertSeverity) => {
  if (s === 'CRITICAL') return 'bg-red-50 text-red-700 border-red-200';
  if (s === 'WARNING') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const statusClass = (s: AlertStatus) => {
  if (s === 'RESOLVED') return 'bg-green-50 text-green-700';
  if (s === 'ACKNOWLEDGED') return 'bg-blue-50 text-blue-700';
  return 'bg-orange-50 text-orange-700';
};

const formatDateTime = (d: string) => new Date(d).toLocaleString();

export const AdminNotifications = () => {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const [severity, setSeverity] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<AlertRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  const bulkDeleteLabels: Record<string, string> = {
    resolved: 'Delete all resolved notifications',
    acknowledged: 'Delete all acknowledged notifications',
    all: 'Delete all notifications',
  };

  const handleBulkDelete = async (scope: 'all' | 'resolved' | 'acknowledged') => {
    const label = bulkDeleteLabels[scope];
    if (!confirm(`${label}? This cannot be undone.`)) return;

    setBulkMenuOpen(false);
    setProcessing(`bulk-${scope}`);
    setError('');
    try {
      const res = await api.delete('/admin/alerts/bulk', { data: { scope } });
      setSuccess(`Deleted ${res.data.deletedCount} notification(s)`);
      setTimeout(() => setSuccess(''), 3000);
      setSelected(null);
      setPage(1);
      await fetchAlerts();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to delete notifications');
    } finally {
      setProcessing(null);
    }
  };

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit: 25 };
      if (severity) params.severity = severity;
      if (type) params.type = type;
      if (status) params.status = status;
      if (schoolId.trim()) params.schoolId = schoolId.trim();
      if (search.trim()) params.search = search.trim();

      const res = await api.get<AlertsResponse>('/admin/alerts', { params });
      setAlerts(res.data.alerts);
      setPagination({ total: res.data.pagination.total, pages: res.data.pagination.pages });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [page, severity, type, status, schoolId, search]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const openDetail = async (row: AlertRow) => {
    setSelected(row);
    setDetailLoading(true);
    try {
      const res = await api.get<AlertRow>(`/admin/alerts/${row._id}`);
      setSelected(res.data);
    } catch {
      setSelected(row);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: AlertStatus) => {
    setProcessing(id);
    setError('');
    try {
      await api.patch(`/admin/alerts/${id}/status`, { status: newStatus });
      setSuccess(`Alert marked as ${newStatus.toLowerCase()}`);
      setTimeout(() => setSuccess(''), 2500);
      if (selected?._id === id) {
        const res = await api.get<AlertRow>(`/admin/alerts/${id}`);
        setSelected(res.data);
      }
      await fetchAlerts();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to update status');
    } finally {
      setProcessing(null);
    }
  };

  const applyFilters = () => {
    setPage(1);
    fetchAlerts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            System alerts and integration failures across all schools
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={!!processing?.startsWith('bulk-')}
            onClick={() => setBulkMenuOpen((o) => !o)}
            className="ui-button-secondary text-sm flex items-center gap-2 py-2 px-3"
          >
            {processing?.startsWith('bulk-') ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete
            <ChevronDown className="w-4 h-4" />
          </button>
          {bulkMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                aria-label="Close menu"
                onClick={() => setBulkMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                <button
                  type="button"
                  onClick={() => handleBulkDelete('resolved')}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Delete resolved
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkDelete('acknowledged')}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Delete acknowledged
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  type="button"
                  onClick={() => handleBulkDelete('all')}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete all
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="ui-input text-sm py-1.5"
          >
            <option value="">All</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ui-input text-sm py-1.5"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
          <input
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. OUTLOOK_ERROR"
            className="ui-input text-sm py-1.5 w-44"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">School ID</label>
          <input
            type="text"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            placeholder="MongoDB school id"
            className="ui-input text-sm py-1.5 w-48"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="Title, message, school…"
              className="ui-input text-sm py-1.5 pl-9 w-full"
            />
          </div>
        </div>
        <button type="button" onClick={applyFilters} className="ui-button-primary text-sm py-1.5 px-4">
          Apply
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Severity</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">School</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Count</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Last</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No alerts match your filters.
                  </td>
                </tr>
              ) : (
                alerts.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => openDetail(row)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${severityClass(row.severity)}`}>
                        {row.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{row.type}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.schoolName || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-900 max-w-xs truncate">{row.title}</td>
                    <td className="px-4 py-3 text-slate-600">{row.occurrenceCount}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDateTime(row.lastOccurredAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <span className="text-sm text-slate-500">
                Page {page} of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="ui-button-secondary text-sm py-1 px-3 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="ui-button-secondary text-sm py-1 px-3 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-lg bg-white shadow-xl h-full overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Alert details</h2>
              <button type="button" onClick={() => setSelected(null)} className="p-1 text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="p-4 space-y-4 flex-1">
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${severityClass(selected.severity)}`}>
                    {selected.severity}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(selected.status)}`}>
                    {selected.status}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{selected.type}</span>
                </div>

                <h3 className="font-medium text-slate-900">{selected.title}</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{selected.message}</p>

                <dl className="text-sm space-y-2">
                  <div>
                    <dt className="text-slate-500">Source</dt>
                    <dd className="font-mono text-xs text-slate-800">{selected.source}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Occurrences</dt>
                    <dd>{selected.occurrenceCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">First seen</dt>
                    <dd>{formatDateTime(selected.firstOccurredAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Last seen</dt>
                    <dd>{formatDateTime(selected.lastOccurredAt)}</dd>
                  </div>
                  {(selected.schoolId || selected.schoolName) && (
                    <div>
                      <dt className="text-slate-500">School</dt>
                      <dd>
                        {selected.schoolName || '—'}
                        {selected.schoolId && (
                          <>
                            {' '}
                            <Link
                              to={`/admin/schools`}
                              className="text-blue-600 hover:underline text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              ({String(selected.schoolId)})
                            </Link>
                          </>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>

                {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-1">Metadata</h4>
                    <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-40">
                      {JSON.stringify(selected.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {selected.metadata && (selected.metadata.stack as string) && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-1">Stack trace</h4>
                    <pre className="text-xs bg-red-50 border border-red-100 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
                      {String(selected.metadata.stack)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border-t border-slate-200 flex flex-wrap gap-2">
              {selected.status !== 'ACKNOWLEDGED' && selected.status !== 'RESOLVED' && (
                <button
                  type="button"
                  disabled={processing === selected._id}
                  onClick={() => updateStatus(selected._id, 'ACKNOWLEDGED')}
                  className="ui-button-secondary text-sm flex items-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Acknowledge
                </button>
              )}
              {selected.status !== 'RESOLVED' && (
                <button
                  type="button"
                  disabled={processing === selected._id}
                  onClick={() => updateStatus(selected._id, 'RESOLVED')}
                  className="ui-button-primary text-sm flex items-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Resolve
                </button>
              )}
              {selected.status === 'RESOLVED' && (
                <button
                  type="button"
                  disabled={processing === selected._id}
                  onClick={() => updateStatus(selected._id, 'ACTIVE')}
                  className="ui-button-secondary text-sm flex items-center gap-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reopen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;
