import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, PlayCircle, Activity, PhoneCall, Mic, TrendingUp, Play, Pause, Headphones, Download, ArrowRight, Lightbulb } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricCard } from '../../components/MetricCard';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import api from '../../api/axios';
import { Calendar as CalendarUI } from '../../components/Calendar';


const AudioPlayer = ({ src }: { src: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || error) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const seekToClientX = (clientX: number) => {
    if (!audioRef.current || !progressBarRef.current || error) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width || 1;
    const percentage = Math.max(0, Math.min(1, x / width));
    audioRef.current.currentTime = percentage * (audioRef.current.duration || 0);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (error || loading) return;
    isScrubbingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    e.stopPropagation();
    seekToClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    e.stopPropagation();
    isScrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-xl p-3 w-full ${error ? 'opacity-75' : ''}`}>
      <audio
        ref={audioRef} src={src}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setLoading(false);
          }
        }}
        onCanPlay={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        onEnded={() => setIsPlaying(false)}
        hidden
      />

      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={togglePlay}
          disabled={error || loading}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shrink-0 ${error ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>
        <div className="flex-1">
          {error ? (
            <div className="h-6 flex items-center justify-center text-[10px] font-semibold text-red-500 bg-red-50 rounded italic">
              Recording unavailable or still processing
            </div>
          ) : (
            <>
              <div
                ref={progressBarRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="h-1.5 bg-slate-200 rounded-full cursor-pointer relative touch-none"
                role="slider"
                aria-label="Seek audio"
                aria-valuemin={0}
                aria-valuemax={Math.max(0, Math.floor(duration))}
                aria-valuenow={Math.max(0, Math.floor(currentTime))}
              >
                <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full" style={{ width: `${progressPercentage}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-bold text-slate-400">{formatTime(currentTime)}</span>
                <span className="text-[10px] font-bold text-slate-400">{formatTime(duration)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Headphones className="w-3 h-3" />
          <span className="text-[8px] font-bold uppercase tracking-wider">
            {error ? 'Error loading audio' : 'Recording Console'}
          </span>
        </div>
        {!error && !loading && (
          <a href={src} download className="text-slate-400 hover:text-blue-600">
            <Download className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};

interface DashboardResponse {
  metrics: Array<{ label: string; value: number; change?: number; maxValue?: number }>;
  chartData: Array<{ name: string; calls: number; inquiries: number }>;
  recentCalls: Array<{
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
    aiProcessed?: boolean;
  }>;

}

export const SchoolDashboard = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
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

  const fetchDashboard = React.useCallback(async (p: string, signal?: AbortSignal) => {
    console.log(`[Dashboard] Fetching dashboard for period: ${p}`);
    try {
      const dashboardRes = await api.get(`/school/dashboard?period=${p}`, { signal });
      console.log(`[Dashboard] Received data for period: ${dashboardRes.data.period}`, dashboardRes.data.metrics);
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
    console.log(`[Dashboard] useEffect triggered by period: ${period}`);
    const controller = new AbortController();
    setLoading(true);
    void fetchDashboard(period, controller.signal);
    void fetchTourBookings(controller.signal);
    const intervalId = setInterval(() => {
      fetchDashboard(period);
      fetchTourBookings();
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [period, fetchDashboard, fetchTourBookings]);



  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <p className="text-slate-500 text-sm">{t('loading')}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-1">{t('unable_to_load_metrics')}</h3>
        <p className="text-slate-500 text-sm">{t('check_connection')}</p>
      </div>
    );
  }

  const { metrics, chartData, recentCalls } = data;


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

        <div className="flex items-center gap-4 flex-wrap w-full md:w-auto">
          {/* Period Filter Pills - Restoration */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 shadow-inner w-full sm:w-auto">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all capitalize ${period === p
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'bg-transparent text-slate-400 hover:text-slate-600'
                  }`}
              >
                {p}
              </button>
            ))}
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
            <button
              onClick={async () => {
                try {
                  await api.post('/school/test-call');
                  window.location.reload();
                } catch (err) {
                  alert(t('test_call_failed'));
                }
              }}
              className="flex-1 sm:flex-none ui-button-primary gap-2 !rounded-xl px-4 !py-2 shadow-sm"
            >
              <PlayCircle className="w-4 h-4" />
              {t('simulate_inquiry_call')}
            </button>
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



      <div className="space-y-8">
        {/* Recent Calls - Full Width */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-primary-600" />
              {t('recent_calls')}
            </h2>
            <Link to="/school/call-logs" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
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
                {recentCalls.map((call) => (
                  <React.Fragment key={call.id}>
                    <tr className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}>
                      <td className="px-6 py-4">
                        {call.timestamp ? (
                          <>
                            <div className="text-sm font-semibold text-slate-600 tabular-nums">
                              {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                              {new Date(call.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{call.callerName}</div>
                        <div className="text-xs text-slate-500 font-medium">{call.callerPhone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${call.tourBookingDetected
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                          {call.tourBookingDetected ? 'Tour booked' : 'Action Needed'}
                        </span>
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
                              <AudioPlayer src={call.recordingUrl} />
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
          </div>
        </div>
      </div>
    </div>
  );
};
