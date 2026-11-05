export type BookingStatusUpper =
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'RESCHEDULED'
  | 'EXPIRED';

export type SlotDurationMinutes = 15 | 30 | 45 | 60;

export interface WeeklyDaySchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayName?: string;
  enabled: boolean;
  startTime: string; // "09:00 AM" or "09:00"
  endTime: string;   // "05:00 PM" or "17:00"
  slotDuration: SlotDurationMinutes;
  slots: string[];   // e.g. ["09:00 AM", "09:30 AM", ...]
}

export interface DateSpecificAvailability {
  id?: string;
  date: string; // "YYYY-MM-DD"
  isAvailable?: boolean; // true = open with these slots; false = blocked date
  enabled?: boolean;     // alias for isAvailable
  startTime: string;
  endTime: string;
  slotDuration: SlotDurationMinutes;
  slots: string[]; // explicit time slots for this date, e.g. ["10:00 AM", "10:30 AM"]
  note?: string;
  updatedAt?: string;
}

export interface DoctorAvailabilityRecord {
  doctorId: string;
  doctorName: string;
  defaultDuration: SlotDurationMinutes;
  recurringWeekly?: WeeklyDaySchedule[];
  weeklySchedule?: WeeklyDaySchedule[];
  specificDates: DateSpecificAvailability[] | Record<string, DateSpecificAvailability>;
  updatedAt: string;
}

export interface TemporarySlotReservation {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "10:00 AM"
  sessionId: string;
  patientName?: string;
  patientEmail?: string;
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms (createdAt + 5 * 60 * 1000)
  expiresAtMs: number; // alias for expiresAt
  status: 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'RELEASED';
}

export interface ComputedTimeSlot {
  time: string; // "10:00 AM"
  durationMinutes: SlotDurationMinutes;
  available: boolean;
  status: 'available' | 'booked' | 'reserved_other' | 'reserved_self';
  reason?: 'AVAILABLE' | 'BOOKED' | 'PENDING_APPROVAL' | 'TEMPORARILY_RESERVED' | 'HELD_BY_YOU';
  reservationId?: string;
  expiresAt?: number;
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Converts 24h time string ("09:00" or "14:30") or minutes to 12h display ("09:00 AM" or "02:30 PM")
 */
export function format24hTo12h(time24: string): string {
  const clean = String(time24 || '09:00').trim();
  if (/AM|PM/i.test(clean)) {
    const mins = parseTimeToMinutes(clean);
    return minutesTo12h(mins);
  }
  const parts = clean.split(':');
  const rawH = parseInt(parts[0] || '9', 10);
  const rawM = parseInt(parts[1] || '0', 10);
  const period = rawH >= 12 ? 'PM' : 'AM';
  const h12 = rawH % 12 === 0 ? 12 : rawH % 12;
  return `${String(h12).padStart(2, '0')}:${String(rawM).padStart(2, '0')} ${period}`;
}

export function minutesTo12h(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const rawH = Math.floor(clamped / 60);
  const rawM = clamped % 60;
  const period = rawH >= 12 ? 'PM' : 'AM';
  const h12 = rawH % 12 === 0 ? 12 : rawH % 12;
  return `${String(h12).padStart(2, '0')}:${String(rawM).padStart(2, '0')} ${period}`;
}

/**
 * Converts 12h ("10:30 AM") or 24h ("10:30") to minutes since midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const clean = String(timeStr || '').trim();
  const match12 = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(clean);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2] || '0', 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const match24 = /^(\d{1,2}):(\d{2})$/.exec(clean);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  return 9 * 60;
}

export const parseTime12hToMinutes = parseTimeToMinutes;

/**
 * Generates an array of 12-hour formatted time slots ("09:00 AM", "09:30 AM", ...)
 * between startTime ("09:00" or "09:00 AM") and endTime ("17:00" or "05:00 PM") with given duration in minutes.
 */
export function generateTimeSlotsFromWindow(
  startTime: string,
  endTime: string,
  durationMinutes: SlotDurationMinutes = 30
): string[] {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  const step = durationMinutes > 0 ? durationMinutes : 30;
  const slots: string[] = [];

  for (let t = startMins; t + step <= endMins; t += step) {
    slots.push(minutesTo12h(t));
  }
  return slots;
}

/**
 * Sorts an array of 12-hour time strings chronologically
 */
export function sortTimeSlotsChronologically(slots: string[]): string[] {
  return [...Array.from(new Set(slots))].sort(
    (a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)
  );
}

/**
 * Returns the day of week (0-6) for a YYYY-MM-DD date string in local calendar terms
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return 1;
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

export type ConfiguredSlotsResult = string[] & {
  slots: string[];
  durationMinutes: SlotDurationMinutes;
  source: 'specific' | 'recurring' | 'none';
};

function attachSlotMetadata(
  slots: string[],
  durationMinutes: SlotDurationMinutes,
  source: 'specific' | 'recurring' | 'none'
): ConfiguredSlotsResult {
  const copy = [...slots] as ConfiguredSlotsResult;
  copy.slots = slots;
  copy.durationMinutes = durationMinutes;
  copy.source = source;
  return copy;
}

/**
 * Resolves the raw configured slots and duration for a doctor on a given date ("YYYY-MM-DD")
 * Works both as a `string[]` (for `.length`, `.filter`, `.map`) AND as `{ slots, durationMinutes, source }`.
 */
export function getConfiguredDoctorSlotsForDate(
  availability: DoctorAvailabilityRecord | undefined | null,
  dateStr: string
): ConfiguredSlotsResult {
  if (!availability || !dateStr) {
    return attachSlotMetadata([], 30, 'none');
  }

  const defaultDur: SlotDurationMinutes = availability.defaultDuration || 30;

  // 1. Check specific date override first (supports both Array and Record<string, DateSpecificAvailability>)
  let specific: DateSpecificAvailability | undefined;
  if (Array.isArray(availability.specificDates)) {
    specific = availability.specificDates.find((d) => d && d.date === dateStr);
  } else if (availability.specificDates && typeof availability.specificDates === 'object') {
    specific = availability.specificDates[dateStr];
  }

  if (specific) {
    const isAvail =
      specific.isAvailable !== undefined
        ? specific.isAvailable
        : specific.enabled !== undefined
        ? specific.enabled
        : true;
    const dur = specific.slotDuration || defaultDur;
    if (!isAvail) {
      return attachSlotMetadata([], dur, 'specific');
    }
    const sorted = sortTimeSlotsChronologically(specific.slots || []);
    return attachSlotMetadata(sorted, dur, 'specific');
  }

  // 2. Check recurring weekly schedule (supports both recurringWeekly and weeklySchedule)
  const weeklyList =
    Array.isArray(availability.recurringWeekly) && availability.recurringWeekly.length > 0
      ? availability.recurringWeekly
      : Array.isArray(availability.weeklySchedule)
      ? availability.weeklySchedule
      : [];

  const dow = getDayOfWeekFromDateString(dateStr);
  const weekly = weeklyList.find((w) => w.dayOfWeek === dow);
  if (weekly && weekly.enabled) {
    const dur = weekly.slotDuration || defaultDur;
    const rawSlots = Array.isArray(weekly.slots) ? weekly.slots : [];
    return attachSlotMetadata(sortTimeSlotsChronologically(rawSlots), dur, 'recurring');
  }

  return attachSlotMetadata([], defaultDur, 'none');
}
