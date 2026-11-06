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
  serviceId?: string;
  updatedAt?: string;
}

export interface ServiceScheduleConfig {
  serviceId: string;
  serviceTitle?: string;
  defaultDuration: SlotDurationMinutes;
  recurringWeekly?: WeeklyDaySchedule[];
  weeklySchedule?: WeeklyDaySchedule[];
  specificDates: DateSpecificAvailability[] | Record<string, DateSpecificAvailability>;
  updatedAt?: string;
}

export interface DoctorAvailabilityRecord {
  doctorId: string;
  doctorName: string;
  defaultDuration: SlotDurationMinutes;
  recurringWeekly?: WeeklyDaySchedule[];
  weeklySchedule?: WeeklyDaySchedule[];
  specificDates: DateSpecificAvailability[] | Record<string, DateSpecificAvailability>;
  serviceAvailabilities?: Record<string, ServiceScheduleConfig>;
  updatedAt: string;
}

export interface BookingServiceItem {
  id: string;
  title: string;
  category: string;
  durationMinutes: SlotDurationMinutes;
  description?: string;
  allowedDoctorIds?: string[]; // empty or ['all'] means all active doctors offer this service
  isActive?: boolean;
  updatedAt?: string;
}

export const DEFAULT_BOOKING_SERVICES: BookingServiceItem[] = [
  {
    id: 'new-patient-exam-all-ages',
    title: 'New Patient Exam- All ages',
    category: 'New Patient Exam',
    durationMinutes: 45,
    description: 'Comprehensive dental examination and digital diagnostic evaluation for all ages.',
    allowedDoctorIds: [],
    isActive: true,
  },
  {
    id: 'emergency-appointment-all-ages',
    title: 'Emergency Appointment- All ages',
    category: 'Emergency Care',
    durationMinutes: 30,
    description: 'Priority same-day assessment and pain relief for acute dental emergencies.',
    allowedDoctorIds: [],
    isActive: true,
  },
  {
    id: 'new-patient-cleaning-adult-14',
    title: 'New Patient + Cleaning (Adult)- Age 14+',
    category: 'Adult Exam & Cleaning',
    durationMinutes: 60,
    description: 'Complete new patient examination paired with professional adult dental hygiene cleaning.',
    allowedDoctorIds: [],
    isActive: true,
  },
  {
    id: 'new-patient-cleaning-child-teen',
    title: 'New Patient Exam + Cleaning (Child-Teen)- Age 6 to13',
    category: 'Child & Teen Care',
    durationMinutes: 45,
    description: 'Gentle pediatric and teen dental check-up with preventive cleaning and fluoride care.',
    allowedDoctorIds: [],
    isActive: true,
  },
  {
    id: 'free-consultation-invisalign',
    title: 'Free Consultation- Invisalign',
    category: 'Free Consultation',
    durationMinutes: 30,
    description: 'Complimentary clear aligner smile assessment and orthodontic treatment roadmap.',
    allowedDoctorIds: [],
    isActive: true,
  },
  {
    id: 'new-patient-promo-149',
    title: 'New Patient Promo-$149 (New Patient Exam, X-ray, Cleaning)',
    category: 'Promotional Package',
    durationMinutes: 60,
    description: 'All-inclusive $149 new patient package with full exam, digital X-rays, and professional cleaning.',
    allowedDoctorIds: [],
    isActive: true,
  },
  {
    id: 'kids-exam-free-with-parent',
    title: 'Kids Exam Free With Parent Visit',
    category: 'Family Offer',
    durationMinutes: 30,
    description: 'Complimentary children’s dental check-up when scheduled alongside a parent’s dental visit.',
    allowedDoctorIds: [],
    isActive: true,
  },
  {
    id: 'new-patient-special-49-95',
    title: 'New Patient SPECIAL ($49.95)- Full check-up exam and X-rays',
    category: 'Special Offer',
    durationMinutes: 45,
    description: 'Special $49.95 introductory offer including a complete clinical check-up exam and necessary X-rays.',
    allowedDoctorIds: [],
    isActive: true,
  },
  {
    id: 'new-patient-adult-free-toothbrush',
    title: 'New Patient Exam + Cleaning(Adult)- Get Free Electric Toothbrush',
    category: 'Promotional Package',
    durationMinutes: 60,
    description: 'Adult new patient exam and hygiene cleaning package with a complimentary electric toothbrush.',
    allowedDoctorIds: [],
    isActive: true,
  },
];

export function normalizeServiceKey(serviceIdOrTitle?: string): string {
  const raw = String(serviceIdOrTitle || '').trim();
  if (!raw || raw.toLowerCase() === 'all' || raw.toLowerCase() === 'default') return 'all';

  // Check if it matches one of the default services by id or title
  const lower = raw.toLowerCase();
  const matched = DEFAULT_BOOKING_SERVICES.find(
    (s) => s.id.toLowerCase() === lower || s.title.toLowerCase() === lower
  );
  if (matched) return matched.id;

  return (
    lower
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'all'
  );
}

export interface TemporarySlotReservation {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "10:00 AM"
  service?: string;
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

/**
 * Generates a deterministic, distinct per-service weekly schedule for a given service key and doctor ID
 * so that different services (e.g. Emergency, Invisalign Consultation, Adult Cleaning, Teeth Whitening, Free Check-up)
 * have distinct, realistic availability windows and slot durations.
 */
export function buildDefaultServiceScheduleForDoctor(
  serviceIdOrTitle: string,
  doctorId = 'doc-1'
): ServiceScheduleConfig {
  const serviceKey = normalizeServiceKey(serviceIdOrTitle);
  const matchedDefault = DEFAULT_BOOKING_SERVICES.find((s) => s.id === serviceKey);
  const duration: SlotDurationMinutes = matchedDefault?.durationMinutes || 30;

  // Deterministic hash from serviceKey + doctorId so each service & doctor combination has a distinct schedule
  let hash = 0;
  const seedStr = `${serviceKey}:${doctorId}`;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }

  // Preset clinical schedule templates per service type
  const presets: Array<{
    days: number[];
    startTime: string;
    endTime: string;
    dur: SlotDurationMinutes;
    customSlots?: Record<number, string[]>;
  }> = [
    // Template 0: Mon, Wed, Fri Morning + Early Afternoon (New Patient Exam)
    {
      days: [1, 3, 5],
      startTime: '09:00 AM',
      endTime: '02:30 PM',
      dur: duration,
      customSlots: {
        1: ['09:00 AM', '09:45 AM', '10:30 AM', '11:15 AM', '01:00 PM', '01:45 PM'],
        3: ['09:30 AM', '10:15 AM', '11:00 AM', '01:30 PM', '02:15 PM'],
        5: ['09:00 AM', '10:30 AM', '11:15 AM', '01:00 PM'],
      },
    },
    // Template 1: Mon-Sat Urgent Priority Slots (Emergency Appointment)
    {
      days: [1, 2, 3, 4, 5, 6],
      startTime: '09:00 AM',
      endTime: '05:00 PM',
      dur: 30,
      customSlots: {
        1: ['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM'],
        2: ['09:30 AM', '12:00 PM', '02:30 PM', '04:00 PM'],
        3: ['09:00 AM', '11:00 AM', '01:30 PM', '04:30 PM'],
        4: ['10:00 AM', '12:30 PM', '03:00 PM', '05:00 PM'],
        5: ['09:00 AM', '11:30 AM', '02:00 PM', '04:00 PM'],
        6: ['09:30 AM', '11:00 AM', '01:30 PM'],
      },
    },
    // Template 2: Tue, Thu, Sat Adult Hygiene & Exam Windows (60m)
    {
      days: [2, 4, 6],
      startTime: '09:00 AM',
      endTime: '04:00 PM',
      dur: 60,
      customSlots: {
        2: ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM'],
        4: ['09:30 AM', '10:30 AM', '01:30 PM', '02:30 PM', '03:30 PM'],
        6: ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM'],
      },
    },
    // Template 3: Mon, Tue, Thu After-School & Pediatric Windows (Child/Teen)
    {
      days: [1, 2, 4],
      startTime: '10:00 AM',
      endTime: '05:30 PM',
      dur: 45,
      customSlots: {
        1: ['10:00 AM', '11:30 AM', '02:30 PM', '03:15 PM', '04:00 PM', '04:45 PM'],
        2: ['02:00 PM', '02:45 PM', '03:30 PM', '04:15 PM', '05:00 PM'],
        4: ['10:30 AM', '02:30 PM', '03:15 PM', '04:00 PM', '04:45 PM'],
      },
    },
    // Template 4: Wed, Thu, Fri Invisalign & Cosmetic Consultation Blocks (30m)
    {
      days: [3, 4, 5],
      startTime: '10:00 AM',
      endTime: '04:30 PM',
      dur: 30,
      customSlots: {
        3: ['10:00 AM', '10:30 AM', '11:00 AM', '02:00 PM', '02:30 PM', '03:00 PM'],
        4: ['11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM', '04:00 PM'],
        5: ['10:00 AM', '10:30 AM', '01:30 PM', '02:00 PM', '03:30 PM'],
      },
    },
    // Template 5: Mon, Wed, Sat Promo Package ($149 Exam, X-ray, Cleaning)
    {
      days: [1, 3, 6],
      startTime: '09:00 AM',
      endTime: '03:30 PM',
      dur: 60,
      customSlots: {
        1: ['09:00 AM', '10:00 AM', '01:00 PM', '02:00 PM'],
        3: ['10:00 AM', '11:00 AM', '01:30 PM', '02:30 PM'],
        6: ['09:30 AM', '10:30 AM', '12:30 PM', '01:30 PM'],
      },
    },
    // Template 6: Tue, Fri, Sat Family & Kids Free Exam Visit
    {
      days: [2, 5, 6],
      startTime: '09:30 AM',
      endTime: '04:30 PM',
      dur: 30,
      customSlots: {
        2: ['09:30 AM', '10:30 AM', '03:00 PM', '03:30 PM', '04:00 PM'],
        5: ['10:00 AM', '11:00 AM', '02:30 PM', '03:00 PM', '03:30 PM'],
        6: ['10:00 AM', '10:30 AM', '11:00 AM', '02:00 PM', '02:30 PM'],
      },
    },
    // Template 7: Mon, Thu, Fri Special ($49.95 Check-up & X-rays)
    {
      days: [1, 4, 5],
      startTime: '09:00 AM',
      endTime: '04:00 PM',
      dur: 45,
      customSlots: {
        1: ['09:15 AM', '10:45 AM', '01:15 PM', '02:45 PM'],
        4: ['09:00 AM', '09:45 AM', '11:15 AM', '02:00 PM', '03:30 PM'],
        5: ['09:30 AM', '11:00 AM', '01:30 PM', '03:00 PM'],
      },
    },
    // Template 8: Tue, Wed, Thu Adult Cleaning + Free Electric Toothbrush
    {
      days: [2, 3, 4],
      startTime: '09:00 AM',
      endTime: '05:00 PM',
      dur: 60,
      customSlots: {
        2: ['09:00 AM', '11:00 AM', '01:00 PM', '04:00 PM'],
        3: ['09:00 AM', '10:00 AM', '02:00 PM', '03:00 PM'],
        4: ['10:00 AM', '11:00 AM', '01:00 PM', '03:00 PM'],
      },
    },
  ];

  const defaultIdx = DEFAULT_BOOKING_SERVICES.findIndex((s) => s.id === serviceKey);
  const templateIdx = defaultIdx >= 0 ? defaultIdx : hash % presets.length;
  const chosen = presets[templateIdx];

  // Rotate days slightly for second/third doctors so different doctors also have distinct schedules per service
  const docShift = doctorId && !doctorId.includes('muo3k3pe') ? (hash % 2 === 0 ? 1 : 0) : 0;

  const weekly: WeeklyDaySchedule[] = DAY_NAMES.map((dayName, dow) => {
    if (dow === 0) {
      return {
        dayOfWeek: 0,
        dayName,
        enabled: false,
        startTime: '09:00 AM',
        endTime: '05:00 PM',
        slotDuration: chosen.dur,
        slots: [],
      };
    }

    const lookupDow = docShift ? ((dow + docShift - 1) % 6) + 1 : dow;
    const isEnabled = chosen.days.includes(lookupDow);
    const rawSlots =
      isEnabled && chosen.customSlots?.[lookupDow]
        ? chosen.customSlots[lookupDow]
        : isEnabled
        ? generateTimeSlotsFromWindow(chosen.startTime, chosen.endTime, chosen.dur)
        : [];

    return {
      dayOfWeek: dow,
      dayName,
      enabled: isEnabled,
      startTime: chosen.startTime,
      endTime: chosen.endTime,
      slotDuration: chosen.dur,
      slots: sortTimeSlotsChronologically(rawSlots),
    };
  });

  return {
    serviceId: serviceKey,
    serviceTitle: matchedDefault?.title || serviceIdOrTitle,
    defaultDuration: chosen.dur,
    recurringWeekly: weekly,
    weeklySchedule: weekly,
    specificDates: {},
    updatedAt: new Date().toISOString(),
  };
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

function resolveScheduleConfigForDate(
  config: {
    defaultDuration?: SlotDurationMinutes;
    recurringWeekly?: WeeklyDaySchedule[];
    weeklySchedule?: WeeklyDaySchedule[];
    specificDates?: DateSpecificAvailability[] | Record<string, DateSpecificAvailability>;
  },
  dateStr: string
): ConfiguredSlotsResult | null {
  const defaultDur: SlotDurationMinutes = config.defaultDuration || 30;

  // 1. Check specific date override first
  let specific: DateSpecificAvailability | undefined;
  if (Array.isArray(config.specificDates)) {
    specific = config.specificDates.find((d) => d && d.date === dateStr);
  } else if (config.specificDates && typeof config.specificDates === 'object') {
    specific = config.specificDates[dateStr];
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

  // 2. Check recurring weekly schedule
  const weeklyList =
    Array.isArray(config.recurringWeekly) && config.recurringWeekly.length > 0
      ? config.recurringWeekly
      : Array.isArray(config.weeklySchedule)
      ? config.weeklySchedule
      : [];

  const dow = getDayOfWeekFromDateString(dateStr);
  const weekly = weeklyList.find((w) => w.dayOfWeek === dow);
  if (weekly && weekly.enabled) {
    const dur = weekly.slotDuration || defaultDur;
    const rawSlots =
      Array.isArray(weekly.slots) && weekly.slots.length > 0
        ? weekly.slots
        : generateTimeSlotsFromWindow(weekly.startTime || '09:00 AM', weekly.endTime || '05:00 PM', dur);
    return attachSlotMetadata(sortTimeSlotsChronologically(rawSlots), dur, 'recurring');
  }

  return null;
}

/**
 * Resolves the raw configured slots and duration for a doctor on a given date ("YYYY-MM-DD"),
 * optionally scoped to a specific clinical service (`serviceIdOrTitle`).
 * Works both as a `string[]` (for `.length`, `.filter`, `.map`) AND as `{ slots, durationMinutes, source }`.
 */
export function getConfiguredDoctorSlotsForDate(
  availability: DoctorAvailabilityRecord | undefined | null,
  dateStr: string,
  serviceIdOrTitle?: string
): ConfiguredSlotsResult {
  if (!availability || !dateStr) {
    return attachSlotMetadata([], 30, 'none');
  }

  const serviceKey = normalizeServiceKey(serviceIdOrTitle);

  // If a specific service is requested, resolve that service's dedicated availability schedule!
  if (serviceKey && serviceKey !== 'all') {
    const explicitServiceConfig =
      availability.serviceAvailabilities?.[serviceKey] ||
      (serviceIdOrTitle ? availability.serviceAvailabilities?.[serviceIdOrTitle] : undefined);

    if (explicitServiceConfig) {
      const fromExplicit = resolveScheduleConfigForDate(explicitServiceConfig, dateStr);
      if (fromExplicit) return fromExplicit;
      return attachSlotMetadata([], explicitServiceConfig.defaultDuration || 30, 'none');
    }

    // If no explicit override has been saved for this service yet, use the service's distinct clinical schedule
    const generatedServiceConfig = buildDefaultServiceScheduleForDoctor(
      serviceIdOrTitle || serviceKey,
      availability.doctorId
    );
    const fromGenerated = resolveScheduleConfigForDate(generatedServiceConfig, dateStr);
    if (fromGenerated) return fromGenerated;
    return attachSlotMetadata([], generatedServiceConfig.defaultDuration || 30, 'none');
  }

  // General / All Services fallback
  const fromGeneral = resolveScheduleConfigForDate(availability, dateStr);
  if (fromGeneral) return fromGeneral;

  return attachSlotMetadata([], availability.defaultDuration || 30, 'none');
}
