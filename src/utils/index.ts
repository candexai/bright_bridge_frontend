const SCHOOL_TIMEZONE = 'America/Chicago';

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    timeZone: SCHOOL_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    timeZone: SCHOOL_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/** Date + time for call cards — "Today, 7:10 PM" or "Jun 14, 2026, 7:10 PM" */
export const formatCallTimestamp = (dateString: string): string => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';

  const dateKey = (d: Date) =>
    d.toLocaleDateString('en-US', {
      timeZone: SCHOOL_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

  const timePart = date.toLocaleTimeString('en-US', {
    timeZone: SCHOOL_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const callDay = dateKey(date);
  const todayDay = dateKey(new Date());

  if (callDay === todayDay) {
    return `Today, ${timePart}`;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (callDay === dateKey(yesterday)) {
    return `Yesterday, ${timePart}`;
  }

  const datePart = date.toLocaleDateString('en-US', {
    timeZone: SCHOOL_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${datePart}, ${timePart}`;
};

export const formatPhoneNumber = (phone: string): string => {
  // Simple phone number formatting
  return phone;
};

