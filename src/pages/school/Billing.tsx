import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CreditCard, AlertCircle, CheckCircle, Check } from 'lucide-react';
import api from '../../api/axios';

interface TopupSegment {
  maxMinutes: number | null;
  centsPerMinute: number;
  description: string;
}

interface BillingStatus {
  billingMode: string;
  subscriptionPlanKey: string;
  subscriptionStatus: string;
  minuteBalance: number | null;
  foundingPartner: boolean;
  onboardingFeePaid: boolean;
  planDetails: {
    monthlyUsd: number;
    onboardingUsd: number;
    includedMinutesPerMonth: number;
  } | null;
  topupPricing?: {
    minMinutes: number;
    maxMinutes: number;
    segments: TopupSegment[];
  };
  minuteBreakdown?: {
    includedPlanMinutes: number;
    topupMinutesPurchased: number;
    totalAvailable: number;
  };
  /** From server: which PayPal Billing Plan IDs are set in .env */
  paypalPlansConfigured?: Record<string, boolean>;
}

interface CouponPreview {
  couponApplied: boolean;
  couponCode: string;
  couponName: string;
  originalAmountUsd: number;
  discountAmountUsd: number;
  finalAmountUsd: number;
}
interface PlanOption {
  key: string;
  name: string;
  tagline: string;
  price: number;
  minutes: number;
  bestFor: string;
  features: string[];
  tourBooking: string;
}

/** Matches server `topupPricing` segment rules (first N minutes per segment at centsPerMinute). */
function computeTopupTotalCents(minutes: number, segments: TopupSegment[]): number {
  let rem = Math.floor(minutes);
  if (rem < 1) return 0;
  let totalCents = 0;
  for (const seg of segments) {
    const cap = seg.maxMinutes == null ? rem : Math.min(rem, seg.maxMinutes);
    totalCents += cap * seg.centsPerMinute;
    rem -= cap;
    if (rem <= 0) break;
  }
  return totalCents;
}

function computeTopupUsd(minutes: number, segments: TopupSegment[]): number {
  return Math.round(computeTopupTotalCents(minutes, segments)) / 100;
}

function computeAverageRateCents(minutes: number, segments: TopupSegment[]): number {
  const wholeMinutes = Math.floor(minutes);
  if (wholeMinutes < 1) return 0;
  return computeTopupTotalCents(wholeMinutes, segments) / wholeMinutes;
}

function topupBreakdown(
  minutes: number,
  segments: TopupSegment[],
): { description: string; minutes: number; subtotalUsd: number }[] {
  let rem = Math.floor(minutes);
  if (rem < 1) return [];
  const rows: { description: string; minutes: number; subtotalUsd: number }[] = [];
  for (const seg of segments) {
    if (rem <= 0) break;
    const cap = seg.maxMinutes == null ? rem : Math.min(rem, seg.maxMinutes);
    if (cap <= 0) continue;
    const subCents = cap * seg.centsPerMinute;
    rows.push({
      description: seg.description,
      minutes: cap,
      subtotalUsd: Math.round(subCents) / 100,
    });
    rem -= cap;
  }
  return rows;
}

function getApiError(e: unknown, fallback: string): string {
  const ax = e as {
    response?: { data?: unknown; status?: number };
    message?: string;
  };
  const d = ax.response?.data;
  if (typeof d === 'string' && d.trim()) return d;
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    if (typeof o.error === 'string' && o.error.trim()) return o.error;
    if (typeof o.message === 'string' && o.message.trim()) return o.message;
  }
  if (ax.message && !ax.message.startsWith('Request failed')) return ax.message;
  return fallback;
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'Stop missing calls',
    price: 195,
    minutes: 250,
    bestFor:
      'Best for schools losing inquiries to voicemail and wanting an immediate safety net with no extra staff burden.',
    features: [
      'Answers every new parent call during class, lunch rush, and after hours',
      'Shares school info: hours, programs, age groups',
      'Captures parent name and phone number',
      'Collects preferred tour date and time',
      'Call summary emailed to director after every call',
      'English language support',
      '250 included minutes per month (~50 average calls)',
    ],
    tourBooking: 'Parent requests a preferred time your staff confirms and books manually.',
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'GROWTH: Capture and schedule',
    price: 245,
    minutes: 500,
    bestFor:
      'Best for schools ready to convert more inquiries into confirmed tours without adding staff hours or manual back-and-forth.',
    features: [
      'Real-time calendar integration (Google or Outlook)',
      'Nora books tours live during the call with instant confirmation to parent',
      'Full parent profile: name, phone, email, child name and age',
      'Bilingual support English and Spanish',
      'Higher-conversion conversation flow tuned for childcare',
      '500 included minutes per month (~100 average calls)',
    ],
    tourBooking:
      'Nora books directly on your calendar during the call. Parent receives instant confirmation before they hang up.',
  },
  {
    key: 'full_enrollment',
    name: 'Full enrollment',
    tagline: 'Full enrollment system',
    price: 290,
    minutes: 750,
    bestFor:
      'Best for schools that want a managed, consistent enrollment process with visibility into performance and zero dropped leads.',
    features: [
      'After-hours and weekend call coverage, every day',
      'Priority alerts for high-intent families director notified immediately',
      'Advanced call summaries with key parent insights and questions asked',
      'Printable tour day one-pager for staff personalized per family',
      'Director dashboard calls received, tours booked, follow-ups needed',
      'Automated email reminders sent to parent before each tour',
      'Ongoing AI tuning as your programs, staff, or availability changes',
      'Multi-location support available',
      '750 included minutes per month (~150 average calls)',
    ],
    tourBooking:
      'Nora books directly, sends confirmation, and triggers automated reminders before the tour date. Zero no-shows go unaddressed.',
  },
];

const TOPUP_PRESETS = [25, 50, 100, 150, 250, 500, 750, 1000, 1500, 2000];

export const SchoolBilling = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [topupMinutes, setTopupMinutes] = useState(50);
  const [topupPreset, setTopupPreset] = useState<string>('50');
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [planCouponCode, setPlanCouponCode] = useState('');
  const [planCouponPreview, setPlanCouponPreview] = useState<CouponPreview | null>(null);
  const [planCouponBusy, setPlanCouponBusy] = useState(false);
  const checkoutRef = useRef<HTMLDivElement | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const returnUrl = `${baseUrl}/school/billing?sub=return`;
  const cancelUrl = `${baseUrl}/school/billing?sub=cancel`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/billing/status');
      setStatus(res.data);
    } catch {
      setError('Could not load billing status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const tp = status?.topupPricing;
    if (!tp) return;
    setTopupMinutes((prev) => {
      const clamped = Math.min(tp.maxMinutes, Math.max(tp.minMinutes, prev));
      const matchPreset =
        TOPUP_PRESETS.includes(clamped) && clamped >= tp.minMinutes && clamped <= tp.maxMinutes;
      setTopupPreset(matchPreset ? String(clamped) : 'custom');
      return clamped;
    });
  }, [status?.topupPricing]);

  useEffect(() => {
    const sub = searchParams.get('sub');
    const subscriptionId = searchParams.get('subscription_id');
    const orderId =
      searchParams.get('token') || searchParams.get('orderId') || searchParams.get('order_id');

    if (sub === 'return' && subscriptionId) {
      setBusy(true);
      api
        .post('/billing/sync-subscription', { subscriptionId })
        .then(() => {
          setMessage('Subscription updated.');
          load();
        })
        .catch(() => setError('Could not confirm subscription.'))
        .finally(() => {
          setBusy(false);
          setSearchParams({}, { replace: true });
        });
      return;
    }

    if (sub === 'return' && orderId) {
      setBusy(true);
      api
        .post('/billing/capture-order', { orderId })
        .then((res) => {
          if (res.data?.subscriptionApprovalUrl) {
            window.location.href = res.data.subscriptionApprovalUrl;
            return;
          }
          setMessage('Payment completed.');
          load();
        })
        .catch(() => setError('Could not confirm payment.'))
        .finally(() => {
          setBusy(false);
          setSearchParams({}, { replace: true });
        });
    }
  }, [searchParams, setSearchParams, load]);

  const subscribe = async (planKey: string, selectedCouponCode?: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/billing/subscribe', {
        planKey,
        returnUrl,
        cancelUrl,
        couponCode: selectedCouponCode?.trim() || undefined,
      });
      if (res.data.approvalUrl) {
        window.location.href = res.data.approvalUrl;
        return;
      }
      setError('PayPal did not return an approval URL. Check server PayPal plan configuration.');
    } catch (e: unknown) {
      setError(getApiError(e, 'Subscribe failed. Check the server console and PayPal credentials.'));
    } finally {
      setBusy(false);
    }
  };

  const applyPlanCoupon = async () => {
    if (!selectedPlan) return;
    const code = planCouponCode.trim();
    if (!code) {
      setPlanCouponPreview(null);
      setError('Enter a coupon code first.');
      return;
    }
    setPlanCouponBusy(true);
    setError('');
    try {
      const res = await api.post('/billing/coupon/preview', {
        orderType: 'subscription',
        planKey: selectedPlan.key,
        couponCode: code,
      });
      setPlanCouponPreview(res.data as CouponPreview);
      setMessage(`Coupon ${res.data.couponCode} applied for ${selectedPlan.name}.`);
    } catch (e: unknown) {
      setPlanCouponPreview(null);
      setError(getApiError(e, 'Invalid coupon for selected plan.'));
    } finally {
      setPlanCouponBusy(false);
    }
  };


  const startTopup = async () => {
    const tp = status?.topupPricing;
    if (!tp) return;
    const clamped = Math.min(tp.maxMinutes, Math.max(tp.minMinutes, Math.floor(topupMinutes)));
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/billing/topup-order', {
        returnUrl,
        cancelUrl,
        minutes: clamped,
        couponCode: couponCode.trim() || undefined,
      });
      if (res.data.approvalUrl) {
        window.location.href = res.data.approvalUrl;
        return;
      }
      setError('Could not start top-up.');
    } catch (e: unknown) {
      setError(getApiError(e, 'Top-up failed.'));
    } finally {
      setBusy(false);
    }
  };

  const applyTopupCoupon = async () => {
    const tp = status?.topupPricing;
    if (!tp) return;
    const code = couponCode.trim();
    if (!code) {
      setCouponPreview(null);
      setError('Enter a coupon code first.');
      return;
    }
    const clamped = Math.min(tp.maxMinutes, Math.max(tp.minMinutes, Math.floor(topupMinutes)));
    setCouponBusy(true);
    setError('');
    try {
      const res = await api.post('/billing/coupon/preview', {
        orderType: 'topup',
        minutes: clamped,
        couponCode: code,
      });
      setCouponPreview(res.data as CouponPreview);
      setMessage(`Coupon ${res.data.couponCode} applied.`);
    } catch (e: unknown) {
      setCouponPreview(null);
      setError(getApiError(e, 'Invalid coupon.'));
    } finally {
      setCouponBusy(false);
    }
  };

  if (loading || busy) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const balance = status?.minuteBalance;
  const low = typeof balance === 'number' && balance <= 0;
  const active = status?.subscriptionStatus === 'active';
  const topupPricing = status?.topupPricing;
  const topupUsd =
    topupPricing && topupMinutes >= topupPricing.minMinutes
      ? computeTopupUsd(topupMinutes, topupPricing.segments)
      : 0;
  const breakdown =
    topupPricing && topupMinutes >= topupPricing.minMinutes
      ? topupBreakdown(topupMinutes, topupPricing.segments)
      : [];
  const presetOptions =
    topupPricing != null
      ? TOPUP_PRESETS.filter((m) => m >= topupPricing.minMinutes && m <= topupPricing.maxMinutes)
      : [];
  const cfg = status?.paypalPlansConfigured;
  const planEnvLabel: Record<string, string> = {
    starter: 'PAYPAL_PLAN_STARTER',
    growth: 'PAYPAL_PLAN_GROWTH',
    full_enrollment: 'PAYPAL_PLAN_FULL_ENROLLMENT',
  };
  const anyPlanMissing = cfg
    ? PLANS.some((p) => cfg[p.key] === false)
    : false;
  const maxFeatureCount = Math.max(...PLANS.map((p) => p.features.length));

  return (
    <div className="max-w-7xl mx-auto px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Billing & usage</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monthly plans renew automatically. Unused minutes roll over. Calls deduct from your balance in full minutes (rounded up).
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {anyPlanMissing && (
        <div className="flex items-start gap-2 text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">PayPal plan IDs are not set on the server</p>
            <p className="mt-1 text-amber-800/90">
              Add each Billing Plan ID from the PayPal dashboard to <code className="bg-amber-100/80 px-1 rounded text-xs">montessori-enrollment-ai-backend/.env</code>:
              {' '}<code className="text-xs">PAYPAL_PLAN_STARTER</code>, <code className="text-xs">PAYPAL_PLAN_GROWTH</code>,{' '}
              <code className="text-xs">PAYPAL_PLAN_FULL_ENROLLMENT</code>{' '}
              (values look like <code className="text-xs">P-1AB23456CD789012N</code>). Restart the API after saving.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Minute balance
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Status: <strong className="text-slate-800">{status?.subscriptionStatus || '—'}</strong>
              {status?.subscriptionPlanKey ? (
                <>
                  {' '}
                  · Plan: <strong className="text-slate-800">{status.subscriptionPlanKey}</strong>
                </>
              ) : null}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold tabular-nums ${low ? 'text-amber-600' : 'text-slate-900'}`}>
              {typeof balance === 'number' ? balance : '—'}
            </div>
            <div className="text-xs text-slate-500">minutes remaining</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Included plan minutes</p>
            <p className="text-base font-semibold text-slate-900 tabular-nums">
              {status?.minuteBreakdown?.includedPlanMinutes ?? (status?.planDetails?.includedMinutesPerMonth || 0)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Top-up minutes</p>
            <p className="text-base font-semibold text-slate-900 tabular-nums">
              {status?.minuteBreakdown?.topupMinutesPurchased ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Total available</p>
            <p className="text-base font-semibold text-slate-900 tabular-nums">
              {status?.minuteBreakdown?.totalAvailable ?? (typeof balance === 'number' ? balance : 0)}
            </p>
          </div>
        </div>

        {active && low && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            You have used your included minutes for this period. Purchase a top-up to keep uninterrupted service, or wait until your next monthly payment adds your plan allowance (unused minutes roll over).
          </div>
        )}

        {topupPricing && (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Buy more minutes</h3>
            <p className="text-xs text-slate-500">
              Choose how many minutes to add. Price uses stepped per-minute rates; the total below reflects your selection. Pay with PayPal; minutes are added after payment completes.
            </p>
            {!active && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Coupon entry is available now, but top-up payment is enabled only after your subscription becomes active.
              </div>
            )}

            <div>
              <label htmlFor="topup-preset" className="block text-xs font-medium text-slate-600 mb-1">
                Quick amount
              </label>
              <select
                id="topup-preset"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                value={topupPreset}
                disabled={!active}
                onChange={(e) => {
                  const v = e.target.value;
                  setTopupPreset(v);
                  if (v !== 'custom') {
                    const n = parseInt(v, 10);
                    if (!Number.isNaN(n)) setTopupMinutes(n);
                  }
                }}
              >
                <option value="custom">Custom (use slider)</option>
                {presetOptions.map((m) => (
                  <option key={m} value={String(m)}>
                    {topupPricing
                      ? `${m} minutes — $${computeTopupUsd(m, topupPricing.segments).toFixed(2)} total (${(
                          computeAverageRateCents(m, topupPricing.segments) / 100
                        ).toFixed(2)}/min avg)`
                      : `${m} minutes`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Minutes to purchase</span>
                <span className="font-semibold tabular-nums text-slate-900">{topupMinutes} min</span>
              </div>
              <input
                type="range"
                min={topupPricing.minMinutes}
                max={topupPricing.maxMinutes}
                value={Math.min(topupPricing.maxMinutes, Math.max(topupPricing.minMinutes, topupMinutes))}
                disabled={!active}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setTopupMinutes(n);
                  setTopupPreset(presetOptions.includes(n) ? String(n) : 'custom');
                  setCouponPreview(null);
                }}
                className="w-full h-2 accent-blue-600 rounded-lg appearance-none bg-slate-200 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 tabular-nums">
                <span>{topupPricing.minMinutes}</span>
                <span>{topupPricing.maxMinutes}</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
              <div>
                <label htmlFor="topup-coupon" className="block text-xs font-medium text-slate-600 mb-1">
                  Coupon code
                </label>
                <input
                  id="topup-coupon"
                  type="text"
                  value={couponCode}
                  disabled={!active}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponPreview(null);
                  }}
                  placeholder="e.g. SUMMER20"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
              <button type="button" onClick={applyTopupCoupon} disabled={!active || couponBusy || busy} className="ui-button-secondary h-10">
                {couponBusy ? 'Checking...' : 'Apply coupon'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCouponCode('');
                  setCouponPreview(null);
                }}
                disabled={!active || couponBusy || busy || (!couponCode && !couponPreview)}
                className="ui-button-secondary h-10"
              >
                Clear
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-slate-600">Total due</span>
                <span className="text-xl font-bold tabular-nums text-slate-900">
                  ${(couponPreview?.finalAmountUsd ?? topupUsd).toFixed(2)}
                </span>
              </div>
              {couponPreview && couponPreview.couponApplied && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
                  Coupon <strong>{couponPreview.couponCode}</strong> applied: -$
                  {couponPreview.discountAmountUsd.toFixed(2)} (from ${couponPreview.originalAmountUsd.toFixed(2)})
                </div>
              )}
              {breakdown.length > 1 && (
                <ul className="text-xs text-slate-500 space-y-0.5 border-t border-slate-200/80 pt-2 mt-1">
                  {breakdown.map((row) => (
                    <li key={row.description} className="flex justify-between gap-2">
                      <span>
                        {row.description} × {row.minutes} min
                      </span>
                      <span className="tabular-nums shrink-0">${row.subtotalUsd.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => startTopup()}
                disabled={!active || busy || (couponPreview?.finalAmountUsd ?? topupUsd) < 0.01}
                className="ui-button-primary"
              >
                Pay ${(couponPreview?.finalAmountUsd ?? topupUsd).toFixed(2)} with PayPal
              </button>
              <span className="text-xs text-slate-500">One-time charge · minutes roll over</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Plans (autopay monthly)</h2>
        {selectedPlan && (
          <div ref={checkoutRef} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Checkout</p>
                <p className="text-xs text-slate-600">
                  Selected plan: <strong>{selectedPlan.name}</strong> (${selectedPlan.price}/month)
                </p>
              </div>
              <button
                type="button"
                className="ui-button-secondary"
                onClick={() => {
                  setSelectedPlan(null);
                  setPlanCouponCode('');
                  setPlanCouponPreview(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full max-w-sm">
                <label className="block text-xs font-medium text-slate-600 mb-1">Coupon code (optional)</label>
                <input
                  type="text"
                  value={planCouponCode}
                  onChange={(e) => {
                    setPlanCouponCode(e.target.value.toUpperCase());
                    setPlanCouponPreview(null);
                  }}
                  placeholder="e.g. TEST20"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
              <button type="button" onClick={applyPlanCoupon} disabled={planCouponBusy || busy} className="ui-button-secondary h-10">
                {planCouponBusy ? 'Checking...' : 'Apply coupon'}
              </button>
              <button
                type="button"
                onClick={() => subscribe(selectedPlan.key, planCouponCode)}
                disabled={busy}
                className="ui-button-primary h-10"
              >
                Pay & Subscribe
              </button>
            </div>
            <div className="text-xs text-slate-700">
              {planCouponPreview?.couponApplied ? (
                <span className="text-emerald-700">
                  Coupon <strong>{planCouponPreview.couponCode}</strong> accepted for this plan. Discounted amount is handled by your configured discounted PayPal plan.
                </span>
              ) : (
                <span>
                  Monthly price: <strong>${selectedPlan.price.toFixed(2)}</strong>
                </span>
              )}
            </div>
          </div>
        )}
        <div className="grid gap-6 2xl:grid-cols-4 xl:grid-cols-3 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 items-stretch">
          {PLANS.map((p) => {
            const isSubscribed = status?.subscriptionPlanKey === p.key && status?.subscriptionStatus === 'active';
            const isMostPopular = p.key === 'growth';
            return (
              <div key={p.key} className={`h-full min-h-[1280px] bg-white border rounded-2xl shadow-sm flex flex-col relative ${isMostPopular ? 'border-2 border-blue-500' : 'border-slate-200'}`}>
                {isMostPopular && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    Most popular
                  </div>
                )}
                <div className="p-6 border-b border-slate-100 min-h-[290px]">
                  <div className="text-sm font-bold uppercase tracking-wide text-blue-600">{p.name}</div>
                  <div className="text-base text-slate-600 mt-2 min-h-[3rem]">{p.tagline}</div>
                  <div className="mt-4 text-4xl font-bold text-slate-900">${p.price}<span className="text-xl font-normal text-slate-500">/mo</span></div>
                  <div className="text-sm text-slate-500 mt-2">{p.minutes} min / month included</div>
                  <div className="mt-4 bg-slate-50 rounded-lg p-3 text-sm text-slate-600 leading-relaxed min-h-[108px] break-words">
                    {p.bestFor}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    What Nora handles
                  </div>
                  <ul className="space-y-3 mb-5 2xl:min-h-[760px] xl:min-h-[700px] lg:min-h-[620px] md:min-h-[560px] min-h-0">
                    {p.features.map((feature) => (
                      <li key={`${p.key}-${feature}`} className="flex items-start gap-2.5 text-sm text-slate-700 leading-6">
                        <span className="mt-0.5 w-4 h-4 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                        </span>
                        <span className="break-words">{feature}</span>
                      </li>
                    ))}
                    {Array.from({ length: Math.max(0, maxFeatureCount - p.features.length) }).map((_, idx) => (
                      <li key={`${p.key}-pad-${idx}`} className="h-6 opacity-0 select-none" aria-hidden="true">
                        Placeholder
                      </li>
                    ))}
                  </ul>

                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 min-h-[120px]">
                    <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1.5">Tour booking</div>
                    <p className="text-sm text-blue-900 leading-relaxed break-words">{p.tourBooking}</p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 mb-5 min-h-[64px]">
                    Additional minutes billed at $1.50 per 5-minute block. Included minutes roll over month to month.
                  </div>
                  <div className="mt-auto" />

                  <div className="space-y-2">
                  {isSubscribed ? (
                    <div className="w-full py-3 rounded-lg bg-green-100 text-green-700 text-base font-semibold text-center flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Subscribed
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || (cfg && cfg[p.key] === false)}
                      onClick={() => {
                        setSelectedPlan(p);
                        setPlanCouponCode('');
                        setPlanCouponPreview(null);
                        setMessage(`${p.name} selected. Complete checkout above the plans.`);
                        setTimeout(() => {
                          checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 0);
                      }}
                      className={`w-full py-3 rounded-lg text-base font-semibold hover:opacity-90 disabled:opacity-50 ${isMostPopular ? 'bg-blue-500 text-white' : 'bg-slate-900 text-white'}`}
                    >
                      {selectedPlan?.key === p.key ? 'Selected' : 'Choose plan'}
                    </button>
                  )}
                  {cfg && cfg[p.key] === false && (
                    <p className="text-[11px] text-amber-700 text-center">
                      Set <code className="bg-amber-50 px-0.5 rounded">{planEnvLabel[p.key]}</code> in server .env
                    </p>
                  )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
