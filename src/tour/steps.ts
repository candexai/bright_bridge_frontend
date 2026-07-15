export type TourWaitFor = 'integrations' | 'settingsSaved';

export type TourPhase = 'Dashboard' | 'Integrations' | 'Settings' | 'Call Logs' | 'Daily Insights';

export interface TourStep {
  id: string;
  route: string;
  /** CSS selector for data-tour target; omit for centered welcome overlay */
  element?: string;
  title: string;
  description: string;
  waitFor?: TourWaitFor;
  showDoLater?: boolean;
  primaryLabel?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  phase?: TourPhase;
  /** Force Settings inner tab before highlighting */
  settingsTab?: 'agent' | 'automation';
}

export function getStepPhase(step: TourStep): TourPhase {
  if (step.phase) return step.phase;
  if (step.route.includes('/integrations')) return 'Integrations';
  if (step.route.includes('/settings')) return 'Settings';
  if (step.route.includes('/call-logs')) return 'Call Logs';
  if (step.route.includes('/daily-insights')) return 'Daily Insights';
  return 'Dashboard';
}

/** Local step index within the current phase (1-based) and phase length */
export function getPhaseProgress(index: number): { label: TourPhase; current: number; total: number } {
  const step = TOUR_STEPS[index];
  const label = getStepPhase(step);
  const phaseIndexes = TOUR_STEPS
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => getStepPhase(s) === label)
    .map(({ i }) => i);
  return {
    label,
    current: phaseIndexes.indexOf(index) + 1,
    total: phaseIndexes.length,
  };
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/school/dashboard',
    title: 'Welcome to your school portal',
    description:
      'Nora answers enrollment calls for your school. This quick tour shows the dashboard, how to connect your calendar, configure settings, review calls, and use Daily Insights.',
    primaryLabel: 'Start tour',
  },
  {
    id: 'dashboard-metrics',
    route: '/school/dashboard',
    element: '[data-tour="dashboard-metrics"]',
    title: 'Dashboard metrics',
    description:
      'These cards summarize call volume, items that need staff action, tours booked, and minutes used so you can see activity at a glance.',
    primaryLabel: 'Next',
  },
  {
    id: 'dashboard-calendar',
    route: '/school/dashboard',
    element: '[data-tour="dashboard-calendar"]',
    title: 'Tour calendar',
    description:
      'Campus tour bookings appear here. Click a day to see scheduled visits Nora booked for parents.',
    primaryLabel: 'Next',
  },
  {
    id: 'dashboard-recent-calls',
    route: '/school/dashboard',
    element: '[data-tour="dashboard-recent-calls"]',
    title: 'Recent calls',
    description:
      'Filter by New Parent (enrollment prospects), Current Family (already enrolled), or Unknown. Expand a row for the recording and AI summary.',
    primaryLabel: 'Next',
  },
  {
    id: 'nav-integrations',
    route: '/school/dashboard',
    element: '[data-tour="nav-integrations"]',
    title: 'Next: Integrations',
    description:
      'Connect Google or Outlook so Nora can check calendar availability and send tour emails. Click Continue to open Integrations.',
    primaryLabel: 'Continue',
    side: 'right',
  },
  {
    id: 'integrations-providers',
    route: '/school/integrations',
    element: '[data-tour="integrations-providers"]',
    title: 'Connect Google or Outlook',
    description:
      'Pick Google Workspace or Microsoft 365. Connecting one enables calendar booking and parent follow-up email.',
    primaryLabel: 'Next',
  },
  {
    id: 'integrations-connect',
    route: '/school/integrations',
    element: '[data-tour="integrations-providers"]',
    title: 'Connect an account',
    description:
      'Click Initialize Sync on Google or Outlook. When a connection succeeds, Continue unlocks. You can also skip and do this later.',
    waitFor: 'integrations',
    showDoLater: true,
    primaryLabel: 'Continue',
  },
  {
    id: 'integrations-prefs',
    route: '/school/integrations',
    element: '[data-tour="integrations-prefs"]',
    title: 'Calendar & email preferences',
    description:
      'Choose which calendar Nora uses for availability and which email provider sends invites and follow-ups.',
    primaryLabel: 'Next',
  },
  {
    id: 'nav-settings',
    route: '/school/integrations',
    element: '[data-tour="nav-settings"]',
    title: 'Next: Settings',
    description:
      'Configure school details, routing numbers, transfer, and Nora’s knowledge base. Continue to open Settings.',
    primaryLabel: 'Continue',
    side: 'right',
  },
  {
    id: 'settings-identity',
    route: '/school/settings',
    element: '[data-tour="settings-identity"]',
    title: 'School identity & routing',
    description:
      'Set your school name, address, timezone, and front-desk routing number. Non-inquiry calls forward here.',
    primaryLabel: 'Next',
    settingsTab: 'agent',
  },
  {
    id: 'settings-transfer',
    route: '/school/settings',
    element: '[data-tour="settings-transfer"]',
    title: 'Human transfer',
    description:
      'Optionally transfer callers to a staff phone when Nora cannot help. Enable Human Transfer and set the transfer number.',
    primaryLabel: 'Next',
    settingsTab: 'agent',
  },
  {
    id: 'settings-kb',
    route: '/school/settings',
    element: '[data-tour="settings-kb"]',
    title: 'Knowledge base',
    description:
      'Add Q&A pairs Nora uses on calls — tuition, hours, age groups, and more. Scroll the list, edit anytime, then continue when you’re ready. You can save from Settings whenever you like.',
    primaryLabel: 'Continue',
    settingsTab: 'agent',
  },
  {
    id: 'settings-automation',
    route: '/school/settings',
    element: '[data-tour="settings-automation"]',
    title: 'Automated follow-ups',
    description:
      'After an enrollment call, Nora can email the parent a follow-up with your inquiry form link. Turn on “Send Email follow-up after call” when you’re ready to automate.',
    primaryLabel: 'Next',
    settingsTab: 'automation',
  },
  {
    id: 'settings-admin-email',
    route: '/school/settings',
    element: '[data-tour="settings-admin-email"]',
    title: 'Admin notification email',
    description:
      'Enter the school inbox that should receive Nora’s staff alerts — call summaries, hot-lead notices, and tour booking notifications — so your team can follow up quickly.',
    primaryLabel: 'Continue',
    settingsTab: 'automation',
  },
  {
    id: 'nav-call-logs',
    route: '/school/settings',
    element: '[data-tour="nav-call-logs"]',
    title: 'Next: Call Logs',
    description: 'Review full call history, recordings, and transcripts. Continue to open Call Logs.',
    primaryLabel: 'Continue',
    side: 'right',
  },
  {
    id: 'call-logs-filters',
    route: '/school/call-logs',
    element: '[data-tour="call-logs-filters"]',
    title: 'Call filters',
    description:
      'Filter by date range and parent segment — New Parent, Current Family, or Unknown — to focus the list.',
    primaryLabel: 'Next',
  },
  {
    id: 'call-logs-list',
    route: '/school/call-logs',
    element: '[data-tour="call-logs-list"]',
    title: 'Call history',
    description:
      'When calls arrive, expand a row to play the recording, read the AI summary, and review the full transcript. Empty for now is normal for a new school.',
    primaryLabel: 'Next',
  },
  {
    id: 'nav-daily-insights',
    route: '/school/call-logs',
    element: '[data-tour="nav-daily-insights"]',
    title: 'Next: Daily Insights',
    description:
      'Your daily action hub — hot leads, today’s tours, and what needs follow-up. Continue to open Daily Insights.',
    primaryLabel: 'Continue',
    side: 'right',
  },
  {
    id: 'insights-metrics',
    route: '/school/daily-insights',
    element: '[data-tour="insights-metrics"]',
    title: 'Today’s pulse',
    description:
      'Calls Today is volume since midnight. Hot Leads are high-intent follow-ups. Action Needed is the New Parent queue. Tours Today is scheduled campus visits. Peak Call Time shows when parents call most.',
    primaryLabel: 'Next',
  },
  {
    id: 'insights-segments',
    route: '/school/daily-insights',
    element: '[data-tour="insights-segments"]',
    title: 'Parent segments',
    description:
      'New Parent = enrollment prospects. Current Family = already enrolled (usually front-desk). Unknown = unclear engagement. Use Hot Leads to focus on the highest-intent parents.',
    primaryLabel: 'Next',
  },
  {
    id: 'insights-queue',
    route: '/school/daily-insights',
    element: '[data-tour="insights-queue"]',
    title: 'Inquiries needing attention',
    description:
      'This queue lists parents who need a staff follow-up. Review each card, leave feedback, or mark action taken.',
    primaryLabel: 'Next',
  },
  {
    id: 'insights-tours',
    route: '/school/daily-insights',
    element: '[data-tour="insights-tours"]',
    title: 'Today’s tours & tour card',
    description:
      'When a campus tour is scheduled today, it appears here. Use Print Tour Card for a one-pager with talking points for your staff — that’s your tour report.',
    primaryLabel: 'Finish',
  },
];

export function getStepIndex(stepId: string | null | undefined): number {
  if (!stepId) return 0;
  // Removed soft-gate step — map old progress to Knowledge Base
  const normalized = stepId === 'settings-save' ? 'settings-kb' : stepId;
  const idx = TOUR_STEPS.findIndex((s) => s.id === normalized);
  return idx >= 0 ? idx : 0;
}
