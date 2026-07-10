import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Activity, PhoneCall, Mic, TrendingUp, ArrowRight, Lightbulb, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricCard } from '../../components/MetricCard';
import { Link } from 'react-router-dom';
import axios from 'axios';
import api from '../../api/axios';
import { Calendar as CalendarUI } from '../../components/Calendar';
import { SeekableAudioPlayer } from '../../components/SeekableAudioPlayer';
import {
  type ParentSegment,
  getSegmentLabel,
  getSegmentBadgeClassName,
  getSegmentFilterButtonClassName,
  getTourBookedBadgeClassName,
  getTourEmailMissingBadgeClassName,
  TOUR_EMAIL_MISSING_LABEL,
} from '../../utils/parentSegment';

type RecentCall = {
  id: string;
  conversationId?: string | null;
  callerName: string;
  callerPhone: string;
  callType: string;
  duration: number;
  timestamp: string;
  recordingUrl: string | null;
  summary?: string;
  tourBookingDetected?: boolean;
  tourBookingDate?: string | null;
  tourEmailMissing?: boolean;
  tags?: string[];
  aiProcessed?: boolean;
  parentSegment?: 'new_parent' | 'current_family' | 'unknown';
  callOrdinal?: number;
  callCountTotal?: number;
  callOrdinalLabel?: string;
};

interface DashboardResponse {
  metrics: Array<{ label: string; value: number; change?: number; maxValue?: number }>;
  chartData: Array<{ name: string; calls: number; inquiries: number }>;
  recentCalls?: RecentCall[];
}

type DashboardPeriod = '30d' | '15d' | '7d' | '1d' | 'custom';
type RecentCallsPeriod = '7d' | '30d' | '60d' | '90d' | 'custom';

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: '30d', label: 'Last 30 days' },
  { value: '15d', label: 'Last 15 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '1d', label: 'Last 1 day' },
  { value: 'custom', label: 'Custom' },
];

const RECENT_CALLS_PERIOD_OPTIONS: Array<{ value: RecentCallsPeriod; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '60d', label: 'Last 60 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

function buildPeriodQuery(
  period: string,
  customStart: string,
  customEnd: string
): Record<string, string> {
  const params: Record<string, string> = { period };
  if (period === 'custom' && customStart && customEnd) {
    params.startDate = customStart;
    params.endDate = customEnd;
  }
  return params;
}

export const SchoolDashboard = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [tourBookings, setTourBookings] = useState<Array<{
    id: string;
    parentName: string;
    phone: string;
    email: string;
    scheduledAt: string;
    calendarProvider: string | null;
  }>>([]);
  const [toursLoading, setToursLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<ParentSegment>('new_parent');
  const [callerSearch, setCallerSearch] = useState('');

  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [recentCallsLoading, setRecentCallsLoading] = useState(true);
  const [recentCallsPeriod, setRecentCallsPeriod] = useState<RecentCallsPeriod>('30d');
  const [recentCallsStartDate, setRecentCallsStartDate] = useState('');
  const [recentCallsEndDate, setRecentCallsEndDate] = useState('');
  const [recentCallsTotal, setRecentCallsTotal] = useState(0);

  const customRangeReady = period !== 'custom' || (Boolean(customStartDate) && Boolean(customEndDate) && customStartDate <= customEndDate);
  const recentCallsRangeReady =
    recentCallsPeriod !== 'custom'
    || (Boolean(recentCallsStartDate) && Boolean(recentCallsEndDate) && recentCallsStartDate <= recentCallsEndDate);

  const dashboardQuery = useMemo(
    () => buildPeriodQuery(period, customStartDate, customEndDate),
    [period, customStartDate, customEndDate]
  );

  const recentCallsQuery = useMemo(
    () => buildPeriodQuery(recentCallsPeriod, recentCallsStartDate, recentCallsEndDate),
    [recentCallsPeriod, recentCallsStartDate, recentCallsEndDate]
  );

  const fetchDashboard = React.useCallback(async (query: Record<string, string>, signal?: AbortSignal) => {
    if (query.period === 'custom' && (!query.startDate || !query.endDate)) {
      return;
    }
    try {
      const dashboardRes = await api.get('/school/dashboard', { params: query, signal });
      setData(dashboardRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      if (axios.isAxiosError(err) && err.code === 'ERR_CANCELED') return;
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const fetchRecentCalls = React.useCallback(async (query: Record<string, string>, signal?: AbortSignal) => {
    if (query.period === 'custom' && (!query.startDate || !query.endDate)) {
      return;
    }
    try {
      setRecentCallsLoading(true);
      const res = await api.get('/school/recent-calls', { params: query, signal });
      setRecentCalls(Array.isArray(res.data?.recentCalls) ? res.data.recentCalls : []);
      setRecentCallsTotal(Number(res.data?.total) || 0);
    } catch (err) {
      if (axios.isAxiosError(err) && err.code === 'ERR_CANCELED') return;
      console.error('Failed to load recent calls:', err);
      setRecentCalls([]);
      setRecentCallsTotal(0);
    } finally {
      if (!signal?.aborted) {
        setRecentCallsLoading(false);
      }
    }
  }, []);

  const fetchTourBookings = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const toursRes = await api.get('/school/tour-bookings', { signal });
      setTourBookings(Array.isArray(toursRes.data) ? toursRes.data : []);
    } catch (err) {
      if (axios.isAxiosError(err) && err.code === 'ERR_CANCELED') return;
      setTourBookings([]);
    } finally {
      if (!signal?.aborted) {
        setToursLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!customRangeReady) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void fetchDashboard(dashboardQuery, controller.signal);
    void fetchTourBookings(controller.signal);
    const intervalId = setInterval(() => {
      fetchDashboard(dashboardQuery);
      fetchTourBookings();
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [dashboardQuery, customRangeReady, fetchDashboard, fetchTourBookings]);

  useEffect(() => {
    if (!recentCallsRangeReady) {
      setRecentCallsLoading(false);
      return;
    }
    const controller = new AbortController();
    void fetchRecentCalls(recentCallsQuery, controller.signal);
    const intervalId = setInterval(() => {
      fetchRecentCalls(recentCallsQuery);
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [recentCallsQuery, recentCallsRangeReady, fetchRecentCalls]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <p className="text-sm text-slate-500">{t('loading')}</p>
      </div>
    );
  }

  if (!data) {
    if (period === 'custom' && !customRangeReady) {
      return (
        <div className="animate-soft max-w-[1600px] mx-auto">
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">Select a date range</h3>
            <p className="text-slate-500 text-sm">Choose a start and end date to view dashboard metrics.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-1">{t('unable_to_load_metrics')}</h3>
        <p className="text-slate-500 text-sm">{t('check_connection')}</p>
      </div>
    );
  }

  const { metrics, chartData } = data;
  const normalizedCallerSearch = callerSearch.trim().toLowerCase();
  const normalizedCallerSearchDigits = normalizedCallerSearch.replace(/\D/g, '');

  const segmentCounts: Record<ParentSegment, number> = {
    new_parent: 0,
    current_family: 0,
    unknown: 0,
  };
  for (const call of recentCalls) {
    if (normalizedCallerSearch) {
      const name = String(call.callerName || '').toLowerCase();
      const phone = String(call.callerPhone || '');
      const phoneDigits = phone.replace(/\D/g, '');
      const matches =
        name.includes(normalizedCallerSearch)
        || phone.toLowerCase().includes(normalizedCallerSearch)
        || (Boolean(normalizedCallerSearchDigits) && phoneDigits.includes(normalizedCallerSearchDigits));
      if (!matches) continue;
    }
    const segment = (call.parentSegment || 'new_parent') as ParentSegment;
    segmentCounts[segment] += 1;
  }

  const filteredRecentCalls = recentCalls.filter((call) => {
    if ((call.parentSegment || 'new_parent') !== segmentFilter) return false;
    if (!normalizedCallerSearch) return true;
    const name = String(call.callerName || '').toLowerCase();
    const phone = String(call.callerPhone || '');
    const phoneDigits = phone.replace(/\D/g, '');
    if (name.includes(normalizedCallerSearch)) return true;
    if (phone.toLowerCase().includes(normalizedCallerSearch)) return true;
    if (normalizedCallerSearchDigits && phoneDigits.includes(normalizedCallerSearchDigits)) return true;
    return false;
  });
  const recentCallsPeriodLabel =
    RECENT_CALLS_PERIOD_OPTIONS.find((opt) => opt.value === recentCallsPeriod)?.label
    || 'selected range';


  return (
    <div className="animate-soft max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('dashboard')}</h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider tabular-nums shrink-0">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              Live • {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500">{t('dashboard_desc')}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-w-[140px]"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {period === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  aria-label="Start date"
                />
                <span className="text-xs font-bold text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  aria-label="End date"
                />
              </>
            )}
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden lg:block" />

          {/* Action Links */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              to="/school/daily-insights"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all shadow-sm"
            >
              <Lightbulb className="w-4 h-4" />
              Daily Insights
            </Link>
          </div>
        </div>
      </div>

      {/* Row 1: Top Metrics (Full Width) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5 mb-10">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {/* Row 2: Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 items-start">
        {/* Left: Analytics Chart (8 Columns) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm h-full hidden lg:block">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2.5">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Inquiry Call Volume
            </h2>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 px-2 py-1 rounded">
              Trend Analysis
            </div>
          </div>
          <div className="w-full h-[400px]">
            {chartData?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dy={15} minTickGap={20} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dx={-10} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    labelStyle={{ fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}
                  />
                  <Line type="monotone" dataKey="calls" name="Calls" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                No telemetry available for this window.
              </div>
            )}
          </div>
        </div>

        {/* Right: School Calendar (4 Columns) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden min-h-[500px] relative">
          {toursLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[1px] rounded-2xl">
              <Loader2 className="w-7 h-7 text-primary-600 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">{t('loading')}</span>
            </div>
          )}
          <CalendarUI bookings={tourBookings} />
        </div>
      </div>



      <div className="space-y-4">
        {/* Recent Calls date range — independent of KPI period */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Call history range</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {recentCallsLoading
                ? 'Loading calls…'
                : `${recentCallsTotal} call${recentCallsTotal === 1 ? '' : 's'} in ${recentCallsPeriodLabel.toLowerCase()}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={recentCallsPeriod}
              onChange={(e) => setRecentCallsPeriod(e.target.value as RecentCallsPeriod)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              {RECENT_CALLS_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {recentCallsPeriod === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={recentCallsStartDate}
                  onChange={(e) => setRecentCallsStartDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
                <span className="text-xs text-slate-400 font-medium">to</span>
                <input
                  type="date"
                  value={recentCallsEndDate}
                  onChange={(e) => setRecentCallsEndDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>
            )}
          </div>
        </div>

        {/* Recent Calls - Full Width */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 shrink-0">
              <PhoneCall className="w-4 h-4 text-primary-600" />
              {t('recent_calls')}
            </h2>
            <div className="flex items-center gap-2 flex-wrap flex-1 lg:justify-end">
              <div className="relative w-full sm:w-56 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={callerSearch}
                  onChange={(e) => setCallerSearch(e.target.value)}
                  placeholder="Search name or number"
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>
              {(['new_parent', 'current_family', 'unknown'] as ParentSegment[]).map((segment) => (
                <button
                  key={segment}
                  type="button"
                  onClick={() => setSegmentFilter(segment)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${getSegmentFilterButtonClassName(segment, segmentFilter === segment)}`}
                >
                  {getSegmentLabel(segment)}
                  <span className="ml-1.5 tabular-nums opacity-80">{segmentCounts[segment]}</span>
                </button>
              ))}
              <Link to="/school/call-logs" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors ml-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto relative min-h-[120px]">
            {recentCallsLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[1px]">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                <span className="text-xs text-slate-500 font-medium">Loading call history…</span>
              </div>
            )}
            {!recentCallsRangeReady ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Choose a start and end date to load calls.
              </div>
            ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4 bg-slate-50/30 whitespace-nowrap">{t('call_time')}</th>
                  <th className="px-6 py-4 bg-slate-50/30">{t('caller')}</th>
                  <th className="px-6 py-4 bg-slate-50/30">Status</th>
                  <th className="px-6 py-4 bg-slate-50/30">Tour Date</th>
                  <th className="px-6 py-4 bg-slate-50/30">{t('duration')}</th>
                  <th className="px-6 py-4 bg-slate-50/30 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecentCalls.length === 0 && !recentCallsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                      {normalizedCallerSearch
                        ? `No ${getSegmentLabel(segmentFilter).toLowerCase()} calls match “${callerSearch.trim()}”.`
                        : `No ${getSegmentLabel(segmentFilter).toLowerCase()} calls in ${recentCallsPeriodLabel.toLowerCase()}.`}
                    </td>
                  </tr>
                ) : filteredRecentCalls.map((call) => (
                  <React.Fragment key={call.id}>
                    <tr className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}>
                      <td className="px-6 py-4">
                        {call.timestamp ? (
                          <>
                            <div className="text-sm font-semibold text-slate-600 tabular-nums">
                              {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                              {new Date(call.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{call.callerName}</div>
                        <div className="text-xs text-slate-500 font-medium">{call.callerPhone}</div>
                        {call.callOrdinalLabel && (
                          <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {call.callOrdinalLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold border ${getSegmentBadgeClassName(call.parentSegment)}`}>
                            {getSegmentLabel(call.parentSegment)}
                          </span>
                          {call.tourBookingDetected && (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold border ${getTourBookedBadgeClassName()}`}>
                              Tour Booked
                            </span>
                          )}
                          {(() => {
                            const emailMissingTag = (call.tags || []).find((tag) =>
                              tag.toLowerCase().includes('email missing')
                            );
                            const showEmailMissing = call.tourEmailMissing || Boolean(emailMissingTag);
                            if (!showEmailMissing) return null;
                            return (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold border ${getTourEmailMissingBadgeClassName()}`}>
                              {emailMissingTag || TOUR_EMAIL_MISSING_LABEL}
                            </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {call.tourBookingDate ? (
                          <>
                            <div className="text-sm font-semibold text-slate-600 tabular-nums">
                              {new Date(call.tourBookingDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                              {new Date(call.tourBookingDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-300" />
                          {Math.floor(call.duration / 60)}m {call.duration % 60}s
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {call.recordingUrl ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(expandedId === call.id ? null : call.id);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            {expandedId === call.id ? 'Close' : 'Insights'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold italic uppercase tracking-widest bg-slate-50 px-2 py-1 rounded border border-slate-100">No Recording</span>
                        )}
                      </td>
                    </tr>
                    {expandedId === call.id && call.recordingUrl && (
                      <tr className="bg-slate-50/50 border-l-4 border-l-blue-500">
                        <td colSpan={6} className="px-8 py-8">
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Mic className="w-3 h-3 text-blue-500" /> Audio Playback
                              </p>
                              <SeekableAudioPlayer src={call.recordingUrl} />
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                              <p className="text-[10px] font-bold text-slate-900 mb-4 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                AI Generated Insights
                              </p>
                              <p className="text-sm text-slate-600 leading-relaxed italic font-medium">
                                {call.summary
                                  ? `"${call.summary}"`
                                  : 'Summary is not available yet for this call. Please refresh shortly or check Call Logs for the full transcript.'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
