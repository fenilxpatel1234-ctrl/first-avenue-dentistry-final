import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Sparkles,
  Check,
  X,
  CalendarPlus,
} from 'lucide-react';
import {
  saveDoctorAvailability,
  subscribeToDoctorAvailabilities,
  subscribeToBookingServices,
} from '../lib/firestoreService';
import type { Doctor } from '../types/admin';
import {
  DoctorAvailabilityRecord,
  WeeklyDaySchedule,
  DateSpecificAvailability,
  SlotDurationMinutes,
  BookingServiceItem,
  DEFAULT_BOOKING_SERVICES,
  normalizeServiceKey,
  buildDefaultServiceScheduleForDoctor,
  DAY_NAMES,
  generateTimeSlotsFromWindow,
  format24hTo12h,
} from '../types/scheduling';

interface DoctorAvailabilityManagerProps {
  doctors: Doctor[];
  availabilities?: DoctorAvailabilityRecord[];
  selectedDoctorId?: string;
  onSelectDoctor?: (doctorId: string) => void;
  allowDoctorSwitch?: boolean;
  actorEmail?: string;
  userEmail?: string;
  onSaved?: (updated: DoctorAvailabilityRecord) => void;
}

const DURATION_OPTIONS: SlotDurationMinutes[] = [15, 30, 45, 60];

const TIME_WINDOW_START_OPTIONS = [
  '08:00 AM',
  '08:30 AM',
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
];

const TIME_WINDOW_END_OPTIONS = [
  '12:00 PM',
  '01:00 PM',
  '01:30 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM',
  '05:30 PM',
  '06:00 PM',
  '07:00 PM',
];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildEmptyWeeklySchedule(): WeeklyDaySchedule[] {
  return DAY_NAMES.map((dayName, idx) => ({
    dayOfWeek: idx,
    dayName,
    enabled: false,
    startTime: '09:00 AM',
    endTime: '05:00 PM',
    slotDuration: 30,
    slots: [],
  }));
}

function normalizeSpecificDatesMap(
  raw?: Record<string, DateSpecificAvailability> | DateSpecificAvailability[]
): Record<string, DateSpecificAvailability> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const map: Record<string, DateSpecificAvailability> = {};
    for (const item of raw) {
      if (item && item.date) {
        const isEnabled =
          item.enabled !== undefined ? Boolean(item.enabled) : item.isAvailable !== false;
        map[item.date] = {
          ...item,
          enabled: isEnabled,
          isAvailable: isEnabled,
          startTime: format24hTo12h(item.startTime || '09:00 AM'),
          endTime: format24hTo12h(item.endTime || '05:00 PM'),
          slotDuration: (item.slotDuration || 30) as SlotDurationMinutes,
          slots: Array.isArray(item.slots) ? item.slots : [],
        };
      }
    }
    return map;
  }
  const map: Record<string, DateSpecificAvailability> = {};
  for (const [k, item] of Object.entries(raw)) {
    if (item) {
      const dateStr = item.date || k;
      const isEnabled =
        item.enabled !== undefined ? Boolean(item.enabled) : item.isAvailable !== false;
      map[dateStr] = {
        ...item,
        date: dateStr,
        enabled: isEnabled,
        isAvailable: isEnabled,
        startTime: format24hTo12h(item.startTime || '09:00 AM'),
        endTime: format24hTo12h(item.endTime || '05:00 PM'),
        slotDuration: (item.slotDuration || 30) as SlotDurationMinutes,
        slots: Array.isArray(item.slots) ? item.slots : [],
      };
    }
  }
  return map;
}

export const DoctorAvailabilityManager: React.FC<DoctorAvailabilityManagerProps> = ({
  doctors,
  availabilities: externalAvailabilities,
  selectedDoctorId,
  onSelectDoctor,
  allowDoctorSwitch = true,
  actorEmail,
  userEmail,
  onSaved,
}) => {
  const [internalAvailabilities, setInternalAvailabilities] = useState<DoctorAvailabilityRecord[]>(
    []
  );
  const [internalSelectedDoctorId, setInternalSelectedDoctorId] = useState<string>('');
  const [bookingServices, setBookingServices] = useState<BookingServiceItem[]>(
    DEFAULT_BOOKING_SERVICES
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');

  useEffect(() => {
    const unsubServices = subscribeToBookingServices((services) => {
      if (Array.isArray(services) && services.length > 0) {
        setBookingServices(services);
      } else {
        setBookingServices(DEFAULT_BOOKING_SERVICES);
      }
    });
    return () => unsubServices();
  }, []);

  useEffect(() => {
    if (externalAvailabilities !== undefined) return;
    const unsub = subscribeToDoctorAvailabilities((list) => {
      setInternalAvailabilities(list);
    });
    return () => unsub();
  }, [externalAvailabilities !== undefined]);

  const availabilities = externalAvailabilities ?? internalAvailabilities;
  const effectiveSelectedDoctorId = selectedDoctorId || internalSelectedDoctorId;
  const handleSelectDoctor = (docId: string) => {
    setInternalSelectedDoctorId(docId);
    if (onSelectDoctor) onSelectDoctor(docId);
  };

  const activeDoctor = useMemo(() => {
    if (effectiveSelectedDoctorId) {
      const found = doctors.find(
        (d) =>
          d.id === effectiveSelectedDoctorId ||
          d.name.trim().toLowerCase() === effectiveSelectedDoctorId.trim().toLowerCase()
      );
      if (found) return found;
    }
    return doctors[0] || null;
  }, [doctors, effectiveSelectedDoctorId]);

  const currentDoctorId = activeDoctor?.id || '';

  // Local editable schedule state
  const [defaultDuration, setDefaultDuration] = useState<SlotDurationMinutes>(30);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyDaySchedule[]>([]);
  const [specificDates, setSpecificDates] = useState<Record<string, DateSpecificAvailability>>({});
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'weekly'>('calendar');

  // Interactive Calendar state
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() =>
    toDateKey(new Date())
  );
  const [customSlotInput, setCustomSlotInput] = useState<string>('10:00 AM');
  const [activeDayForCustomSlot, setActiveDayForCustomSlot] = useState<number | null>(null);

  // Draft parameters when adding a new date on the calendar (starts with 0 slots selected)
  const [draftStartTime, setDraftStartTime] = useState<string>('09:00 AM');
  const [draftEndTime, setDraftEndTime] = useState<string>('05:00 PM');
  const [draftDuration, setDraftDuration] = useState<SlotDurationMinutes>(30);
  const [draftSelectedSlots, setDraftSelectedSlots] = useState<string[]>([]);
  const [dateCustomSlotInput, setDateCustomSlotInput] = useState<string>('');

  // Multi-date batch add state (starts with 0 slots selected)
  const [batchDatesModalOpen, setBatchDatesModalOpen] = useState(false);
  const [batchSelectedDates, setBatchSelectedDates] = useState<string[]>([]);
  const [batchStartTime, setBatchStartTime] = useState('09:00 AM');
  const [batchEndTime, setBatchEndTime] = useState('05:00 PM');
  const [batchDuration, setBatchDuration] = useState<SlotDurationMinutes>(30);
  const [batchSelectedSlots, setBatchSelectedSlots] = useState<string[]>([]);
  const [batchCustomSlotInput, setBatchCustomSlotInput] = useState<string>('');
  const [batchNote, setBatchNote] = useState('');

  // Saving & feedback state
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Reset draft manual slot selection when switching dates on the calendar
  useEffect(() => {
    setDraftSelectedSlots([]);
    setDateCustomSlotInput('');
  }, [selectedCalendarDate]);

  // Sync local state whenever selected doctor, selected service, or remote availabilities change
  useEffect(() => {
    if (!activeDoctor) return;
    const existing = availabilities.find(
      (a) =>
        a.doctorId === activeDoctor.id ||
        a.doctorName.trim().toLowerCase() === activeDoctor.name.trim().toLowerCase()
    );

    if (selectedServiceId !== 'all') {
      const sKey = normalizeServiceKey(selectedServiceId);
      const savedSvcSched = existing?.serviceAvailabilities?.[sKey];
      const fallbackSvcSched = buildDefaultServiceScheduleForDoctor(
        activeDoctor.id,
        selectedServiceId
      );
      const targetSched = savedSvcSched || fallbackSvcSched;

      const dur = (targetSched.defaultDuration || 30) as SlotDurationMinutes;
      setDefaultDuration(dur);
      setDraftDuration(dur);
      const sourceWeekly =
        targetSched.weeklySchedule && targetSched.weeklySchedule.length === 7
          ? targetSched.weeklySchedule
          : buildEmptyWeeklySchedule();
      setWeeklySchedule(
        sourceWeekly.map((w) => ({
          ...w,
          startTime: format24hTo12h(w.startTime || '09:00 AM'),
          endTime: format24hTo12h(w.endTime || '05:00 PM'),
          slots: Array.isArray(w.slots) ? [...w.slots] : [],
        }))
      );
      setSpecificDates(normalizeSpecificDatesMap(targetSched.specificDates));
      setHasUnsavedChanges(false);
      return;
    }

    if (existing) {
      setDefaultDuration(existing.defaultDuration || 30);
      const sourceWeekly =
        existing.weeklySchedule && existing.weeklySchedule.length === 7
          ? existing.weeklySchedule
          : existing.recurringWeekly && existing.recurringWeekly.length === 7
          ? existing.recurringWeekly
          : buildEmptyWeeklySchedule();

      setWeeklySchedule(
        sourceWeekly.map((w) => ({
          ...w,
          startTime: format24hTo12h(w.startTime || '09:00 AM'),
          endTime: format24hTo12h(w.endTime || '05:00 PM'),
          slots: Array.isArray(w.slots) ? [...w.slots] : [],
        }))
      );
      setSpecificDates(normalizeSpecificDatesMap(existing.specificDates));
    } else {
      setDefaultDuration(30);
      setWeeklySchedule(buildEmptyWeeklySchedule());
      setSpecificDates({});
    }
    setHasUnsavedChanges(false);
  }, [activeDoctor?.id, availabilities, selectedServiceId]);

  // Persist helper so doctors/admins can save immediately (either general or service-specific)
  const persistAvailabilityNow = async (
    nextWeekly = weeklySchedule,
    nextSpecific = specificDates,
    nextDuration = defaultDuration,
    customMessage?: string
  ) => {
    if (!activeDoctor) return;
    setSaving(true);
    setFeedback(null);

    try {
      const existing = availabilities.find(
        (a) =>
          a.doctorId === activeDoctor.id ||
          a.doctorName.trim().toLowerCase() === activeDoctor.name.trim().toLowerCase()
      );

      let record: DoctorAvailabilityRecord & { serviceId?: string };

      if (selectedServiceId !== 'all') {
        const sKey = normalizeServiceKey(selectedServiceId);
        const nextServiceAvailabilities = {
          ...(existing?.serviceAvailabilities || {}),
          [sKey]: {
            serviceId: selectedServiceId,
            defaultDuration: nextDuration,
            weeklySchedule: nextWeekly,
            specificDates: nextSpecific,
            updatedAt: new Date().toISOString(),
          },
        };

        record = {
          doctorId: activeDoctor.id,
          doctorName: activeDoctor.name,
          defaultDuration: existing?.defaultDuration || nextDuration,
          recurringWeekly: existing?.recurringWeekly || existing?.weeklySchedule || nextWeekly,
          weeklySchedule: existing?.weeklySchedule || nextWeekly,
          specificDates: existing?.specificDates || {},
          serviceAvailabilities: nextServiceAvailabilities,
          serviceId: selectedServiceId,
          updatedAt: new Date().toISOString(),
        };
      } else {
        record = {
          doctorId: activeDoctor.id,
          doctorName: activeDoctor.name,
          defaultDuration: nextDuration,
          recurringWeekly: nextWeekly,
          weeklySchedule: nextWeekly,
          specificDates: nextSpecific,
          serviceAvailabilities: existing?.serviceAvailabilities || {},
          serviceId: 'all',
          updatedAt: new Date().toISOString(),
        };
      }

      await saveDoctorAvailability(
        record,
        actorEmail || userEmail || activeDoctor.email || 'firstavenuedentistry@gmail.com'
      );
      setHasUnsavedChanges(false);
      if (onSaved) onSaved(record);
      const serviceLabel =
        selectedServiceId === 'all' ? 'General Schedule' : `"${selectedServiceId}"`;
      setFeedback({
        type: 'success',
        message:
          customMessage ||
          `Saved ${serviceLabel} availability for ${activeDoctor.name}. Live across Patient Booking & Portals.`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to save availability. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handlers for Weekly Schedule (Manual slot selection — never auto-selects all slots)
  const handleToggleWeeklyDay = (dayOfWeek: number) => {
    setWeeklySchedule((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        const nextEnabled = !day.enabled;
        return { ...day, enabled: nextEnabled, slots: nextEnabled ? day.slots : [] };
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleUpdateWeeklyWindow = (
    dayOfWeek: number,
    field: 'startTime' | 'endTime' | 'slotDuration',
    value: string | number
  ) => {
    setWeeklySchedule((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        return {
          ...day,
          [field]: field === 'slotDuration' ? (Number(value) as SlotDurationMinutes) : String(value),
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleToggleWeeklySlot = (dayOfWeek: number, slotTime: string) => {
    setWeeklySchedule((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        const exists = day.slots.includes(slotTime);
        const nextSlots = exists
          ? day.slots.filter((s) => s !== slotTime)
          : [...day.slots, slotTime];
        return { ...day, slots: nextSlots };
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleAddCustomWeeklySlot = (dayOfWeek: number) => {
    const clean = format24hTo12h(customSlotInput.trim());
    if (!clean) return;
    setWeeklySchedule((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        if (day.slots.includes(clean)) return day;
        return { ...day, slots: [...day.slots, clean] };
      })
    );
    setActiveDayForCustomSlot(null);
    setHasUnsavedChanges(true);
  };

  const handleApplyDefaultDurationToAll = (dur: SlotDurationMinutes) => {
    setDefaultDuration(dur);
    setDraftDuration(dur);
    setWeeklySchedule((prev) =>
      prev.map((day) => ({
        ...day,
        slotDuration: dur,
      }))
    );
    setHasUnsavedChanges(true);
  };

  // Handlers for Date-Specific Overrides (Calendar) — Manual time slot selection
  const selectedDateOverride = specificDates[selectedCalendarDate] || null;

  const selectedDateDayOfWeek = useMemo(() => {
    const [y, m, d] = selectedCalendarDate.split('-').map(Number);
    if (!y || !m || !d) return 1;
    return new Date(y, m - 1, d).getDay();
  }, [selectedCalendarDate]);

  const matchingWeeklyForSelectedDate = useMemo(
    () => weeklySchedule.find((w) => w.dayOfWeek === selectedDateDayOfWeek),
    [weeklySchedule, selectedDateDayOfWeek]
  );

  const handleToggleDraftSlotForNewDate = (slotTime: string) => {
    setDraftSelectedSlots((prev) =>
      prev.includes(slotTime) ? prev.filter((s) => s !== slotTime) : [...prev, slotTime]
    );
  };

  const handleAddCustomSlotToSelectedDate = () => {
    const raw = dateCustomSlotInput.trim();
    if (!raw) return;
    const formatted = format24hTo12h(raw);
    if (selectedDateOverride) {
      if (!selectedDateOverride.slots.includes(formatted)) {
        handleToggleDateOverrideSlot(selectedCalendarDate, formatted);
      }
    } else {
      setDraftSelectedSlots((prev) => (prev.includes(formatted) ? prev : [...prev, formatted]));
    }
    setDateCustomSlotInput('');
  };

  const handleAddAvailabilityForSelectedDate = async (autoSave = false) => {
    if (draftSelectedSlots.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please tap or add at least one time slot manually before saving.',
      });
      return;
    }
    const newEntry: DateSpecificAvailability = {
      id: `spec-${selectedCalendarDate}`,
      date: selectedCalendarDate,
      isAvailable: true,
      enabled: true,
      startTime: draftStartTime,
      endTime: draftEndTime,
      slotDuration: draftDuration,
      slots: [...draftSelectedSlots],
      note: 'Available Session',
      updatedAt: new Date().toISOString(),
    };
    const nextSpecific = {
      ...specificDates,
      [selectedCalendarDate]: newEntry,
    };
    setSpecificDates(nextSpecific);
    setHasUnsavedChanges(true);

    if (autoSave) {
      await persistAvailabilityNow(
        weeklySchedule,
        nextSpecific,
        defaultDuration,
        `Saved ${draftSelectedSlots.length} manually selected time slot${
          draftSelectedSlots.length === 1 ? '' : 's'
        } on ${selectedCalendarDate}.`
      );
    }
  };

  const handleBlockSelectedDate = async () => {
    const nextEntry: DateSpecificAvailability = {
      id: `spec-${selectedCalendarDate}`,
      date: selectedCalendarDate,
      isAvailable: false,
      enabled: false,
      startTime: draftStartTime,
      endTime: draftEndTime,
      slotDuration: draftDuration,
      slots: [],
      note: 'Unavailable / Day Off',
      updatedAt: new Date().toISOString(),
    };
    const nextSpecific = {
      ...specificDates,
      [selectedCalendarDate]: nextEntry,
    };
    setSpecificDates(nextSpecific);
    await persistAvailabilityNow(
      weeklySchedule,
      nextSpecific,
      defaultDuration,
      `Marked ${selectedCalendarDate} as Unavailable.`
    );
  };

  const handleRemoveDateOverride = async (dateKey: string) => {
    const next = { ...specificDates };
    delete next[dateKey];
    setSpecificDates(next);
    await persistAvailabilityNow(
      weeklySchedule,
      next,
      defaultDuration,
      `Removed availability for ${dateKey}.`
    );
  };

  const handleUpdateDateOverrideWindow = (
    dateKey: string,
    field: 'startTime' | 'endTime' | 'slotDuration' | 'enabled' | 'note',
    value: any
  ) => {
    setSpecificDates((prev) => {
      const current = prev[dateKey];
      if (!current) return prev;
      const updated: DateSpecificAvailability = {
        ...current,
        [field]:
          field === 'slotDuration'
            ? (Number(value) as SlotDurationMinutes)
            : field === 'enabled'
            ? Boolean(value)
            : value,
        updatedAt: new Date().toISOString(),
      };
      if (field === 'enabled') {
        updated.isAvailable = Boolean(value);
        if (!updated.enabled) {
          updated.slots = [];
        }
      }
      // Do NOT auto-populate all slots when changing startTime, endTime, or slotDuration;
      // preserve only the doctor's manually selected slots.
      return { ...prev, [dateKey]: updated };
    });
    setHasUnsavedChanges(true);
  };

  const handleToggleDateOverrideSlot = (dateKey: string, slotTime: string) => {
    setSpecificDates((prev) => {
      const current = prev[dateKey];
      if (!current) return prev;
      const exists = current.slots.includes(slotTime);
      const nextSlots = exists
        ? current.slots.filter((s) => s !== slotTime)
        : [...current.slots, slotTime];
      return {
        ...prev,
        [dateKey]: {
          ...current,
          slots: nextSlots,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleApplyBatchDates = async () => {
    if (batchSelectedDates.length === 0 || batchSelectedSlots.length === 0) return;
    const next = { ...specificDates };
    for (const dt of batchSelectedDates) {
      next[dt] = {
        id: `spec-${dt}`,
        date: dt,
        isAvailable: true,
        enabled: true,
        startTime: batchStartTime,
        endTime: batchEndTime,
        slotDuration: batchDuration,
        slots: [...batchSelectedSlots],
        note: batchNote.trim() || 'Available Session',
        updatedAt: new Date().toISOString(),
      };
    }
    setSpecificDates(next);
    setBatchDatesModalOpen(false);
    const count = batchSelectedDates.length;
    const slotCount = batchSelectedSlots.length;
    setBatchSelectedDates([]);
    setBatchSelectedSlots([]);
    await persistAvailabilityNow(
      weeklySchedule,
      next,
      defaultDuration,
      `Added & saved ${slotCount} manual time slot${slotCount === 1 ? '' : 's'} across ${count} date${
        count > 1 ? 's' : ''
      } for ${activeDoctor?.name}.`
    );
  };

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ dateKey: string | null; dayNum: number | null; isPast: boolean }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ dateKey: null, dayNum: null, isPast: false });
    }

    const todayKey = toDateKey(new Date());
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const key = toDateKey(dt);
      cells.push({
        dateKey: key,
        dayNum: d,
        isPast: key < todayKey,
      });
    }
    return cells;
  }, [calendarMonth]);

  // Upcoming 21 days for multi-date batch selector
  const upcomingBatchDateOptions = useMemo(() => {
    const list: Array<{ dateKey: string; label: string; dayName: string }> = [];
    const base = new Date();
    for (let i = 0; i < 21; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const key = toDateKey(d);
      list.push({
        dateKey: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayName: DAY_NAMES[d.getDay()].slice(0, 3),
      });
    }
    return list;
  }, []);

  if (!activeDoctor) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <Stethoscope className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-bold text-[#060C16]">No Active Doctor Selected</p>
        <p className="text-xs text-slate-500 mt-1">
          Please add or select a doctor to configure appointment availability.
        </p>
      </div>
    );
  }

  const configuredAvailableDatesList = (Object.values(specificDates) as DateSpecificAvailability[])
    .filter((d) => d.enabled && d.slots.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const enabledWeeklyCount = weeklySchedule.filter((w) => w.enabled && w.slots.length > 0).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Bar: Doctor Switcher (Admin only) + Save Button */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#060C16] tracking-tight">
              {activeDoctor.name} — Schedule &amp; Available Time Slots
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Select dates on the calendar below, choose your working hours and slot duration, and click Save.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setBatchDatesModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:border-[#1E5AFF] hover:text-[#1E5AFF] bg-white transition-all cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>+ Add Multiple Dates</span>
            </button>

            <button
              type="button"
              onClick={() => persistAvailabilityNow()}
              disabled={saving}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold text-white bg-[#1E5AFF] hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Availability</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Doctor Switcher & Service-Specific Schedule Selector */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {allowDoctorSwitch && doctors.length > 1 && (
            <div className="lg:col-span-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                1. Select Doctor to Manage Schedule
              </p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {doctors.map((doc) => {
                  const isSelected = doc.id === currentDoctorId;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleSelectDoctor(doc.id)}
                      className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-[#060C16] text-white border-[#060C16]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {doc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={allowDoctorSwitch && doctors.length > 1 ? 'lg:col-span-6' : 'lg:col-span-12'}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#1E5AFF]">
                {allowDoctorSwitch && doctors.length > 1
                  ? '2. Dental Service / Reason'
                  : 'Dental Service / Reason'}
              </label>
            </div>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#DCE6FF] bg-[#F8FAFF] text-xs font-bold text-[#002156] focus:outline-none focus:border-[#1E5AFF] cursor-pointer"
            >
              <option value="all">All Services (General Base Schedule)</option>
              {bookingServices.map((svc) => (
                <option key={svc.id} value={svc.title}>
                  Service Schedule: {svc.title} ({svc.durationMinutes || 45} mins)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-bold underline opacity-75 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Mode Switcher + Default Slot Duration */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`flex-1 sm:flex-initial px-4 py-2 min-h-[40px] rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'calendar'
                  ? 'bg-white text-[#060C16] shadow-xs'
                  : 'text-slate-600 hover:text-[#060C16]'
              }`}
            >
              1. Pick Specific Dates (Calendar)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('weekly')}
              className={`flex-1 sm:flex-initial px-4 py-2 min-h-[40px] rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'weekly'
                  ? 'bg-white text-[#060C16] shadow-xs'
                  : 'text-slate-600 hover:text-[#060C16]'
              }`}
            >
              2. Recurring Weekly Hours
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-xs font-semibold text-slate-500">Slot Duration:</span>
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl">
              {DURATION_OPTIONS.map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => handleApplyDefaultDurationToAll(dur)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    defaultDuration === dur
                      ? 'bg-[#060C16] text-white'
                      : 'text-slate-600 hover:text-[#060C16]'
                  }`}
                >
                  {dur}m
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: SPECIFIC DATES CALENDAR EDITOR */}
      {activeSubTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Left Column: Interactive Calendar */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#060C16]">Select Date on Calendar</h3>
                <p className="text-xs text-slate-500">
                  Tap any date to add or edit availability
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                    )
                  }
                  className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-[#060C16] px-2.5 min-w-[110px] text-center">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                    )
                  }
                  className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {[
                { s: 'Su', l: 'Sun' },
                { s: 'Mo', l: 'Mon' },
                { s: 'Tu', l: 'Tue' },
                { s: 'We', l: 'Wed' },
                { s: 'Th', l: 'Thu' },
                { s: 'Fr', l: 'Fri' },
                { s: 'Sa', l: 'Sat' },
              ].map((d) => (
                <div key={d.l} className="text-[11px] font-bold text-slate-400 py-1">
                  <span className="sm:hidden">{d.s}</span>
                  <span className="hidden sm:inline">{d.l}</span>
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cell, i) => {
                if (!cell.dateKey || !cell.dayNum) {
                  return <div key={`empty-${i}`} className="h-11 sm:h-12 min-h-[44px]" />;
                }
                const isSelected = cell.dateKey === selectedCalendarDate;
                const override = specificDates[cell.dateKey];
                const dow = new Date(
                  calendarMonth.getFullYear(),
                  calendarMonth.getMonth(),
                  cell.dayNum
                ).getDay();
                const weeklyDay = weeklySchedule.find((w) => w.dayOfWeek === dow);
                const isAvailableDay = override
                  ? override.enabled && override.slots.length > 0
                  : Boolean(weeklyDay?.enabled && weeklyDay.slots.length > 0);

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    disabled={cell.isPast}
                    onClick={() => setSelectedCalendarDate(cell.dateKey!)}
                    className={`relative h-11 sm:h-12 min-h-[44px] rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all border cursor-pointer touch-manipulation active:scale-95 ${
                      cell.isPast
                        ? 'opacity-35 bg-slate-50 border-transparent text-slate-400 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-xs'
                        : override
                        ? override.enabled
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : 'bg-red-50 text-red-700 border-red-200'
                        : isAvailableDay
                        ? 'bg-blue-50/60 border-blue-200 text-[#060C16] hover:border-[#1E5AFF]'
                        : 'bg-white border-slate-200/80 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{cell.dayNum}</span>
                    {!cell.isPast && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                          isSelected
                            ? 'bg-white'
                            : override
                            ? override.enabled
                              ? 'bg-emerald-500'
                              : 'bg-red-500'
                            : isAvailableDay
                            ? 'bg-[#1E5AFF]'
                            : 'bg-transparent'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Simple Legend */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Available Date
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1E5AFF]" />
                Weekly Hours
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                No Availability
              </span>
            </div>

            {/* Saved Available Dates List */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#060C16]">
                  Your Added Available Dates ({configuredAvailableDatesList.length})
                </p>
              </div>
              {configuredAvailableDatesList.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                  No specific dates added yet. Select a date on the calendar to add your available hours.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {configuredAvailableDatesList.map((ov) => (
                    <div
                      key={ov.date}
                      onClick={() => setSelectedCalendarDate(ov.date)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedCalendarDate === ov.date
                          ? 'bg-blue-50/80 border-[#1E5AFF] text-[#060C16]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold">{ov.date}</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="text-emerald-700 font-semibold">
                          {ov.startTime} – {ov.endTime} ({ov.slots.length} slots)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDateOverride(ov.date);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        title="Delete this date"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Selected Date Time Slot Editor */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs font-semibold text-[#1E5AFF]">
                    Selected Date: {DAY_NAMES[selectedDateDayOfWeek]}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[#060C16] mt-0.5">
                    {selectedCalendarDate}
                  </h3>
                </div>

                {selectedDateOverride && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDateOverride(selectedCalendarDate)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Availability for {selectedCalendarDate}</span>
                  </button>
                )}
              </div>

              {!selectedDateOverride ? (
                <div className="py-5 space-y-5">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                    <p className="text-xs font-semibold text-slate-500">Current Status on {selectedCalendarDate}</p>
                    <p className="text-sm font-bold text-[#060C16] mt-1">
                      {matchingWeeklyForSelectedDate?.enabled && matchingWeeklyForSelectedDate.slots.length > 0
                        ? `Recurring ${matchingWeeklyForSelectedDate.dayName} Schedule: ${matchingWeeklyForSelectedDate.startTime} – ${matchingWeeklyForSelectedDate.endTime} (${matchingWeeklyForSelectedDate.slots.length} slots)`
                        : 'Not Available — Select your time slots manually below'}
                    </p>
                  </div>

                  {/* Manual Time Slot Setup Form for This Date */}
                  <div className="bg-blue-50/40 rounded-2xl p-4 sm:p-5 border border-blue-200/80 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#060C16]">
                        Select Available Time Slots for {selectedCalendarDate}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Choose your working window or type a custom time, then tap each time slot you want to make available. No slots are selected automatically.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Window Start
                        </label>
                        <select
                          value={draftStartTime}
                          onChange={(e) => setDraftStartTime(e.target.value)}
                          className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white"
                        >
                          {TIME_WINDOW_START_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Window End
                        </label>
                        <select
                          value={draftEndTime}
                          onChange={(e) => setDraftEndTime(e.target.value)}
                          className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white"
                        >
                          {TIME_WINDOW_END_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Appointment Duration
                        </label>
                        <select
                          value={draftDuration}
                          onChange={(e) =>
                            setDraftDuration(Number(e.target.value) as SlotDurationMinutes)
                          }
                          className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white"
                        >
                          {DURATION_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                              {d} Minutes
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Manual Custom Time Input & Quick Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-blue-200/60">
                      <div>
                        <span className="text-xs font-bold text-[#060C16] block">
                          Tap Time Slots to Add ({draftSelectedSlots.length} selected manually)
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setDraftSelectedSlots(
                                generateTimeSlotsFromWindow(draftStartTime, draftEndTime, draftDuration)
                              )
                            }
                            className="text-[11px] font-bold text-[#1E5AFF] hover:underline cursor-pointer"
                          >
                            Select All in Window
                          </button>
                          {draftSelectedSlots.length > 0 && (
                            <>
                              <span className="text-slate-300">·</span>
                              <button
                                type="button"
                                onClick={() => setDraftSelectedSlots([])}
                                className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                              >
                                Clear All
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                        <input
                          type="text"
                          value={dateCustomSlotInput}
                          onChange={(e) => setDateCustomSlotInput(e.target.value)}
                          placeholder="Custom (e.g. 10:15 AM)"
                          className="px-3 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-white text-xs font-bold text-[#060C16] flex-1 sm:w-44 min-w-[130px]"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomSlotToSelectedDate}
                          className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#060C16] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer shrink-0"
                        >
                          + Add Time
                        </button>
                      </div>
                    </div>

                    {/* Unselected-by-default Time Slots Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {Array.from(
                        new Set([
                          ...generateTimeSlotsFromWindow(
                            draftStartTime,
                            draftEndTime,
                            draftDuration
                          ),
                          ...draftSelectedSlots,
                        ])
                      ).map((slot) => {
                        const isSelected = draftSelectedSlots.includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => handleToggleDraftSlotForNewDate(slot)}
                            className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation active:scale-95 ${
                              isSelected
                                ? 'bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-[#1E5AFF] hover:text-[#1E5AFF]'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{slot}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => handleAddAvailabilityForSelectedDate(true)}
                        disabled={saving || draftSelectedSlots.length === 0}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold bg-[#1E5AFF] text-white hover:bg-blue-700 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>
                          {draftSelectedSlots.length === 0
                            ? 'Tap Time Slots Above to Save'
                            : `Save ${draftSelectedSlots.length} Selected Time Slot${
                                draftSelectedSlots.length === 1 ? '' : 's'
                              } for ${selectedCalendarDate}`}
                        </span>
                      </button>

                      {matchingWeeklyForSelectedDate?.enabled && (
                        <button
                          type="button"
                          onClick={handleBlockSelectedDate}
                          disabled={saving}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-3 min-h-[44px] rounded-xl text-xs font-bold bg-white text-red-700 border border-red-200 hover:bg-red-50 transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Mark Date Off</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 space-y-4">
                  {/* Availability Toggle & Working Hours */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Status
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDateOverrideWindow(
                            selectedCalendarDate,
                            'enabled',
                            !selectedDateOverride.enabled
                          )
                        }
                        className={`w-full px-3 py-2.5 min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer ${
                          selectedDateOverride.enabled
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-red-600 text-white border-red-600'
                        }`}
                      >
                        {selectedDateOverride.enabled ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Available
                          </>
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5" /> Closed / Off
                          </>
                        )}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Window Start
                      </label>
                      <select
                        disabled={!selectedDateOverride.enabled}
                        value={selectedDateOverride.startTime}
                        onChange={(e) =>
                          handleUpdateDateOverrideWindow(
                            selectedCalendarDate,
                            'startTime',
                            e.target.value
                          )
                        }
                        className="w-full px-2.5 py-2 min-h-[42px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white disabled:opacity-50"
                      >
                        {TIME_WINDOW_START_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Window End
                      </label>
                      <select
                        disabled={!selectedDateOverride.enabled}
                        value={selectedDateOverride.endTime}
                        onChange={(e) =>
                          handleUpdateDateOverrideWindow(
                            selectedCalendarDate,
                            'endTime',
                            e.target.value
                          )
                        }
                        className="w-full px-2.5 py-2 min-h-[42px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white disabled:opacity-50"
                      >
                        {TIME_WINDOW_END_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Duration
                      </label>
                      <select
                        disabled={!selectedDateOverride.enabled}
                        value={selectedDateOverride.slotDuration}
                        onChange={(e) =>
                          handleUpdateDateOverrideWindow(
                            selectedCalendarDate,
                            'slotDuration',
                            Number(e.target.value)
                          )
                        }
                        className="w-full px-2.5 py-2 min-h-[42px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white disabled:opacity-50"
                      >
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d} min
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Individual Time Slots Grid (Manual Selection Only) */}
                  {selectedDateOverride.enabled && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <span className="text-xs font-bold text-slate-600 block">
                            Selected Time Slots ({selectedDateOverride.slots.length} active) — Tap to add or remove
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const allWinSlots = generateTimeSlotsFromWindow(
                                  selectedDateOverride.startTime,
                                  selectedDateOverride.endTime,
                                  selectedDateOverride.slotDuration
                                );
                                setSpecificDates((prev) => ({
                                  ...prev,
                                  [selectedCalendarDate]: {
                                    ...selectedDateOverride,
                                    slots: allWinSlots,
                                    updatedAt: new Date().toISOString(),
                                  },
                                }));
                              }}
                              className="text-[11px] font-bold text-[#1E5AFF] hover:underline cursor-pointer"
                            >
                              Select All in Window
                            </button>
                            {selectedDateOverride.slots.length > 0 && (
                              <>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSpecificDates((prev) => ({
                                      ...prev,
                                      [selectedCalendarDate]: {
                                        ...selectedDateOverride,
                                        slots: [],
                                        updatedAt: new Date().toISOString(),
                                      },
                                    }))
                                  }
                                  className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                          <input
                            type="text"
                            value={dateCustomSlotInput}
                            onChange={(e) => setDateCustomSlotInput(e.target.value)}
                            placeholder="Custom (e.g. 10:15 AM)"
                            className="px-3 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-white text-xs font-bold text-[#060C16] flex-1 sm:w-44 min-w-[130px]"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomSlotToSelectedDate}
                            className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#060C16] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer shrink-0"
                          >
                            + Add Time
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {Array.from(
                          new Set([
                            ...generateTimeSlotsFromWindow(
                              selectedDateOverride.startTime,
                              selectedDateOverride.endTime,
                              selectedDateOverride.slotDuration
                            ),
                            ...selectedDateOverride.slots,
                          ])
                        ).map((slot) => {
                          const isActive = selectedDateOverride.slots.includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() =>
                                handleToggleDateOverrideSlot(selectedCalendarDate, slot)
                              }
                              className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation active:scale-95 ${
                                isActive
                                  ? 'bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#1E5AFF] hover:text-[#1E5AFF]'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>{slot}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Save Button right inside the card for mobile convenience */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => persistAvailabilityNow()}
                      disabled={saving}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold text-white bg-[#1E5AFF] hover:bg-blue-700 transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {saving ? 'Saving Changes...' : `Save Changes for ${selectedCalendarDate}`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECURRING WEEKLY SCHEDULE */}
      {activeSubTab === 'weekly' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
            <div>
              <h3 className="text-sm font-bold text-[#060C16]">
                Recurring Weekly Schedule — {activeDoctor.name}
              </h3>
              <p className="text-xs text-slate-500">
                Optional: Turn on a day of the week and manually tap the specific time slots you want to offer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => persistAvailabilityNow()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold text-white bg-[#1E5AFF] hover:bg-blue-700 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Weekly Schedule'}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {weeklySchedule.map((day) => {
              const windowSlots = generateTimeSlotsFromWindow(
                day.startTime,
                day.endTime,
                day.slotDuration
              );
              const allDisplaySlots = Array.from(new Set([...windowSlots, ...day.slots]));

              return (
                <div
                  key={day.dayOfWeek}
                  className={`p-4 sm:p-5 transition-colors ${
                    day.enabled ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Day Toggle */}
                    <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[200px]">
                      <button
                        type="button"
                        onClick={() => handleToggleWeeklyDay(day.dayOfWeek)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                          day.enabled ? 'bg-[#1E5AFF]' : 'bg-slate-300'
                        }`}
                        aria-label={`Toggle ${day.dayName}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                            day.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <div>
                        <span className="text-sm font-bold text-[#060C16]">{day.dayName}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {day.enabled ? `${day.slots.length} slots selected` : 'Day Off'}
                        </span>
                      </div>
                    </div>

                    {/* Working Hours & Duration Controls */}
                    {day.enabled && (
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">From</span>
                          <select
                            value={day.startTime}
                            onChange={(e) =>
                              handleUpdateWeeklyWindow(day.dayOfWeek, 'startTime', e.target.value)
                            }
                            className="px-2.5 py-2 min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white"
                          >
                            {TIME_WINDOW_START_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">To</span>
                          <select
                            value={day.endTime}
                            onChange={(e) =>
                              handleUpdateWeeklyWindow(day.dayOfWeek, 'endTime', e.target.value)
                            }
                            className="px-2.5 py-2 min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white"
                          >
                            {TIME_WINDOW_END_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                          <span className="text-xs font-semibold text-slate-500">Duration</span>
                          <select
                            value={day.slotDuration}
                            onChange={(e) =>
                              handleUpdateWeeklyWindow(
                                day.dayOfWeek,
                                'slotDuration',
                                Number(e.target.value)
                              )
                            }
                            className="px-2.5 py-2 min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-white"
                          >
                            {DURATION_OPTIONS.map((d) => (
                              <option key={d} value={d}>
                                {d} min
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Time Slots Pills (Manual Toggle) */}
                  {day.enabled && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Tap the specific time slots you want to make available on {day.dayName}s:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {allDisplaySlots.map((slotTime) => {
                          const isSelected = day.slots.includes(slotTime);
                          return (
                            <button
                              key={slotTime}
                              type="button"
                              onClick={() => handleToggleWeeklySlot(day.dayOfWeek, slotTime)}
                              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#1E5AFF] text-white border-[#1E5AFF]'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#1E5AFF] hover:text-[#1E5AFF]'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{slotTime}</span>
                            </button>
                          );
                        })}

                        {activeDayForCustomSlot === day.dayOfWeek ? (
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <input
                              type="text"
                              value={customSlotInput}
                              onChange={(e) => setCustomSlotInput(e.target.value)}
                              placeholder="e.g. 02:15 PM"
                              className="w-24 px-2 py-1 text-xs font-bold bg-white rounded border border-slate-300"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddCustomWeeklySlot(day.dayOfWeek)}
                              className="px-2 py-1 bg-[#1E5AFF] text-white rounded text-xs font-bold cursor-pointer"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveDayForCustomSlot(null)}
                              className="px-1.5 py-1 text-slate-500 text-xs font-bold cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveDayForCustomSlot(day.dayOfWeek)}
                            className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border border-dashed border-slate-300 text-slate-600 hover:border-[#1E5AFF] hover:text-[#1E5AFF] flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Custom Slot
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Date Batch Availability Modal */}
      {batchDatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#060C16]">
                  Add Multiple Available Dates — {activeDoctor.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select multiple upcoming dates and manually tap the time slots you want to make available.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchDatesModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                1. Select Dates ({batchSelectedDates.length} selected)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1">
                {upcomingBatchDateOptions.map((item) => {
                  const selected = batchSelectedDates.includes(item.dateKey);
                  return (
                    <button
                      key={item.dateKey}
                      type="button"
                      onClick={() =>
                        setBatchSelectedDates((prev) =>
                          prev.includes(item.dateKey)
                            ? prev.filter((k) => k !== item.dateKey)
                            : [...prev, item.dateKey]
                        )
                      }
                      className={`p-2.5 min-h-[44px] rounded-xl border text-left transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#1E5AFF] text-white border-[#1E5AFF]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase opacity-75">
                        {item.dayName}
                      </div>
                      <div className="text-xs font-bold">{item.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Window Start</label>
                <select
                  value={batchStartTime}
                  onChange={(e) => setBatchStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border border-slate-200 text-xs font-bold"
                >
                  {TIME_WINDOW_START_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Window End</label>
                <select
                  value={batchEndTime}
                  onChange={(e) => setBatchEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border border-slate-200 text-xs font-bold"
                >
                  {TIME_WINDOW_END_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Slot Duration</label>
                <select
                  value={batchDuration}
                  onChange={(e) =>
                    setBatchDuration(Number(e.target.value) as SlotDurationMinutes)
                  }
                  className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border border-slate-200 text-xs font-bold"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Manual Time Slot Picker for Batch Dates */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-700">
                  2. Tap Time Slots Manually ({batchSelectedSlots.length} selected)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  <input
                    type="text"
                    value={batchCustomSlotInput}
                    onChange={(e) => setBatchCustomSlotInput(e.target.value)}
                    placeholder="Custom (e.g. 10:15 AM)"
                    className="px-2.5 py-1.5 min-h-[36px] rounded-lg border border-slate-200 text-xs font-bold flex-1 sm:w-36 min-w-[120px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const raw = batchCustomSlotInput.trim();
                      if (!raw) return;
                      const formatted = format24hTo12h(raw);
                      setBatchSelectedSlots((prev) =>
                        prev.includes(formatted) ? prev : [...prev, formatted]
                      );
                      setBatchCustomSlotInput('');
                    }}
                    className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#060C16] text-white text-xs font-bold cursor-pointer"
                  >
                    + Add
                  </button>
                  {batchSelectedSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBatchSelectedSlots([])}
                      className="px-2 py-1.5 min-h-[36px] rounded-lg border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1">
                {Array.from(
                  new Set([
                    ...generateTimeSlotsFromWindow(batchStartTime, batchEndTime, batchDuration),
                    ...batchSelectedSlots,
                  ])
                ).map((slot) => {
                  const isSelected = batchSelectedSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setBatchSelectedSlots((prev) =>
                          prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
                        )
                      }
                      className={`px-2.5 py-2 min-h-[42px] rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all cursor-pointer touch-manipulation active:scale-95 ${
                        isSelected
                          ? 'bg-[#1E5AFF] text-white border-[#1E5AFF]'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#1E5AFF]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{slot}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Session Note (Optional)
              </label>
              <input
                type="text"
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder="e.g., Morning & Afternoon Clinical Hours"
                className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border border-slate-200 text-xs font-medium"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBatchDatesModalOpen(false)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  batchSelectedDates.length === 0 || batchSelectedSlots.length === 0 || saving
                }
                onClick={handleApplyBatchDates}
                className="px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-[#1E5AFF] text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Save {batchSelectedSlots.length} Time Slot
                {batchSelectedSlots.length === 1 ? '' : 's'} to {batchSelectedDates.length} Date
                {batchSelectedDates.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Mobile Save Bar for On-The-Go Doctors */}
      {draftSelectedSlots.length > 0 && !selectedDateOverride && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl sm:hidden flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#060C16] truncate">
              {selectedCalendarDate}
            </div>
            <div className="text-[11px] text-slate-500">
              {draftSelectedSlots.length} time slot{draftSelectedSlots.length === 1 ? '' : 's'} selected
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleAddAvailabilityForSelectedDate(true)}
            disabled={saving}
            className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-[#1E5AFF] text-white hover:bg-blue-700 disabled:opacity-50 shrink-0 shadow-md flex items-center gap-1.5 cursor-pointer touch-manipulation active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Slots</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DoctorAvailabilityManager;
