import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  School, Settings, Users, Plug2, LayoutDashboard, Phone, Lightbulb, X, Bell, CreditCard, DollarSign, AlertTriangle
} from 'lucide-react';

interface SidebarProps {
  role: 'admin' | 'school';
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ role, isOpen, onClose }: SidebarProps) => {
  const { t } = useTranslation();

  const adminItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/admin/notifications', icon: AlertTriangle, labelKey: 'notifications' },
    { path: '/admin/schools', icon: School, labelKey: 'schools' },
    { path: '/admin/financials', icon: DollarSign, labelKey: 'financials' },
    { path: '/admin/phone-numbers', icon: Phone, labelKey: 'phone_numbers' },
    { path: '/admin/ai-number-requests', icon: Bell, labelKey: 'ai_number_requests' },
    { path: '/admin/referrals', icon: Users, labelKey: 'referrals' },
  ];

  const schoolItems = [
    { path: '/school/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/school/daily-insights', icon: Lightbulb, labelKey: 'daily_insights' },
    { path: '/school/integrations', icon: Plug2, labelKey: 'integrations' },
    { path: '/school/billing', icon: CreditCard, labelKey: 'billing' },
    { path: '/school/settings', icon: Settings, labelKey: 'settings' },
    { path: '/school/call-logs', icon: Phone, labelKey: 'call_logs' },
    { path: '/school/referrals', icon: Users, labelKey: 'referrals' },
  ];

  const items = role === 'admin' ? adminItems : schoolItems;

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 flex flex-col z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">BB</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none">{t('enrollment_ai')}</p>
              <p className="text-xs text-slate-400 capitalize mt-0.5">{role} portal</p>
            </div>
          </div>
          
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose?.()}
                  data-tour={
                    item.path === '/school/integrations'
                      ? 'nav-integrations'
                      : item.path === '/school/settings'
                        ? 'nav-settings'
                        : item.path === '/school/call-logs'
                          ? 'nav-call-logs'
                          : item.path === '/school/daily-insights'
                            ? 'nav-daily-insights'
                            : item.path === '/school/dashboard'
                              ? 'nav-dashboard'
                              : undefined
                  }
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      {t(item.labelKey)}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="px-5 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-slate-500 font-medium">{t('system_online')}</span>
          </div>
        </div>
      </div>
    </>
  );
};
