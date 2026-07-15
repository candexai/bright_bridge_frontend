import api from '../api/axios';

const SETTINGS_SAVED_KEY = 'school-tour-settings-saved';

export function markSettingsSavedForTour(): void {
  try {
    sessionStorage.setItem(SETTINGS_SAVED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearSettingsSavedForTour(): void {
  try {
    sessionStorage.removeItem(SETTINGS_SAVED_KEY);
  } catch {
    /* ignore */
  }
}

export async function checkIntegrationsConnected(): Promise<boolean> {
  try {
    const res = await api.get('/school/integrations');
    const list = Array.isArray(res.data) ? res.data : [];
    return list.some((i: { connected?: boolean }) => Boolean(i.connected));
  } catch {
    return false;
  }
}

export async function checkSettingsReady(): Promise<boolean> {
  try {
    if (sessionStorage.getItem(SETTINGS_SAVED_KEY) === '1') {
      return true;
    }
    const res = await api.get('/school/settings');
    const data = res.data || {};
    const routing = String(data.routingNumber || '').trim();
    const transfer = String(data.humanTransferPhoneNumber || '').trim();
    const qaPairs = Array.isArray(data.qaPairs) ? data.qaPairs : [];
    const hasKb = qaPairs.some(
      (p: { question?: string; answer?: string }) =>
        String(p.question || '').trim().length > 0 && String(p.answer || '').trim().length > 0
    );
    return Boolean(routing || transfer || hasKb);
  } catch {
    return false;
  }
}

export type SoftGateKind = 'integrations' | 'settingsSaved';

export function startSoftGatePoll(
  kind: SoftGateKind,
  onReady: () => void,
  intervalMs = 2000
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const check = async () => {
    if (stopped) return;
    const ready =
      kind === 'integrations'
        ? await checkIntegrationsConnected()
        : await checkSettingsReady();
    if (ready && !stopped) {
      onReady();
    }
  };

  void check();
  timer = setInterval(() => {
    void check();
  }, intervalMs);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
