import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, AlertTriangle, Calendar, Clock,
  Star, ChevronDown, ChevronUp,
  Headphones, CheckCircle2,
  Check, X, Search
} from 'lucide-react';
import api from '../../api/axios';
import { formatCallTimestamp } from '../../utils';
import { SeekableAudioPlayer } from '../../components/SeekableAudioPlayer';
import {
  type ParentSegment,
  getSegmentLabel,
  getSegmentFilterButtonClassName,
  getSegmentTagClassName,
  getTourEmailMissingBadgeClassName,
  getTourBookedBadgeClassName,
} from '../../utils/parentSegment';
import { filterTourCardQuestions, filterTourCardTalkingPoints } from '../../utils/tourCardQuestions';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NeedsAttentionCall {
  id: string;
  conversationId: string | null;
  callerName: string;
  callerPhone: string;
  summary: string;
  timestamp: string;
  recordingUrl: string | null;
  duration: number;
  questionsAsked?: string[];
  actionTakenFeedback?: string;
  actionTakenAt?: string;
  feedbackHistory?: Array<{ feedback: string; timestamp: string }>;
  tags?: string[];
  childName?: string;
  childAge?: string;
  language?: string;
  missingDetails?: string[];
  isHotLead?: boolean;
  parentSegment?: ParentSegment;
  aiProcessed?: boolean;
  callOrdinal?: number;
  callCountTotal?: number;
  callOrdinalLabel?: string;
}

type InquiryTab = 'all' | 'hot_leads';

function hasCallbackRequestTag(tags: string[] = []): boolean {
  return tags.some((tag) => {
    const lower = String(tag).toLowerCase();
    return (
      lower.includes('parent requested callback')
      || lower.includes('callback requested')
      || lower.includes('callback')
      || lower.includes('call back')
    );
  });
}

/** Enrollment follow-ups only — matches dashboard Action Needed KPI. */
function isEnrollmentActionNeeded(call: NeedsAttentionCall): boolean {
  const segment = call.parentSegment || 'new_parent';
  if (segment === 'unknown' || segment === 'current_family') return false;
  return segment === 'new_parent' || hasCallbackRequestTag(call.tags || []);
}
function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const label = String(tag || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function getCallDisplayTags(call: NeedsAttentionCall): string[] {
  const raw: string[] = [];
  if (call.isHotLead) raw.push('Hot Lead');
  if (call.parentSegment === 'current_family') raw.push('Current Family');
  else if (call.parentSegment === 'unknown') raw.push('Unknown');
  else if (call.parentSegment === 'new_parent') raw.push('New Parent');
  for (const tag of call.tags || []) {
    const lower = tag.toLowerCase();
    if (lower === 'current family' || lower === 'new parent' || lower === 'unknown') continue;
    raw.push(tag);
  }
  return dedupeTags(raw);
}

function getTagClassName(tag: string): string {
  const segmentClass = getSegmentTagClassName(tag);
  if (segmentClass) return segmentClass;
  const lower = tag.toLowerCase();
  if (lower.includes('hot lead')) {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (lower.includes('email missing')) {
    return getTourEmailMissingBadgeClassName();
  }
  if (lower === 'tour booked' || (lower.includes('tour booked') && !lower.includes('email'))) {
    return getTourBookedBadgeClassName();
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

interface TodayTour {
  id: string;
  parentName: string;
  phone: string;
  email: string;
  childName: string;
  childAge: string;
  reason: string;
  scheduledAt: string;
  calendarProvider: string | null;
  questionsAsked: string[];
  tourTalkingPoints?: string[];
  highlights: string;
  callSummary: string;
  reminderSent: boolean;
  tags?: string[];
  language?: string;
  tourScript?: string[];
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const DailyInsights = () => {
  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionCall[]>([]);
  const [todaysTours, setTodaysTours] = useState<TodayTour[]>([]);
  const [todayCalls, setTodayCalls] = useState<{ id: string; timestamp: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [inquiryTab, setInquiryTab] = useState<InquiryTab>('all');
  const [segmentFilter, setSegmentFilter] = useState<ParentSegment>('new_parent');
  const [callerSearch, setCallerSearch] = useState('');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [, setNow] = useState(Date.now());
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [markingAction, setMarkingAction] = useState<Record<string, boolean>>({});
  const [closeConfirm, setCloseConfirm] = useState<string | null>(null);

  const handlePrintTourCard = (tour: TodayTour) => {
    const askedAbout = filterTourCardQuestions(tour.questionsAsked || []);
    const talkingPoints = filterTourCardTalkingPoints(tour.tourTalkingPoints || []);
    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Tour Card</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; padding: 14px; color: #1f2937; background: #f8fafc; margin: 0; }
          .intent { margin: 0 0 10px 2px; color: #4b5563; font-size: 14px; font-weight: 600; }
          .card { border: 1px solid #d9ddd7; border-radius: 14px; overflow: hidden; max-width: 900px; width: 100%; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; background: #f3f4ef; color: #666b63; padding: 11px 16px; font-size: 13px; letter-spacing: .6px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
          .print { color: #3b6ea8; font-weight: 700; }
          .top { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
          .avatar { width: 42px; height: 42px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: #dbeafe; color: #4a6b9b; font-weight: 700; font-size: 16px; }
          .name { font-size: 46px; line-height: 1.05; font-weight: 700; margin: 0; color: #1f2937; }
          .tour { font-size: 20px; color: #374151; font-weight: 600; margin-top: 2px; }
          .body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
          .col { padding: 16px; min-height: 420px; min-width: 0; }
          .col + .col { border-left: 1px solid #e5e7eb; }
          .row { margin: 0 0 16px 0; }
          .k { font-size: 15px; color: #6b7280; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; margin-bottom: 3px; }
          .v { font-size: 24px; line-height: 1.22; font-weight: 600; color: #111827; overflow-wrap: anywhere; word-break: break-word; }
          .left-chip { display: inline-block; margin-top: 2px; padding: 4px 10px; border-radius: 9px; background: #dbeafe; color: #4a6b9b; font-size: 19px; font-weight: 600; max-width: 100%; overflow-wrap: anywhere; }
          .q-list { margin: 0; padding-left: 24px; }
          .q-list li { margin: 9px 0; font-size: 24px; line-height: 1.2; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; overflow-wrap: anywhere; word-break: break-word; }
          .q-list li:last-child { border-bottom: none; }
          .talking { margin-top: 12px; }
          .talking .item { margin: 9px 0; background: #f4f3ed; border-radius: 9px; padding: 9px 11px; font-size: 22px; line-height: 1.24; font-weight: 600; color: #374151; overflow-wrap: anywhere; word-break: break-word; }
          .tag-wrap { margin-top: 6px; }
          .tag { display: inline-block; margin: 0 6px 6px 0; padding: 4px 9px; border-radius: 999px; background: #e0efff; color: #2f5f9a; border: 1px solid #c7def6; font-size: 12px; font-weight: 600; }
          @media print {
            @page { size: A4 portrait; margin: 8mm; }
            body { background: #fff; padding: 0; margin: 0; }
            .intent { margin: 0 0 8px 0; font-size: 12px; }
            .card { max-width: 100%; border-radius: 10px; }
            .header { font-size: 9px; padding: 7px 9px; }
            .top { padding: 10px; gap: 10px; }
            .avatar { width: 34px; height: 34px; font-size: 16px; }
            .name { font-size: 28px; }
            .tour { font-size: 14px; }
            .col { padding: 10px; min-height: auto; }
            .k { font-size: 10px; }
            .v { font-size: 15px; line-height: 1.25; }
            .left-chip { font-size: 14px; padding: 4px 8px; }
            .q-list { padding-left: 18px; }
            .q-list li { font-size: 13px; margin: 6px 0; padding-bottom: 6px; }
            .talking { margin-top: 10px; }
            .talking .item { font-size: 12px; margin: 6px 0; padding: 7px 9px; }
            .tag { font-size: 9px; padding: 3px 7px; margin: 0 4px 4px 0; }
          }
        </style>
      </head>
      <body>
        <div class="intent">Looking to enroll in ${tour.reason?.includes('June') ? 'June' : 'upcoming month'}</div>
        <div class="card">
          <div class="header">
            <span>ONE-PAGER - PRINTABLE TOUR CARD</span>
            <span class="print">PRINT</span>
          </div>
          <div class="top">
            <div class="avatar">${(tour.parentName || 'P').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div>
              <h1 class="name">${tour.parentName || 'Parent'}</h1>
              <div class="tour">Tour: ${new Date(tour.scheduledAt).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            </div>
          </div>
          <div class="body">
            <div class="col">
              <div class="row"><div class="k">Phone</div><div class="v">${tour.phone || '-'}</div></div>
              <div class="row"><div class="k">Email</div><div class="v">${tour.email || '-'}</div></div>
              <div class="row"><div class="k">Child(ren)</div><div class="left-chip">${tour.childName || 'Child'}${tour.childAge ? ` • ${tour.childAge}` : ''}</div></div>
              <div class="row"><div class="k">Enrollment Target</div><div class="v">${tour.reason || 'Planned'}</div></div>
              <div class="row"><div class="k">Language</div><div class="v">${tour.language || 'English'}</div></div>
              ${(tour.tags && tour.tags.length) ? `<div class="row"><div class="k">Tags</div><div class="tag-wrap">${tour.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div></div>` : ''}
            </div>
            <div class="col">
              <div class="row">
                <div class="k">What They Asked About</div>
                <ul class="q-list">${askedAbout.map(q => `<li>${q}</li>`).join('')}</ul>
              </div>
              <div class="row talking">
                <div class="k">Tour Talking Points For Staff</div>
                ${talkingPoints.map(p => `<div class="item">${p}</div>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback for environments where popups are blocked.
      const currentTabMarkup = html.replace('<script>window.print();</script>', '');
      document.open();
      document.write(currentTabMarkup);
      document.close();
      window.print();
      return;
    }

    const markup = html.replace('<script>window.print();</script>', '');
    printWindow.document.open();
    printWindow.document.write(markup);
    printWindow.document.close();
    printWindow.focus();

    // Trigger print after render; avoids CSP blocking inline scripts in production.
    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        console.error('Failed to trigger print:', err);
      }
    };

    if (printWindow.document.readyState === 'complete') {
      triggerPrint();
    } else {
      printWindow.addEventListener('load', triggerPrint, { once: true });
      setTimeout(triggerPrint, 500);
    }
  };


  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/school/daily-insights');
        setNeedsAttention(res.data.actionNeeded || []);
        setTodaysTours(res.data.todaysTours || []);
        setTodayCalls(res.data.todayCalls || []);
      } catch (err) {
        console.error('Failed to load daily insights:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkActionTaken = async (callId: string) => {
    setMarkingAction(prev => ({ ...prev, [callId]: true }));
    try {
      const feedback = feedbackInputs[callId] || '';
      await api.post(`/school/action-needed/${callId}/mark-action-taken`, {
        feedback
      });
      
      // Update the local state to append the feedback to history
      setNeedsAttention(prev => prev.map(call => 
        call.id === callId 
          ? { 
              ...call, 
              actionTakenFeedback: feedback,
              actionTakenAt: new Date().toISOString(),
              feedbackHistory: [
                ...(call.feedbackHistory || []),
                { feedback, timestamp: new Date().toISOString() }
              ]
            }
          : call
      ));
      
      // Clear the feedback input after submission
      setFeedbackInputs(prev => ({ ...prev, [callId]: '' }));
      
      console.log('Action marked as taken successfully');
    } catch (err) {
      console.error('Failed to mark action as taken:', err);
    } finally {
      setMarkingAction(prev => ({ ...prev, [callId]: false }));
    }
  };

  const handleCloseCard = (callId: string) => {
    setCloseConfirm(callId);
  };

  const confirmCloseCard = async () => {
    if (closeConfirm) {
      try {
        await api.delete(`/school/action-needed/${closeConfirm}`);
      } catch (err) {
        console.error('Failed to delete from server:', err);
        // Silently ignore server errors
      }
      // Always remove from local state
      setNeedsAttention(prev => prev.filter(call => call.id !== closeConfirm));
      setCloseConfirm(null);
    }
  };

  const cancelCloseCard = () => {
    setCloseConfirm(null);
  };

  const hotLeads = useMemo(
    () => needsAttention.filter((call) => call.isHotLead && isEnrollmentActionNeeded(call)),
    [needsAttention]
  );

  const segmentCounts = useMemo(() => {
    const counts: Record<ParentSegment, number> = {
      new_parent: 0,
      current_family: 0,
      unknown: 0,
    };
    const normalizedSearch = callerSearch.trim().toLowerCase();
    const searchDigits = normalizedSearch.replace(/\D/g, '');

    for (const call of needsAttention) {
      if (normalizedSearch) {
        const name = String(call.callerName || '').toLowerCase();
        const phone = String(call.callerPhone || '');
        const phoneDigits = phone.replace(/\D/g, '');
        const matches =
          name.includes(normalizedSearch)
          || phone.toLowerCase().includes(normalizedSearch)
          || (Boolean(searchDigits) && phoneDigits.includes(searchDigits));
        if (!matches) continue;
      }
      const segment = (call.parentSegment || 'new_parent') as ParentSegment;
      counts[segment] += 1;
    }
    return counts;
  }, [needsAttention, callerSearch]);

  const actionNeededCount = useMemo(() => {
    // Keep Action Needed identical to the New Parent chip (+ any callback-tagged enrollment items).
    const fromNewParent = segmentCounts.new_parent;
    const extraCallbacks = needsAttention.filter((call) => {
      const segment = call.parentSegment || 'new_parent';
      if (segment === 'new_parent') return false;
      if (segment === 'unknown' || segment === 'current_family') return false;
      return hasCallbackRequestTag(call.tags || []);
    }).length;
    return fromNewParent + extraCallbacks;
  }, [needsAttention, segmentCounts]);

  const displayedInquiries = useMemo(() => {
    const normalizedSearch = callerSearch.trim().toLowerCase();
    const searchDigits = normalizedSearch.replace(/\D/g, '');

    let list = inquiryTab === 'hot_leads'
      ? hotLeads
      : needsAttention.filter((call) => (call.parentSegment || 'new_parent') === segmentFilter);

    if (normalizedSearch) {
      list = list.filter((call) => {
        const name = String(call.callerName || '').toLowerCase();
        const phone = String(call.callerPhone || '');
        const phoneDigits = phone.replace(/\D/g, '');
        if (name.includes(normalizedSearch)) return true;
        if (phone.toLowerCase().includes(normalizedSearch)) return true;
        if (searchDigits && phoneDigits.includes(searchDigits)) return true;
        return false;
      });
    }

    return list;
  }, [inquiryTab, hotLeads, needsAttention, segmentFilter, callerSearch]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Calculate call timing buckets from actual todayCalls data
  const callTimingData = useMemo(() => {
    const counts: Record<'Morning' | 'Afternoon' | 'Evening', number> = {
      Morning: 0,
      Afternoon: 0,
      Evening: 0
    };

    todayCalls.forEach(call => {
      const callDate = new Date(call.timestamp);
      const hour = callDate.getHours();
      
      if (hour < 12) {
        counts.Morning++;
      } else if (hour >= 12 && hour < 15) {
        counts.Afternoon++;
      } else {
        counts.Evening++;
      }
    });

    return counts;
  }, [todayCalls]);

  // Determine peak call time
  const peakCallTime = useMemo(() => {
    const counts = callTimingData;
    const maxCount = Math.max(counts.Morning, counts.Afternoon, counts.Evening);
    
    if (maxCount === 0) return 'No calls today';
    
    if (counts.Morning === maxCount) return 'Morning';
    if (counts.Afternoon === maxCount) return 'Afternoon';
    return 'Evening';
  }, [callTimingData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-slate-500 text-sm">Loading daily insights…</p>
      </div>
    );
  }

  return (
    <div className="animate-soft space-y-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Daily Insights</h1>
        <p className="text-sm text-slate-500">{today} • Good morning — here's what needs your attention today</p>
      </div>

      {/* Top Row Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {/* CALLS TODAY */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CALLS TODAY</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{todayCalls.length}</div>
          <div className="text-xs text-slate-500 mt-1">Since midnight</div>
        </div>

        {/* HOT LEADS */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">HOT LEADS</div>
          <div className="text-2xl font-bold text-amber-600 tabular-nums">{hotLeads.length}</div>
          <div className="text-xs text-slate-500 mt-1">High-intent follow-ups</div>
        </div>

        {/* ACTION NEEDED */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ACTION NEEDED</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums">{actionNeededCount}</div>
          <div className="text-xs text-slate-500 mt-1">Matches New Parent queue</div>
        </div>

        {/* TOURS TODAY */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOURS TODAY</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{todaysTours.length}</div>
          <div className="text-xs text-slate-500 mt-1">
            {todaysTours.length > 0 
              ? `${new Date(todaysTours[0].scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Completed`
              : 'No tours'
            }
          </div>
        </div>

        {/* PEAK CALL TIME */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PEAK CALL TIME</div>
          <div className="text-2xl font-bold text-slate-900">{peakCallTime}</div>
          <div className="text-xs text-slate-500 mt-1">
            {todayCalls.length > 0 ? 'Staff available then?' : 'No calls today'}
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inquiries Needing Attention */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 tracking-wide">Inquiries needing attention</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {inquiryTab === 'hot_leads'
                      ? 'High-intent enrollment follow-ups'
                      : `${getSegmentLabel(segmentFilter)} queue · last 30 days`}
                  </p>
                </div>
              </div>
              <span className="shrink-0 px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold tabular-nums">
                {displayedInquiries.length}
              </span>
            </div>

            <div className="px-5 py-3.5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={callerSearch}
                  onChange={(e) => setCallerSearch(e.target.value)}
                  placeholder="Search by name or phone number"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-300 transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(['new_parent', 'current_family', 'unknown'] as ParentSegment[]).map((segment) => {
                  const active = segmentFilter === segment && inquiryTab !== 'hot_leads';
                  return (
                    <button
                      key={segment}
                      type="button"
                      onClick={() => {
                        setSegmentFilter(segment);
                        setInquiryTab('all');
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${getSegmentFilterButtonClassName(segment, active)}`}
                    >
                      <span>{getSegmentLabel(segment)}</span>
                      <span className={`min-w-[1.25rem] text-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                        active ? 'bg-white/20 text-inherit' : 'bg-white/80 text-slate-600 border border-slate-200/80'
                      }`}>
                        {segmentCounts[segment]}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setInquiryTab(inquiryTab === 'hot_leads' ? 'all' : 'hot_leads')}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ml-auto ${
                    inquiryTab === 'hot_leads'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${inquiryTab === 'hot_leads' ? 'fill-white text-white' : 'text-amber-500'}`} />
                  <span>Hot Leads</span>
                  <span className={`min-w-[1.25rem] text-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                    inquiryTab === 'hot_leads' ? 'bg-white/20' : 'bg-white text-amber-800 border border-amber-200'
                  }`}>
                    {hotLeads.length}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {displayedInquiries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-700 font-semibold">
                {inquiryTab === 'hot_leads' ? 'No hot leads right now' : 'All clear!'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {inquiryTab === 'hot_leads'
                  ? 'High-intent follow-ups from enrollment inquiries will appear here.'
                  : callerSearch.trim()
                    ? `No ${getSegmentLabel(segmentFilter).toLowerCase()} inquiries match “${callerSearch.trim()}”.`
                    : `No ${getSegmentLabel(segmentFilter).toLowerCase()} inquiries from the last 30 days.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedInquiries.map((call) => {
                const displayTags = getCallDisplayTags(call);
                // Get initials from caller name
                const initials = call.callerName
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                
                return (
                  <div
                    key={call.id}
                    className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Call row */}
                    <div className="px-5 py-4">
                      <div className="flex items-start gap-4">
                        {/* Initials avatar */}
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-slate-600">{initials}</span>
                        </div>
                        
                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          {/* Name and phone */}
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-sm font-bold text-slate-900">{call.callerName}</span>
                            {call.callerPhone && (
                              <span className="text-xs text-slate-500">{call.callerPhone}</span>
                            )}
                            {call.callOrdinalLabel && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {call.callOrdinalLabel}
                              </span>
                            )}
                          </div>
                          
                          {/* Tags — single deduplicated row */}
                          {displayTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {displayTags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getTagClassName(tag)}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* Description */}
                          {call.summary && (
                            <p className="text-xs text-slate-600 line-clamp-2 mb-2">{call.summary}</p>
                          )}
                          
                          {/* Child info, language, missing details */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
                            {call.childName && (
                              <span>Child: {call.childName}{call.childAge && ` (${call.childAge})`}</span>
                            )}
                            {call.language && (
                              <span>Language: {call.language}</span>
                            )}
                          </div>
                          
                          {call.missingDetails && call.missingDetails.length > 0 && (
                            <div className="text-xs text-slate-500 mb-2">
                              Missing: {call.missingDetails.join(', ')}
                            </div>
                          )}
                          
                          {/* Duration and time */}
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-600 tabular-nums">
                                {formatCallTimestamp(call.timestamp)}
                              </span>
                            </span>
                            <span className="text-slate-400 tabular-nums">
                              {Math.floor(call.duration / 60)}m {call.duration % 60}s
                            </span>
                          </div>
                        </div>
                        
                        {/* Expand toggle */}
                        <button
                          onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors shrink-0"
                        >
                          {expandedCall === call.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                  {/* Expanded detail */}
                  {expandedCall === call.id && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4 bg-slate-50/40">
                      {call.recordingUrl && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Headphones className="w-3 h-3" /> Recording
                          </p>
                          <SeekableAudioPlayer src={call.recordingUrl} compact />
                        </div>
                      )}
                      {call.summary && (
                        <div className="bg-white rounded-lg border border-slate-200 p-4">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">What Happened</p>
                          <p className="text-sm text-slate-700 leading-relaxed italic">"{call.summary}"</p>
                        </div>
                      )}
                      {call.feedbackHistory && call.feedbackHistory.length > 0 && (
                        <div className="border border-slate-200 p-4">
                          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3">
                            Action History ({call.feedbackHistory.length})
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-3 max-h-40 overflow-y-auto">
                            {call.feedbackHistory
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                              .map((entry, index) => (
                                <div key={index} className="text-xs text-slate-700 leading-relaxed border-b border-slate-200 pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0 font-mono">
                                  [{new Date(entry.timestamp).toLocaleString()}] {entry.feedback}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      {closeConfirm === call.id && (
                        <div className="bg-slate-100 rounded-lg border border-slate-200 p-4">
                          <h4 className="text-sm font-bold text-slate-900 mb-2">Close this card?</h4>
                          <p className="text-xs text-slate-600 mb-3">Are you sure you want to remove this card from the list?</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={cancelCloseCard}
                              className="flex-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={confirmCloseCard}
                              className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer"
                              type="button"
                            >
                              Yes, Close
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Add New Feedback</p>
                        <div className="flex gap-2">
                          <textarea
                            value={feedbackInputs[call.id] || ''}
                            onChange={(e) => setFeedbackInputs(prev => ({ ...prev, [call.id]: e.target.value }))}
                            placeholder="Write feedback about action taken..."
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none h-20 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleMarkActionTaken(call.id)}
                              disabled={markingAction[call.id]}
                              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                              {markingAction[call.id] ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                </>
                              ) : (
                                <>
                                  <Check className="w-3 h-3" />
                                  Submit
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleCloseCard(call.id)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                            >
                              <X className="w-3 h-3" /> Close
                            </button>
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

        {/* Right Column: Tours/Actions */}
        <div className="lg:col-span-1 space-y-6">
          {/* Today's Tours Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">TODAY'S TOURS</h3>
            </div>
            <div className="text-xs text-slate-500 mb-3">{todaysTours.length} scheduled</div>
            
            {todaysTours.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">No upcoming tours scheduled today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysTours.map((tour) => (
                  <div key={tour.id} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-xs font-bold text-slate-900">
                        {new Date(tour.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      <div className="font-semibold">{tour.parentName}</div>
                      <div className="mt-1">{tour.childName} • {tour.childAge}</div>
                      <div className="mt-1 text-slate-500">{tour.reason || 'Enrollment inquiry'}</div>
                    </div>
                    {!!tour.tags?.length && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {dedupeTags(tour.tags).slice(0, 4).map((tag, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getTagClassName(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePrintTourCard(tour)}
                      className="mt-3 w-full px-2 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Print Tour Card
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Call Timing Today Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">CALL TIMING TODAY</h3>
            </div>
            {todayCalls.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">No calls today</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">Morning</span>
                    <span className="font-bold text-slate-900">{callTimingData.Morning}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-400 rounded-full" 
                      style={{ width: `${todayCalls.length > 0 ? (callTimingData.Morning / todayCalls.length) * 100 : 0}%` }} 
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">Afternoon</span>
                    <span className="font-bold text-slate-900">{callTimingData.Afternoon}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-400 rounded-full" 
                      style={{ width: `${todayCalls.length > 0 ? (callTimingData.Afternoon / todayCalls.length) * 100 : 0}%` }} 
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">Evening</span>
                    <span className="font-bold text-slate-900">{callTimingData.Evening}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full" 
                      style={{ width: `${todayCalls.length > 0 ? (callTimingData.Evening / todayCalls.length) * 100 : 0}%` }} 
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-600 leading-relaxed">
                {todayCalls.length > 0 
                  ? `Most calls are in the ${peakCallTime.toLowerCase()}. Ensure staff is available for follow-ups then.`
                  : 'No calls received today.'
                }
              </p>
            </div>
          </div>

          {/* Quick Actions Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">QUICK ACTIONS</h3>
            </div>
            <div className="space-y-2">
              {hotLeads.length > 0 && (
                <button
                  type="button"
                  onClick={() => setInquiryTab('hot_leads')}
                  className="w-full text-left text-xs text-slate-700 hover:text-amber-700 hover:bg-amber-50 px-3 py-2 rounded-lg transition-colors"
                >
                  Review {hotLeads.length} hot lead{hotLeads.length === 1 ? '' : 's'}
                </button>
              )}

              {/* Follow up with most recent enrollment action-needed call */}
              {actionNeededCount > 0 && (
                <button className="w-full text-left text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
                  Follow up with {(needsAttention.find(isEnrollmentActionNeeded) || needsAttention[0]).callerName}
                </button>
              )}
              
              {/* Schedule tour manually - always available */}
              <button className="w-full text-left text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
                Schedule a tour manually
              </button>
              
              {/* Mark tour enrolled - based on actual scheduled tours */}
              {todaysTours.length > 0 && (
                <button className="w-full text-left text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
                  Mark {todaysTours[0].parentName}'s tour enrolled
                </button>
              )}
              
              {/* Download call report - always available if there are calls today */}
              {todayCalls.length > 0 && (
                <button className="w-full text-left text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
                  Download today's call report
                </button>
              )}
              
              {/* If no actions available, show message */}
              {needsAttention.length === 0 && todaysTours.length === 0 && todayCalls.length === 0 && (
                <div className="text-xs text-slate-400 px-3 py-2">
                  No actions available today
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
