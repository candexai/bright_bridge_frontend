import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import { Loader2, CheckCircle, XCircle, RefreshCw, Zap, Calendar, AlertCircle, Mail } from 'lucide-react';
import type { Integration } from '../../types';

export const SchoolIntegrations = () => {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [preferredCalendar, setPreferredCalendar] = useState<'google' | 'outlook' | 'both' | 'none'>('none');
  const [preferredEmailProvider, setPreferredEmailProvider] = useState<'google' | 'outlook'>('google');
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [savingEmailProvider, setSavingEmailProvider] = useState(false);

  const fetchIntegrations = async () => {
    try {
      const res = await api.get('/school/integrations');
      setIntegrations(res.data);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/school/settings');
      setPreferredCalendar(res.data.preferredCalendar || 'none');
      setPreferredEmailProvider(res.data.preferredEmailProvider || 'google');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    fetchIntegrations();
    fetchSettings();
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      alert(`Successfully connected ${params.get('success')}!`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('error')) {
      const provider = params.get('error');
      const detail = params.get('detail');
      alert(
        detail
          ? `Failed to connect ${provider}: ${detail}`
          : `Failed to connect ${provider}. Check server logs or Admin → Notifications.`
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleToggle = async (type: string, currentlyConnected: boolean) => {
    setActionLoading(type);
    try {
      if (currentlyConnected) {
        await api.post(`/school/integrations/${type}/disconnect`);
        await fetchIntegrations();
      } else {
        const res = await api.post(`/school/integrations/${type}/connect`);
        if (res.data.authUrl) {
          window.location.href = res.data.authUrl;
        } else {
          await fetchIntegrations();
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to toggle integration.';
      alert(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const updatePreferredCalendar = async (value: string) => {
    setSavingCalendar(true);
    try {
      await api.put('/school/settings', { preferredCalendar: value });
      setPreferredCalendar(value as any);
    } catch (err) {
      console.error('Failed to update preferred calendar:', err);
      alert('Failed to update calendar selection.');
    } finally {
      setSavingCalendar(false);
    }
  };

  const updatePreferredEmailProvider = async (value: 'google' | 'outlook') => {
    setSavingEmailProvider(true);
    try {
      await api.put('/school/settings', { preferredEmailProvider: value });
      setPreferredEmailProvider(value);
    } catch (err) {
      console.error('Failed to update preferred email provider:', err);
      alert('Failed to update email provider selection.');
    } finally {
      setSavingEmailProvider(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-2">
      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Ecosystem...</span>
    </div>
  );

  const googleConnected = integrations.find(i => i.type === 'google')?.connected;
  const outlookConnected = integrations.find(i => i.type === 'outlook')?.connected;

  return (
    <div className="w-full animate-soft">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('integrations_title')}</h1>
          <p className="text-xs text-slate-500 mt-1">Sychronize your institutional workspace with the AI core.</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400 shrink-0">
          <Zap className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Active Sync</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {integrations.map((integration) => {
          const isGoogle = integration.type === 'google';
          return (
            <div key={integration.id} className="ui-card flex flex-col p-8 bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
              <div className="flex items-start justify-between mb-8">
                <div className="w-12 h-12 rounded-lg border border-slate-100 flex items-center justify-center bg-white shadow-sm shrink-0">
                  <img
                    src={isGoogle ? "https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" : "/outlook_logo.svg"}
                    alt={integration.type}
                    className="w-7 h-7 object-contain"
                  />
                </div>
                {integration.connected ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-100">
                    <CheckCircle className="w-3 h-3" />
                    CONNECTED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                    <XCircle className="w-3 h-3" />
                    DISCONNECTED
                  </span>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{isGoogle ? 'Google Workspace' : 'Microsoft Office 365'}</h3>
                {integration.connected && integration.email && (
                  <p className="text-[11px] font-bold text-blue-600 mt-1">{integration.email}</p>
                )}
                <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
                  {isGoogle
                    ? 'Sync Google Calendar and Gmail to enable automated tour scheduling and parent follow-ups.'
                    : 'Integrate Outlook Calendar and Mail to manage school visits and official communications.'}
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-end">
                <button
                  onClick={() => handleToggle(integration.type, integration.connected)}
                  disabled={actionLoading === integration.type}
                  className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-md text-[11px] font-bold transition-all uppercase tracking-widest ${integration.connected
                    ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                    }`}
                >
                  {actionLoading === integration.type ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : integration.connected ? (
                    <RefreshCw className="w-3.5 h-3.5" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  )}
                  {integration.connected ? 'Disconnect Sync' : 'Initialize Sync'}
                </button>
              </div>
            </div>
          );
        })}

        {integrations.length === 0 && (
          <div className="col-span-full py-20 text-center ui-card bg-slate-50 border-dashed border-slate-200">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">Access Restricted</p>
          </div>
        )}
      </div>

      <div className="mt-12 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Calendar Selection
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Choose which calendar(s) the AI should use for availability checks and bookings.
            </p>
          </div>
          {savingCalendar && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving Choice
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              id: 'google',
              label: 'Google Calendar',
              icon: (
                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                </div>
              ),
              desc: 'Use Google Workspace only.'
            },
            {
              id: 'outlook',
              label: 'Outlook Calendar',
              icon: (
                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 6.5L11 3V21L22 17.5V6.5Z" fill="#0078D4" />
                    <path d="M2 7.5L11 6V18L2 16.5V7.5Z" fill="#50E6FF" />
                    <path d="M6 10H8V14H6V10Z" fill="white" />
                  </svg>
                </div>
              ),
              desc: 'Use Microsoft Outlook only.'
            },
            {
              id: 'both',
              label: 'Sync Both',
              icon: (
                <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center font-bold text-[10px] tracking-tighter shadow-sm">
                  G+O
                </div>
              ),
              desc: 'Check and book to both.'
            },
            {
              id: 'none',
              label: 'No Sync',
              icon: (
                <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs shadow-sm">
                  X
                </div>
              ),
              desc: 'Disable external sync.'
            },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => updatePreferredCalendar(opt.id)}
              disabled={savingCalendar}
              className={`flex flex-col items-center text-center p-5 rounded-xl border-2 transition-all ${preferredCalendar === opt.id
                ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                : 'border-slate-100 hover:border-slate-300 bg-white'
                } ${savingCalendar ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="mb-3">{opt.icon}</div>
              <span className="text-xs font-bold text-slate-900 mb-1 uppercase tracking-tight">{opt.label}</span>
              <p className="text-[10px] text-slate-500 leading-tight font-medium">{opt.desc}</p>
              <div className={`mt-4 w-4 h-4 rounded-full border-2 flex items-center justify-center ${preferredCalendar === opt.id ? 'border-blue-600 bg-blue-600' : 'border-slate-200 bg-white'
                }`}>
                {preferredCalendar === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>

        {((preferredCalendar === 'google' && !googleConnected) ||
          (preferredCalendar === 'outlook' && !outlookConnected) ||
          (preferredCalendar === 'both' && (!googleConnected || !outlookConnected))) && (
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-3 animate-soft">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 font-medium">
                <p className="font-bold mb-1 uppercase tracking-widest text-[10px]">Connection Required</p>
                <p>You have selected {preferredCalendar === 'both' ? 'Google and Outlook' : (preferredCalendar === 'google' ? 'Google' : 'Outlook')} but they are not connected. Please connect your accounts above.</p>
              </div>
            </div>
          )}
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              Email Provider
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Choose which system the AI should use to send emails (calendar invites + follow-ups).
            </p>
          </div>
          {savingEmailProvider && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving Choice
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              id: 'google' as const,
              label: 'Google Workspace',
              desc: 'Use Gmail API for sending.',
              icon: (
                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                </div>
              )
            },
            {
              id: 'outlook' as const,
              label: 'Microsoft Office 365',
              desc: 'Use Outlook/Graph API for sending.',
              icon: (
                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 6.5L11 3V21L22 17.5V6.5Z" fill="#0078D4" />
                    <path d="M2 7.5L11 6V18L2 16.5V7.5Z" fill="#50E6FF" />
                    <path d="M6 10H8V14H6V10Z" fill="white" />
                  </svg>
                </div>
              )
            }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => updatePreferredEmailProvider(opt.id)}
              disabled={savingEmailProvider}
              className={`flex flex-col items-center text-center p-5 rounded-xl border-2 transition-all ${
                preferredEmailProvider === opt.id
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                  : 'border-slate-100 hover:border-slate-300 bg-white'
              } ${savingEmailProvider ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="mb-3">{opt.icon}</div>
              <span className="text-xs font-bold text-slate-900 mb-1 uppercase tracking-tight">{opt.label}</span>
              <p className="text-[10px] text-slate-500 leading-tight font-medium">{opt.desc}</p>
              <div className={`mt-4 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                preferredEmailProvider === opt.id ? 'border-blue-600 bg-blue-600' : 'border-slate-200 bg-white'
              }`}>
                {preferredEmailProvider === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>

        {((preferredEmailProvider === 'google' && !googleConnected) ||
          (preferredEmailProvider === 'outlook' && !outlookConnected)) && (
          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-3 animate-soft">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 font-medium">
              <p className="font-bold mb-1 uppercase tracking-widest text-[10px]">Connection Recommended</p>
              <p>
                You selected {preferredEmailProvider === 'google' ? 'Google Workspace' : 'Microsoft Office 365'} for email, but it is not connected.
                The system will use the other connected provider if available.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 p-6 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Protocol Information</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              By initializing a sync, you authorize BrightBridge to read/write to your calendar and send emails on behalf of the institutional assistant. Connection status is monitored periodically to ensure operational integrity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

