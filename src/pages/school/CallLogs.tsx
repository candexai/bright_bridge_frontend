import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Phone, Loader2, MessageSquare, Clock,
    Calendar, ChevronDown, User, Bot
} from 'lucide-react';
import axios from 'axios';
import api from '../../api/axios';
import { SeekableAudioPlayer } from '../../components/SeekableAudioPlayer';
import {
  type ParentSegment,
  getSegmentLabel,
  getSegmentBadgeClassName,
  getSegmentFilterButtonClassName,
  getSegmentTagClassName,
  getTourBookedBadgeClassName,
  getTourEmailMissingBadgeClassName,
  TOUR_EMAIL_MISSING_LABEL,
} from '../../utils/parentSegment';

type SegmentFilter = ParentSegment | 'all';
const SEGMENT_FILTERS: ParentSegment[] = ['new_parent', 'current_family', 'unknown'];

interface TranscriptItem {
    role: string;
    text: string;
    timestamp?: string;
}

interface CallLogData {
    id: string;
    sessionId: string;
    participantId: string;
    callerName?: string | null;
    transcript: TranscriptItem[];
    summary: string;
    recordingUrl: string;
    duration: number;
    createdAt: string;
    parentSegment?: ParentSegment;
    tags?: string[];
    callOrdinal?: number;
    callCountTotal?: number;
    callOrdinalLabel?: string;
}

type CallLogsPeriod = '7d' | '30d' | '60d' | '90d' | 'all' | 'custom';

const PERIOD_OPTIONS: Array<{ value: CallLogsPeriod; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '60d', label: 'Last 60 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

function buildPeriodQuery(period: CallLogsPeriod, start: string, end: string) {
  const params: Record<string, string> = { period };
  if (period === 'custom' && start && end) {
    params.startDate = start;
    params.endDate = end;
  }
  return params;
}

function isUsableDisplayName(name?: string | null) {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return lower !== 'parent' && lower !== 'unknown' && lower !== 'unknown caller';
}

function getDisplayTags(log: CallLogData): Array<{ label: string; className: string }> {
  const badges: Array<{ label: string; className: string }> = [];
  const segment = log.parentSegment || 'unknown';
  badges.push({
    label: getSegmentLabel(segment),
    className: getSegmentBadgeClassName(segment),
  });

  const seen = new Set([getSegmentLabel(segment).toLowerCase()]);
  for (const tag of log.tags || []) {
    const label = String(tag || '').trim();
    if (!label) continue;
    const lower = label.toLowerCase();
    if (seen.has(lower)) continue;
    if (lower === 'new parent' || lower === 'current family' || lower === 'unknown') continue;
    seen.add(lower);

    if (lower === 'past call name used') {
      badges.push({ label, className: 'bg-amber-50 text-amber-900 border-amber-200' });
      continue;
    }
    if (lower.includes('email missing')) {
      badges.push({ label: label || TOUR_EMAIL_MISSING_LABEL, className: getTourEmailMissingBadgeClassName() });
      continue;
    }
    if (lower.includes('tour booked')) {
      badges.push({ label, className: getTourBookedBadgeClassName() });
      continue;
    }

    const segmentClass = getSegmentTagClassName(label);
    badges.push({
      label,
      className: segmentClass || 'bg-slate-50 text-slate-600 border-slate-200',
    });
  }

  return badges.slice(0, 5);
}

function phoneKey(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits.length >= 7 ? digits : '';
}

export const SchoolCallLogs = () => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<CallLogData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [period, setPeriod] = useState<CallLogsPeriod>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');
    const [phoneFilter, setPhoneFilter] = useState<string | null>(null);

    const rangeReady =
      period !== 'custom'
      || (Boolean(customStartDate) && Boolean(customEndDate) && customStartDate <= customEndDate);

    const query = useMemo(
      () => buildPeriodQuery(period, customStartDate, customEndDate),
      [period, customStartDate, customEndDate]
    );

    const periodLabel = PERIOD_OPTIONS.find((opt) => opt.value === period)?.label || 'selected range';

    const segmentCounts = useMemo(() => {
      const counts: Record<ParentSegment, number> = {
        new_parent: 0,
        current_family: 0,
        unknown: 0,
      };
      for (const log of logs) {
        if (phoneFilter && phoneKey(log.participantId) !== phoneFilter) continue;
        const segment = (log.parentSegment || 'unknown') as ParentSegment;
        counts[segment] = (counts[segment] || 0) + 1;
      }
      return counts;
    }, [logs, phoneFilter]);

    const filteredLogs = useMemo(() => {
      return logs.filter((log) => {
        if (phoneFilter && phoneKey(log.participantId) !== phoneFilter) return false;
        if (segmentFilter !== 'all' && (log.parentSegment || 'unknown') !== segmentFilter) return false;
        return true;
      });
    }, [logs, segmentFilter, phoneFilter]);

    const filteredTotal = filteredLogs.length;
    const segmentLabel =
      segmentFilter === 'all' ? 'All segments' : getSegmentLabel(segmentFilter);
    const phoneFilterLabel = phoneFilter
      ? (logs.find((log) => phoneKey(log.participantId) === phoneFilter)?.participantId || phoneFilter)
      : null;

    useEffect(() => {
      if (expandedId && !filteredLogs.some((log) => log.id === expandedId)) {
        setExpandedId(null);
      }
    }, [expandedId, filteredLogs]);

    const openPhoneHistory = (phone: string) => {
      const key = phoneKey(phone);
      if (!key) return;
      setPhoneFilter((prev) => (prev === key ? null : key));
      setSegmentFilter('all');
      setExpandedId(null);
    };

    const fetchLogs = useCallback(async (params: Record<string, string>, signal?: AbortSignal) => {
      if (params.period === 'custom' && (!params.startDate || !params.endDate)) return;
      try {
        setLoading(true);
        const res = await api.get('/school/call-logs', { params, signal });
        const payload = res.data;
        // Support both legacy array responses and newer `{ logs, total }` payloads.
        if (Array.isArray(payload)) {
          setLogs(payload);
          setTotal(payload.length);
        } else if (payload && Array.isArray(payload.logs)) {
          setLogs(payload.logs);
          setTotal(Number(payload.total) || payload.logs.length);
        } else {
          setLogs([]);
          setTotal(0);
        }
      } catch (err) {
        if (axios.isAxiosError(err) && err.code === 'ERR_CANCELED') return;
        console.error('Failed to load call logs:', err);
        setLogs([]);
        setTotal(0);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    }, []);

    useEffect(() => {
      if (!rangeReady) {
        setLoading(false);
        return;
      }
      const controller = new AbortController();
      void fetchLogs(query, controller.signal);
      return () => controller.abort();
    }, [query, rangeReady, fetchLogs]);

    const toggleExpand = (id: string | null) => setExpandedId(expandedId === id ? null : id);

    const formatDuration = (seconds: number) => {
        const min = Math.floor(seconds / 60);
        const sec = Math.round(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="max-w-6xl mx-auto py-6 px-4">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-100 pb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('call_logs')}</h1>
                    <p className="text-slate-500 text-sm mt-1">{t('dashboard_desc')}</p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Database Sync</p>
                    <p className="text-xs font-bold text-emerald-500">Live Active</p>
                </div>
            </div>

            <div className="mb-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Call history range</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {loading
                      ? 'Loading calls…'
                      : phoneFilter
                        ? `${filteredTotal} call${filteredTotal === 1 ? '' : 's'} from ${phoneFilterLabel}`
                      : segmentFilter === 'all'
                        ? `${total} call${total === 1 ? '' : 's'} in ${periodLabel.toLowerCase()}`
                        : `${filteredTotal} of ${total} · ${segmentLabel} · ${periodLabel.toLowerCase()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as CallLogsPeriod)}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {period === 'custom' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      />
                      <span className="text-xs text-slate-400 font-medium">to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSegmentFilter('all');
                    setPhoneFilter(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    segmentFilter === 'all' && !phoneFilter
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All
                  <span className="ml-1.5 tabular-nums opacity-80">{total}</span>
                </button>
                {SEGMENT_FILTERS.map((segment) => (
                  <button
                    key={segment}
                    type="button"
                    onClick={() => {
                      setSegmentFilter(segment);
                      setPhoneFilter(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${getSegmentFilterButtonClassName(segment, !phoneFilter && segmentFilter === segment)}`}
                  >
                    {getSegmentLabel(segment)}
                    <span className="ml-1.5 tabular-nums opacity-80">{segmentCounts[segment]}</span>
                  </button>
                ))}
              </div>
              {phoneFilter && (
                <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2">
                  <p className="text-xs font-semibold text-indigo-800">
                    Showing all calls from <span className="tabular-nums">{phoneFilterLabel}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setPhoneFilter(null)}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline"
                  >
                    Clear number filter
                  </button>
                </div>
              )}
            </div>

            {!rangeReady ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Choose a start and end date</p>
                <p className="text-xs text-slate-400 mt-1">Pick a custom range to load older call history.</p>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center h-[40vh] gap-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{t('loading')}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <Phone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">No calls in {periodLabel.toLowerCase()}</p>
                <p className="text-xs text-slate-400 mt-1">Try a wider range to see older enrollment activity.</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <Phone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  {phoneFilter
                    ? `No calls found for ${phoneFilterLabel}`
                    : `No ${segmentLabel.toLowerCase()} calls in ${periodLabel.toLowerCase()}`}
                </p>
                <p className="text-xs text-slate-400 mt-1">Try another segment or a wider date range.</p>
              </div>
            ) : (
            <div className="space-y-4">
                {filteredLogs.map((log) => {
                    const phone = String(log.participantId || '').replace(/^sip_/i, '');
                    const showName = isUsableDisplayName(log.callerName);
                    const badges = getDisplayTags(log);
                    const multiCall = (log.callCountTotal || 0) > 1;
                    return (
                    <div key={log.id} className={`bg-white border rounded-2xl transition-all ${expandedId === log.id ? 'border-blue-500 shadow-xl' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}>
                        <div className="px-4 sm:px-6 py-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(log.id)}>
                            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${expandedId === log.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm sm:text-base font-bold text-slate-900 truncate">
                                      {showName ? log.callerName : phone}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-0.5">
                                        {showName && (
                                          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 truncate">
                                            {phone}
                                          </span>
                                        )}
                                        {log.callOrdinalLabel && (
                                          multiCall ? (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openPhoneHistory(log.participantId);
                                              }}
                                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap transition-colors ${
                                                phoneFilter && phoneKey(log.participantId) === phoneFilter
                                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                              }`}
                                              title="View all calls from this number"
                                            >
                                              {log.callOrdinalLabel}
                                            </button>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                              {log.callOrdinalLabel}
                                            </span>
                                          )
                                        )}
                                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase whitespace-nowrap">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(log.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase whitespace-nowrap">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.createdAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 whitespace-nowrap">
                                            {formatDuration(log.duration)}
                                        </span>
                                    </div>
                                    {badges.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        {badges.map((badge) => (
                                          <span
                                            key={`${log.id}-${badge.label}`}
                                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badge.className}`}
                                          >
                                            {badge.label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 transition-transform duration-300 shrink-0 ${expandedId === log.id ? 'rotate-180 text-blue-600' : 'text-slate-300'}`} />
                        </div>

                        {expandedId === log.id && (
                            <div className="p-4 sm:p-6 pt-2 bg-slate-50/30 border-t border-slate-50 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                    <div className="xl:col-span-4 space-y-4">
                                        <SeekableAudioPlayer src={log.recordingUrl} />
                                        {log.summary && (
                                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-1 h-3 bg-blue-600 rounded-full" />
                                                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{t('ai_insights')}</h3>
                                                </div>
                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium italic">"{log.summary}"</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="xl:col-span-8 flex flex-col">
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-blue-500" />
                                                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Conversation Transcript</h3>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-md">
                                                {log.transcript.length} UTTERANCES
                                            </span>
                                        </div>

                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 max-h-[450px] overflow-y-auto custom-scrollbar shadow-inner">
                                            {Array.isArray(log.transcript) && log.transcript.length > 0 ? (
                                                <div className="space-y-4">
                                                    {log.transcript.map((msg, idx) => {
                                                        const isAI = msg.role.toLowerCase().includes('assistant') || msg.role.toLowerCase().includes('ai') || msg.role === 'Mia';
                                                        return (
                                                            <div key={idx} className="flex gap-4 group">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${isAI ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                    {isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isAI ? 'text-blue-600' : 'text-slate-900'}`}>
                                                                            {isAI ? t('mia_assistant') : t('caller')}
                                                                        </span>
                                                                        {msg.timestamp && (
                                                                            <span className="text-[9px] font-bold text-slate-300">{msg.timestamp}</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[13px] text-slate-700 leading-relaxed">{msg.text}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="py-20 text-center">
                                                    <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No transcript data found</p>
                                                    <p className="text-[11px] text-slate-400 mt-1">This may be due to an active session still processing.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    );
                })}
            </div>
            )}
        </div>
    );
};
