export type DayPeriod = 'morning' | 'afternoon' | 'evening';

export function getTimeOfDayGreeting(now: Date = new Date()): {
  salutation: 'Good Morning' | 'Good Afternoon' | 'Good Evening';
  period: DayPeriod;
} {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) {
    return { salutation: 'Good Morning', period: 'morning' };
  }
  if (hour >= 12 && hour < 17) {
    return { salutation: 'Good Afternoon', period: 'afternoon' };
  }
  return { salutation: 'Good Evening', period: 'evening' };
}

export function formatPortalGreeting(
  rawName?: string | null,
  portalType: 'admin' | 'doctor' | 'developer' = 'admin',
  now: Date = new Date()
): {
  salutation: 'Good Morning' | 'Good Afternoon' | 'Good Evening';
  displayName: string;
  fullGreeting: string;
  period: DayPeriod;
} {
  const { salutation, period } = getTimeOfDayGreeting(now);
  let clean = String(rawName || '').trim();

  // Remove parenthetical suffixes like "(Fenil Patel)" if preceded by a role title
  const parenMatch = clean.match(/\(([^)]+)\)/);
  if (parenMatch && clean.toLowerCase().includes('developer')) {
    clean = parenMatch[1].trim();
  }

  // Fallback if empty or email
  if (!clean) {
    clean =
      portalType === 'doctor'
        ? 'Doctor'
        : portalType === 'developer'
        ? 'Fenil Patel'
        : 'Staff Member';
  } else if (clean.includes('@')) {
    const localPart = clean.split('@')[0].replace(/[._-]+/g, ' ');
    clean = localPart.replace(/\b\w/g, (l) => l.toUpperCase());
  }

  if (portalType === 'doctor') {
    const hasDrPrefix = /^dr\.?\s+/i.test(clean);
    if (!hasDrPrefix && clean.toLowerCase() !== 'doctor') {
      clean = `Dr. ${clean}`;
    } else if (hasDrPrefix) {
      clean = clean.replace(/^dr\.?\s+/i, 'Dr. ');
    }
  }

  return {
    salutation,
    displayName: clean,
    fullGreeting: `${salutation}, ${clean}`,
    period,
  };
}
