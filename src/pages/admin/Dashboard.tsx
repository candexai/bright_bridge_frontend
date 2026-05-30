import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Phone, Calendar, Clock, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import api from '../../api/axios';

interface ActivityItem {
  type: 'tour_booked' | 'call_dropped' | 'warning' | 'spanish_call' | 'tour_completed' | 'new_school';
  school: string;
  details: string;
  time: string;
}

interface DashboardData {
  metrics: Array<{ label: string; value: number }>;
  callMinutesOverTime: Array<{
    _id: string;
    totalMinutes: number;
    totalCalls: number;
  }>;
  topSchoolsByMinutes: Array<{
    schoolId: string;
    schoolName: string;
    totalMinutes: number;
    totalCalls: number;
  }>;
  recentCalls: Array<{
    id: string;
    school_name: string;
    caller_name: string;
    caller_phone: string;
    call_type: string;
    duration: number;
    timestamp: string;
  }>;
  recentFollowups: Array<{
    id: string;
    school_name: string;
    lead_name: string;
    type: string;
    status: string;
    timestamp: string;
  }>;
  conversionReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  schoolsNeedingTuning: Array<{
    schoolId: string;
    schoolName: string;
    count: number;
  }>;
  overview: {
    totalSchools: number;
    activeSchools: number;
    totalCalls: number;
    callsWithSchoolId: number;
    totalFollowups: number;
    sentFollowups: number;
    totalReferrals: number;
    totalToursBooked: number;
    totalCallMinutes: number;
    schoolsAddedThisMonth: number;
    callsDifference: number;
    callsChangePercent: number;
    conversionRate: number;
  };
}

interface SchoolInfo {
  id: string;
  name: string;
  subscriptionPlanKey: string;
  tours: number;
  minuteBalance: number | null;
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [schoolsInfo, setSchoolsInfo] = useState<SchoolInfo[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'month' | 'range'>('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterType === 'month' && selectedMonth) {
        params.month = selectedMonth;
      } else if (filterType === 'range' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const [dashboardRes, schoolsRes] = await Promise.all([
        api.get('/admin/dashboard', { params }),
        api.get('/admin/schools'),
      ]);
      setData(dashboardRes.data);
      setSchoolsInfo(schoolsRes.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const summaryCards = data?.overview ? [
    {
      title: 'ACTIVE SCHOOLS',
      value: data.overview.activeSchools.toString(),
      subtitle: `${data.overview.schoolsAddedThisMonth} added this month`,
      icon: null,
      trend: null
    },
    {
      title: 'TOTAL CALLS',
      value: data.overview.totalCalls.toString(),
      subtitle: `${data.overview.callsDifference > 0 ? '+' : ''}${data.overview.callsDifference} vs last month`,
      icon: Phone,
      trend: null
    },
    {
      title: 'TOURS BOOKED',
      value: data.overview.totalToursBooked.toString(),
      subtitle: `${data.overview.conversionRate || 0}% conversion`,
      icon: Calendar,
      trend: null
    },
    {
      title: 'MISSED BOOKINGS',
      value: (data.overview.totalCalls - data.overview.totalToursBooked).toString(),
      subtitle: 'Calls with no tour',
      icon: null,
      trend: null
    },
    {
      title: 'TOTAL MINUTES',
      value: data.overview.totalCallMinutes.toString(),
      subtitle: `of ${schoolsInfo.reduce((sum: number, s: any) => {
        const planMinutesMap: { [key: string]: number } = {
          'starter': 250,
          'growth': 500,
          'full_enrollment': 750,
          'pro': 750,
          'demo': 2
        };
        return sum + (planMinutesMap[s.subscriptionPlanKey] || 100);
      }, 0)} capacity`,
      icon: Clock,
      trend: null
    }
  ] : [];

  const schoolsData = schoolsInfo
    .map((school: any) => {
      const topSchoolData = data?.topSchoolsByMinutes?.find((s: any) => s.schoolId === school.id);
      const totalCalls = topSchoolData?.totalCalls || 0;
      const totalMinutes = topSchoolData?.totalMinutes || 0;
      const toursBooked = filterType === 'all' ? (school.tours || 0) : 0; // Hide tours when date filter is applied
      const conversion = totalCalls > 0 && filterType === 'all' ? Math.round((toursBooked / totalCalls) * 100) : 0;
      let health: 'Poor' | 'Watch' | 'Good' = 'Good';
      if (conversion < 30) health = 'Poor';
      else if (conversion < 60) health = 'Watch';

      const planMinutesMap: { [key: string]: number } = {
        'starter': 250,
        'growth': 500,
        'full_enrollment': 750,
        'pro': 750,
        'demo': 2
      };
      const planMinutes = planMinutesMap[school.subscriptionPlanKey] || 100;
      const minutesUsed = Math.round(totalMinutes / 60);

      let conversionFlag = 'None';
      if (totalCalls > 0 && filterType === 'all') {
        if (conversion < 30) conversionFlag = 'Low conversion';
        else if (conversion < 60) conversionFlag = 'Medium conversion';
        else conversionFlag = 'High conversion';
      }

      const flags = conversionFlag !== 'None' ? conversionFlag : (minutesUsed / planMinutes > 0.8 ? 'Min. warning' : 'None');

      return {
        initials: school.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2),
        name: school.name,
        location: 'Location',
        health,
        plan: school.subscriptionPlanKey || 'none',
        calls: totalCalls,
        toursBooked,
        conversion: filterType === 'all' && totalCalls > 0 ? `${conversion}%` : '—',
        minutesUsed: `${minutesUsed} / ${planMinutes}`,
        minutesUsedValue: minutesUsed,
        minutesTotal: planMinutes,
        flags,
        action: 'View'
      };
    }) || [];

  const conversionReasons = data?.conversionReasons || [];

  const activityFeed: ActivityItem[] = [
    // Recent calls
    ...(data?.recentCalls || []).map((call: any): ActivityItem => ({
      type: call.call_type === 'Tour Booking' ? 'tour_booked' : 'call_dropped',
      school: call.school_name,
      details: `${call.caller_name} · ${call.call_type} · ${Math.round(call.duration)}s`,
      time: new Date(call.timestamp).toLocaleTimeString()
    })),
    // Recent followups
    ...(data?.recentFollowups || []).map((followup: any): ActivityItem => ({
      type: 'tour_booked',
      school: followup.school_name,
      details: `${followup.lead_name} · ${followup.type}`,
      time: new Date(followup.timestamp).toLocaleTimeString()
    }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'tour_booked':
        return <Calendar className="w-4 h-4 text-green-600" />;
      case 'call_dropped':
        return <Phone className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'spanish_call':
        return <Phone className="w-4 h-4 text-blue-600" />;
      case 'tour_completed':
        return <Calendar className="w-4 h-4 text-green-600" />;
      case 'new_school':
        return <AlertCircle className="w-4 h-4 text-purple-600" />;
    }
  };

  const getActivityBgColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'tour_booked':
        return 'bg-green-50 border-green-100';
      case 'call_dropped':
        return 'bg-red-50 border-red-100';
      case 'warning':
        return 'bg-amber-50 border-amber-100';
      case 'spanish_call':
        return 'bg-blue-50 border-blue-100';
      case 'tour_completed':
        return 'bg-green-50 border-green-100';
      case 'new_school':
        return 'bg-purple-50 border-purple-100';
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filterType, selectedMonth, startDate, endDate]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [filterType, selectedMonth, startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-64 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-2"></div>
              <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 w-20 bg-slate-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Performance Overview Skeleton */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="h-6 w-64 bg-slate-200 rounded animate-pulse mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse"></div>
            ))}
          </div>
        </div>

        {/* Conversion Reasons Skeleton */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="h-6 w-64 bg-slate-200 rounded animate-pulse mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                <div className="h-2 w-full bg-slate-100 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed Skeleton */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {data?.overview?.activeSchools || 0} schools active · {schoolsData.filter((s: any) => s.flags !== 'None').length} need your attention
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'month' | 'range')}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="range">Date Range</option>
          </select>
          {filterType === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {filterType === 'range' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {summaryCards.map((card, index) => (
          <div key={index} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.title}</span>
              {card.icon && <card.icon className="w-4 h-4 text-slate-400" />}
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{card.value}</div>
            <div className="text-xs text-slate-500">{card.subtitle}</div>
          </div>
        ))}
      </div>

      {/* Performance Overview */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ALL SCHOOLS — PERFORMANCE OVERVIEW</h2>
            <p className="text-sm text-slate-500 mt-1">Manage all schools and their performance metrics</p>
          </div>
          <button 
            onClick={() => navigate('/admin/schools')}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Manage all <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">SCHOOL</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">PLAN</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">CALLS</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">TOURS BOOKED</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">CONVERSION</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">MINUTES USED</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">FLAGS</th>
              </tr>
            </thead>
            <tbody>
              {schoolsData.map((school, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600">
                        {school.initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{school.name}</div>
                        <div className="text-xs text-slate-500">{school.location}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-slate-700">{school.plan}</td>
                  <td className="py-4 px-4 text-sm font-medium text-slate-900">{school.calls}</td>
                  <td className="py-4 px-4 text-sm text-slate-700">{school.toursBooked}</td>
                  <td className="py-4 px-4 text-sm font-medium text-slate-900">{school.conversion}</td>
                  <td className="py-4 px-4">
                    <div className="text-sm text-slate-700">{school.minutesUsed}</div>
                    <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1">
                      <div 
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.max(0, Math.min(100, school.minutesTotal > 0 ? (school.minutesUsedValue / school.minutesTotal) * 100 : 0))}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {school.flags === 'None' ? (
                      <span className="text-xs text-slate-400">None</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-700">{school.flags}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Why Calls Don't Convert */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">WHY CALLS DON'T CONVERT — ALL SCHOOLS</h2>
            <p className="text-sm text-slate-500 mt-1">Details on call drop-offs</p>
          </div>

          {/* Nora Tuning Alert */}
          {data?.schoolsNeedingTuning && data.schoolsNeedingTuning.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  {data.schoolsNeedingTuning.map((school: any, index: number) => (
                    <div key={index} className="text-sm text-amber-800 mb-2">
                      <strong>Nora needs tuning at {school.schoolName}</strong>
                      <div className="text-amber-700 mt-1">
                        {school.count} calls ended because Nora couldn't answer a parent question — likely about pricing, specific programs, or pickup routes. Update her knowledge base for that school.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {conversionReasons.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{item.reason}</span>
                    <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="h-full rounded-full bg-slate-700"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-500 w-12 text-right">{item.percentage}%</span>
              </div>
            ))}
          </div>

          {data?.schoolsNeedingTuning && data.schoolsNeedingTuning.length > 0 && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  {data.schoolsNeedingTuning.map((school: any, index: number) => (
                    <div key={index} className="mb-2">
                      <div className="text-sm font-semibold text-amber-800 mb-1">Nora needs tuning at {school.schoolName}</div>
                      <div className="text-xs text-amber-700">
                        {school.count} calls ended because Nora couldn't answer a parent question - likely about pricing, specific programs, or pickup routes. Update her knowledge base for that school.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Activity Feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">LIVE ACTIVITY FEED</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-500">Auto-refreshes</p>
                <RefreshCw className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {activityFeed.map((activity, index) => (
              <div key={index} className={`flex items-start gap-3 p-3 rounded-lg border ${getActivityBgColor(activity.type)}`}>
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900">{activity.school}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{activity.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">{activity.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Needs Attention */}
      {schoolsData.filter((s: any) => s.flags === 'Low conversion').length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-amber-800 mb-3">Needs attention:</div>
          <div className="space-y-2 text-sm text-amber-700">
            {schoolsData.filter((s: any) => s.flags === 'Low conversion').map((school: any, index: number) => (
              <div key={index}>{school.name} — {school.flags}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
