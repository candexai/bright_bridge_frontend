import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import api from '../api/axios';

export const ReferralSignup = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!code) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    api.get(`/public/refer/${code}`)
      .then((res) => {
        setReferrerName(res.data.referrerSchoolName || '');
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await api.post(`/public/refer/${code}/register`, {
        schoolName: schoolName.trim(),
        email: email.trim(),
        password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Invalid referral link</h1>
          <p className="text-slate-500 text-sm mb-6">This link is invalid or has expired.</p>
          <button type="button" onClick={() => navigate('/login')} className="ui-button-primary">
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 mb-2">You’re all set</h1>
          <p className="text-slate-500 text-sm mb-6">
            Your school account has been created. Sign in with your email and password to access your dashboard.
          </p>
          <button type="button" onClick={() => navigate('/login')} className="ui-button-primary">
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-10 max-w-md w-full">
        <div className="mb-6 p-3 bg-primary-50 rounded-lg border border-primary-100">
          <p className="text-sm text-primary-800">
            You were referred by <strong>{referrerName}</strong>. Create your school account below.
          </p>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Register your school</h1>
        <p className="text-slate-500 text-sm mb-6">Sign up to get started with BrightBridge.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
              {submitError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">School name</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="ui-input"
              placeholder="e.g. Oak Childcare"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ui-input"
              placeholder="you@school.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ui-input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <button type="submit" disabled={submitting} className="ui-button-primary w-full gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('/login')} className="text-primary-600 hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
