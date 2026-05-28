import { useEffect, useState } from 'react';
import { Loader2, DollarSign } from 'lucide-react';
import api from '../../api/axios';

interface Summary {
  period: string;
  revenueUsd: number;
  byType: Record<string, { totalUsd: number; count: number }>;
  schools: Array<{
    id: string;
    name: string;
    subscriptionPlanKey: string;
    subscriptionStatus: string;
    billingMode: string;
    minuteBalance: number | null;
    foundingPartner: boolean;
    onboardingFeePaid: boolean;
    paypalSubscriptionId: string;
    lastBillingCyclePaymentAt: string | null;
  }>;
}

interface TxRow {
  id: string;
  schoolName: string | null;
  type: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
}

interface CouponRow {
  id: string;
  code: string;
  name: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  appliesTo: string[];
  minAmountUsd: number;
  maxTotalUses: number | null;
  maxUsesPerSchool: number | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  totalUses: number;
  totalDiscountUsd: number;
}

interface CouponRedemptionRow {
  id: string;
  couponCode: string;
  schoolName: string | null;
  orderType: string;
  originalAmountUsd: number;
  discountAmountUsd: number;
  finalAmountUsd: number;
  createdAt: string;
}

export const AdminFinancials = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tx, setTx] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [couponRedemptions, setCouponRedemptions] = useState<CouponRedemptionRow[]>([]);
  const [couponRedemptionTotal, setCouponRedemptionTotal] = useState(0);
  const [couponRedemptionPage, setCouponRedemptionPage] = useState(0);
  const couponRedemptionPageSize = 20;
  const [couponForm, setCouponForm] = useState({
    code: '',
    name: '',
    discountType: 'percent',
    discountValue: 10,
    appliesToTopup: true,
    appliesToSubscription: true,
    minAmountUsd: 0,
    maxTotalUses: '',
    maxUsesPerSchool: 1,
    validFrom: '',
    validUntil: '',
  });
  const [couponBusy, setCouponBusy] = useState(false);

  const loadCouponRedemptions = async (page: number) => {
    const skip = page * couponRedemptionPageSize;
    const rRes = await api.get(`/admin/coupons/redemptions?limit=${couponRedemptionPageSize}&skip=${skip}`);
    setCouponRedemptions(rRes.data?.items || []);
    setCouponRedemptionTotal(rRes.data?.total || 0);
    setCouponRedemptionPage(page);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const q = month ? `?month=${encodeURIComponent(month)}` : '';
        const [sRes, tRes] = await Promise.all([
          api.get(`/admin/billing/summary${q}`),
          api.get('/admin/billing/transactions?limit=100'),
        ]);
        setSummary(sRes.data);
        setTx(tRes.data.items || []);
        const [cRes] = await Promise.all([
          api.get('/admin/coupons'),
        ]);
        setCoupons(cRes.data || []);
        await loadCouponRedemptions(0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [month]);

  const createCoupon = async () => {
    const code = couponForm.code.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    try {
      await api.post('/admin/coupons', {
        code,
        name: couponForm.name.trim(),
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        appliesTo: [
          couponForm.appliesToTopup ? 'topup' : null,
          couponForm.appliesToSubscription ? 'subscription' : null,
        ].filter(Boolean),
        minAmountUsd: Number(couponForm.minAmountUsd || 0),
        maxTotalUses: couponForm.maxTotalUses === '' ? null : Number(couponForm.maxTotalUses),
        maxUsesPerSchool: Number(couponForm.maxUsesPerSchool || 1),
        validFrom: couponForm.validFrom || null,
        validUntil: couponForm.validUntil || null,
      });
      setCouponForm({
        code: '',
        name: '',
        discountType: 'percent',
        discountValue: 10,
        appliesToTopup: true,
        appliesToSubscription: true,
        minAmountUsd: 0,
        maxTotalUses: '',
        maxUsesPerSchool: 1,
        validFrom: '',
        validUntil: '',
      });
      const [cRes] = await Promise.all([
        api.get('/admin/coupons'),
      ]);
      setCoupons(cRes.data || []);
      await loadCouponRedemptions(0);
    } catch (e) {
      console.error(e);
    } finally {
      setCouponBusy(false);
    }
  };

  const toggleCoupon = async (id: string) => {
    setCouponBusy(true);
    try {
      await api.post(`/admin/coupons/${id}/toggle`);
      const cRes = await api.get('/admin/coupons');
      setCoupons(cRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setCouponBusy(false);
    }
  };

  const deleteCoupon = async (id: string) => {
    setCouponBusy(true);
    try {
      await api.delete(`/admin/coupons/${id}`);
      const cRes = await api.get('/admin/coupons');
      setCoupons(cRes.data || []);
      await loadCouponRedemptions(0);
    } catch (e) {
      console.error(e);
    } finally {
      setCouponBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Financials
          </h1>
          <p className="text-sm text-slate-500 mt-1">Subscription payments, onboarding, top-ups, and per-school usage balances.</p>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Filter by month</label>
          <input
            type="month"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recorded revenue (period)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            ${(summary?.revenueUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        {['subscription_payment', 'topup', 'onboarding'].map((k) => (
          <div key={k} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{k.replace(/_/g, ' ')}</div>
            <div className="text-xl font-semibold text-slate-900 mt-1">
              ${(summary?.byType?.[k]?.totalUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">{summary?.byType?.[k]?.count ?? 0} tx</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Schools</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Minutes</th>
                <th className="px-4 py-3 font-medium">Founding</th>
                <th className="px-4 py-3 font-medium">Onboarding paid</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.schools || []).map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.subscriptionPlanKey || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{s.subscriptionStatus}</td>
                  <td className="px-4 py-3 tabular-nums">{typeof s.minuteBalance === 'number' ? s.minuteBalance : '—'}</td>
                  <td className="px-4 py-3">{s.foundingPartner ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{s.onboardingFeePaid ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{t.schoolName || '—'}</td>
                  <td className="px-4 py-3">{t.type}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {t.amount.toFixed(2)} {t.currency}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Coupons</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
            <input
              placeholder="e.g. SUMMER20"
              value={couponForm.code}
              onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">This is what school users type in billing.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Coupon name</label>
            <input
              placeholder="Internal name for admin"
              value={couponForm.name}
              onChange={(e) => setCouponForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">For your team reference (optional).</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Discount type</label>
            <select
              value={couponForm.discountType}
              onChange={(e) => setCouponForm((p) => ({ ...p, discountType: e.target.value as 'percent' | 'fixed' }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed USD</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Percent = % off, Fixed USD = dollar amount off.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Discount value</label>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 20 or 10"
              value={couponForm.discountValue}
              onChange={(e) => setCouponForm((p) => ({ ...p, discountValue: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">If type is Percent, 20 means 20%. If Fixed USD, 20 means $20.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Min amount (USD)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0"
              value={couponForm.minAmountUsd}
              onChange={(e) => setCouponForm((p) => ({ ...p, minAmountUsd: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">Coupon works only if payment is at least this amount.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max uses per school</label>
            <input
              type="number"
              min={1}
              step="1"
              placeholder="1"
              value={couponForm.maxUsesPerSchool}
              onChange={(e) => setCouponForm((p) => ({ ...p, maxUsesPerSchool: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">How many times a single school can use this coupon.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max total uses</label>
            <input
              type="number"
              min={1}
              step="1"
              placeholder="Blank = unlimited"
              value={couponForm.maxTotalUses}
              onChange={(e) => setCouponForm((p) => ({ ...p, maxTotalUses: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">Total redemptions across all schools.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Valid from</label>
            <input
              type="date"
              value={couponForm.validFrom}
              onChange={(e) => setCouponForm((p) => ({ ...p, validFrom: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">Coupon starts working on/after this date.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Valid until</label>
            <input
              type="date"
              value={couponForm.validUntil}
              onChange={(e) => setCouponForm((p) => ({ ...p, validUntil: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">Coupon expires after this date.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={couponForm.appliesToTopup}
              onChange={(e) => setCouponForm((p) => ({ ...p, appliesToTopup: e.target.checked }))}
            />
            Applies to top-up
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={couponForm.appliesToSubscription}
              onChange={(e) => setCouponForm((p) => ({ ...p, appliesToSubscription: e.target.checked }))}
            />
            Applies to subscription plans
          </label>
          <button type="button" className="ui-button-primary" disabled={couponBusy} onClick={createCoupon}>
            {couponBusy ? 'Saving...' : 'Create coupon'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Coupon list</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Applies to</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.discountType === 'percent' ? `${c.discountValue}%` : `$${c.discountValue.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{(c.appliesTo || []).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.totalUses} use(s), ${c.totalDiscountUsd.toFixed(2)} discounted
                  </td>
                  <td className="px-4 py-3">{c.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" className="ui-button-secondary" disabled={couponBusy} onClick={() => toggleCoupon(c.id)}>
                        {c.active ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="ui-button-secondary" disabled={couponBusy} onClick={() => deleteCoupon(c.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Coupon redemptions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Coupon</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Original</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Final</th>
              </tr>
            </thead>
            <tbody>
              {couponRedemptions.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{r.couponCode}</td>
                  <td className="px-4 py-3">{r.schoolName || '—'}</td>
                  <td className="px-4 py-3">{r.orderType}</td>
                  <td className="px-4 py-3 tabular-nums">${r.originalAmountUsd.toFixed(2)}</td>
                  <td className="px-4 py-3 tabular-nums text-emerald-700">-${r.discountAmountUsd.toFixed(2)}</td>
                  <td className="px-4 py-3 tabular-nums">${r.finalAmountUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {couponRedemptions.length ? couponRedemptionPage * couponRedemptionPageSize + 1 : 0}
            -
            {couponRedemptionPage * couponRedemptionPageSize + couponRedemptions.length}
            {' '}of {couponRedemptionTotal}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ui-button-secondary"
              disabled={couponBusy || couponRedemptionPage === 0}
              onClick={() => loadCouponRedemptions(Math.max(0, couponRedemptionPage - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="ui-button-secondary"
              disabled={couponBusy || (couponRedemptionPage + 1) * couponRedemptionPageSize >= couponRedemptionTotal}
              onClick={() => loadCouponRedemptions(couponRedemptionPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
