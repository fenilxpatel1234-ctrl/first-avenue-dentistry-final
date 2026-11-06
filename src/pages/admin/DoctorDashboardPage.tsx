import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  LogOut,
  Stethoscope,
  Users,
  Search,
  Home,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { formatPortalGreeting } from '../../lib/greeting';
import {
  subscribeToDoctors,
  subscribeToAppointments,
  subscribeToDoctorAvailabilities,
  seedInitialClinicalDataIfEmpty,
} from '../../lib/firestoreService';
import type { Doctor, Appointment } from '../../types/admin';
import {
  DoctorAvailabilityRecord,
  DateSpecificAvailability,
  DAY_NAMES,
} from '../../types/scheduling';
import { DoctorAvailabilityManager } from '../../components/DoctorAvailabilityManager';

interface DoctorDashboardPageProps {
  onNavigateHome?: () => void;
  onNavigateToPublic?: () => void;
  onNavigateToLogin: () => void;
  onNavigateToAdmin?: () => void;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getEffectiveDate(apt: Appointment): string {
  const st = String(apt.status || '').toLowerCase();
  if (st === 'approved' || st === 'rescheduled') {
    return apt.confirmedDate || apt.preferredDate || '';
  }
  return apt.preferredDate || apt.confirmedDate || '';
}

function getEffectiveTime(apt: Appointment): string {
  const raw = apt as any;
  const st = String(apt.status || '').toLowerCase();
  if (st === 'approved' || st === 'rescheduled') {
    return apt.confirmedTime || raw.preferredTimeSlot || apt.preferredTime || '';
  }
  return raw.preferredTimeSlot || apt.preferredTime || apt.confirmedTime || '';
}

/**
 * Computes a doctor's configured working hours and available time slots on a specific date
 * (Read-only helper so any doctor can see which doctor is available on that day & at what times)
 */
function getDoctorScheduleForDate(
  doc: Doctor,
  avail: DoctorAvailabilityRecord | undefined,
  dateStr: string,
  allAppointments: Appointment[]
): {
  isAvailable: boolean;
  workingHoursLabel: string;
  slotDuration: number;
  allConfiguredSlots: string[];
  availableSlots: string[];
  bookedSlots: string[];
  upcomingDatesSummary: Array<{ date: string; hours: string; slotCount: number }>;
} {
  if (!avail) {
    return {
      isAvailable: false,
      workingHoursLabel: 'No availability added',
      slotDuration: 30,
      allConfiguredSlots: [],
      availableSlots: [],
      bookedSlots: [],
      upcomingDatesSummary: [],
    };
  }

  const specMap: Record<string, DateSpecificAvailability> = {};
  if (Array.isArray(avail.specificDates)) {
    for (const d of avail.specificDates) {
      if (d && d.date) specMap[d.date] = d;
    }
  } else if (avail.specificDates && typeof avail.specificDates === 'object') {
    for (const [k, d] of Object.entries(avail.specificDates)) {
      if (d) specMap[d.date || k] = d;
    }
  }

  const todayKey = toDateKey(new Date());
  const upcomingDatesSummary = Object.values(specMap)
    .filter((d) => {
      const enabled = d.enabled !== undefined ? Boolean(d.enabled) : d.isAvailable !== false;
      return enabled && Array.isArray(d.slots) && d.slots.length > 0 && d.date >= todayKey;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)
    .map((d) => ({
      date: d.date,
      hours: `${d.startTime} – ${d.endTime}`,
      slotCount: d.slots.length,
    }));

  // 1. Check specific date override first
  const spec = specMap[dateStr];
  let configuredSlots: string[] = [];
  let workingHoursLabel = 'Not Available';
  let slotDuration = avail.defaultDuration || 30;

  if (spec) {
    const enabled = spec.enabled !== undefined ? Boolean(spec.enabled) : spec.isAvailable !== false;
    if (enabled && Array.isArray(spec.slots) && spec.slots.length > 0) {
      configuredSlots = spec.slots;
      workingHoursLabel = `${spec.startTime} – ${spec.endTime}`;
      slotDuration = spec.slotDuration || slotDuration;
    }
  } else {
    // 2. Check recurring weekly schedule
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y && m && d) {
      const dow = new Date(y, m - 1, d).getDay();
      const weeklyList = avail.weeklySchedule || avail.recurringWeekly || [];
      const dayCfg = weeklyList.find((w) => w.dayOfWeek === dow);
      if (dayCfg && dayCfg.enabled && Array.isArray(dayCfg.slots) && dayCfg.slots.length > 0) {
        configuredSlots = dayCfg.slots;
        workingHoursLabel = `${dayCfg.startTime} – ${dayCfg.endTime} (${dayCfg.dayName})`;
        slotDuration = dayCfg.slotDuration || slotDuration;
      }
    }
  }

  if (configuredSlots.length === 0) {
    return {
      isAvailable: false,
      workingHoursLabel: 'Not Available on this date',
      slotDuration,
      allConfiguredSlots: [],
      availableSlots: [],
      bookedSlots: [],
      upcomingDatesSummary,
    };
  }

  // Filter out slots already booked/reserved for this doctor on this date
  const docNameLower = doc.name.trim().toLowerCase();
  const docIdLower = doc.id.trim().toLowerCase();

  const bookedTimesLower = new Set<string>();
  for (const apt of allAppointments) {
    const rawApt = apt as any;
    const st = String(apt.status || '').toLowerCase();
    if (st !== 'pending' && st !== 'approved' && st !== 'rescheduled') continue;

    const matchesDoc =
      (apt.doctorId && apt.doctorId.trim().toLowerCase() === docIdLower) ||
      (apt.assignedDoctor && apt.assignedDoctor.trim().toLowerCase() === docNameLower) ||
      (rawApt.doctorPreference && String(rawApt.doctorPreference).trim().toLowerCase() === docNameLower);

    if (!matchesDoc) continue;
    if (getEffectiveDate(apt) === dateStr) {
      bookedTimesLower.add(getEffectiveTime(apt).trim().toLowerCase());
    }
  }

  const availableSlots: string[] = [];
  const bookedSlots: string[] = [];
  for (const s of configuredSlots) {
    if (bookedTimesLower.has(s.trim().toLowerCase())) {
      bookedSlots.push(s);
    } else {
      availableSlots.push(s);
    }
  }

  return {
    isAvailable: availableSlots.length > 0,
    workingHoursLabel,
    slotDuration,
    allConfiguredSlots: configuredSlots,
    availableSlots,
    bookedSlots,
    upcomingDatesSummary,
  };
}

export const DoctorDashboardPage: React.FC<DoctorDashboardPageProps> = ({
  onNavigateHome,
  onNavigateToPublic,
  onNavigateToLogin,
}) => {
  const handleGoHome = () => {
    if (onNavigateToPublic) onNavigateToPublic();
    else if (onNavigateHome) onNavigateHome();
  };
  const { user, loading: authLoading, signOut } = useAdminAuth();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availabilities, setAvailabilities] = useState<DoctorAvailabilityRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'availability' | 'clinic_schedule' | 'appointments'>(
    'availability'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<string>('all');

  // Date selector for viewing which doctors are available on a given day
  const [scheduleViewDate, setScheduleViewDate] = useState<string>(() => toDateKey(new Date()));
  const [doctorFilterQuery, setDoctorFilterQuery] = useState<string>('');

  // Redirect unauthenticated users or non-Doctor admin sessions to Doctor Portal login
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        onNavigateToLogin();
        return;
      }
      const role = String((user as any).role || '').trim().toLowerCase();
      const isDoc =
        role === 'doctor' ||
        role.includes('specialist') ||
        (Boolean((user as any).doctorId) &&
          role !== 'super admin' &&
          role !== 'clinic admin');
      if (!isDoc) {
        onNavigateToLogin();
        return;
      }
    }
  }, [user, authLoading, onNavigateToLogin]);

  // 5-Minute Inactivity Auto-Logout Security Guard (matches Admin Portal security)
  useEffect(() => {
    if (!user) return;
    const IDLE_LIMIT_MS = 5 * 60 * 1000;
    let lastActivity = Date.now();

    const onUserActivity = () => {
      lastActivity = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      if (Date.now() - lastActivity >= IDLE_LIMIT_MS) {
        clearInterval(checkInterval);
        signOut().then(() => {
          onNavigateToLogin();
        });
      }
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      clearInterval(checkInterval);
    };
  }, [user, signOut, onNavigateToLogin]);

  // Subscribe to real-time doctors, availabilities, and appointments
  useEffect(() => {
    seedInitialClinicalDataIfEmpty();

    const unsubDocs = subscribeToDoctors((docs) => {
      setDoctors(docs);
    });
    const unsubAvails = subscribeToDoctorAvailabilities((avails) => {
      setAvailabilities(avails);
    });
    const unsubApts = subscribeToAppointments((apts) => {
      setAppointments(apts);
    });

    return () => {
      unsubDocs();
      unsubAvails();
      unsubApts();
    };
  }, []);

  const sessionDoctorId = (user as any)?.doctorId as string | undefined;
  const sessionUserName =
    ((user as any)?.name as string | undefined) ||
    ((user as any)?.displayName as string | undefined) ||
    '';

  // Lock selectedDoctorId to the logged-in doctor's profile
  useEffect(() => {
    if (doctors.length === 0) return;
    if (sessionDoctorId && doctors.some((d) => d.id === sessionDoctorId)) {
      setSelectedDoctorId(sessionDoctorId);
      return;
    }
    if (sessionUserName) {
      const byName = doctors.find(
        (d) =>
          d.name.toLowerCase().includes(sessionUserName.toLowerCase()) ||
          sessionUserName.toLowerCase().includes(d.name.toLowerCase())
      );
      if (byName) {
        setSelectedDoctorId(byName.id);
        return;
      }
    }
    if (!selectedDoctorId) {
      setSelectedDoctorId(doctors[0].id);
    }
  }, [doctors, sessionDoctorId, sessionUserName, selectedDoctorId]);

  const activeDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId) || doctors[0] || null,
    [doctors, selectedDoctorId]
  );

  // Filter appointments exclusively for the logged-in doctor
  const doctorAppointments = useMemo(() => {
    if (!activeDoctor) return [];
    const docNameLower = activeDoctor.name.trim().toLowerCase();
    const docIdLower = activeDoctor.id.trim().toLowerCase();

    return appointments.filter((apt) => {
      const rawApt = apt as any;
      const matchesDoc =
        (apt.doctorId && apt.doctorId.trim().toLowerCase() === docIdLower) ||
        (apt.assignedDoctor && apt.assignedDoctor.trim().toLowerCase() === docNameLower) ||
        (rawApt.doctorPreference && String(rawApt.doctorPreference).trim().toLowerCase() === docNameLower);

      if (!matchesDoc) return false;

      const st = String(apt.status || 'pending').toLowerCase();
      if (appointmentStatusFilter !== 'all' && st !== appointmentStatusFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          (apt.name || '').toLowerCase().includes(q) ||
          (apt.email || '').toLowerCase().includes(q) ||
          (apt.phone || '').toLowerCase().includes(q) ||
          (String(rawApt.serviceName || apt.service || '')).toLowerCase().includes(q) ||
          getEffectiveDate(apt).includes(q)
        );
      }
      return true;
    });
  }, [appointments, activeDoctor, searchTerm, appointmentStatusFilter]);

  // Quick upcoming 14 days for the Clinic Doctors Schedule date bar
  const quickScheduleDates = useMemo(() => {
    const list: Array<{ dateKey: string; dayShort: string; dayNum: string; monthShort: string }> =
      [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push({
        dateKey: toDateKey(d),
        dayShort: i === 0 ? 'Today' : DAY_NAMES[d.getDay()].slice(0, 3),
        dayNum: String(d.getDate()),
        monthShort: d.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return list;
  }, []);

  // Read-only schedule cards for all clinic doctors (including any doctor added by Admin)
  const clinicDoctorsScheduleOnSelectedDate = useMemo(() => {
    return doctors
      .filter((doc) => {
        if (!doctorFilterQuery.trim()) return true;
        const q = doctorFilterQuery.toLowerCase();
        return (
          doc.name.toLowerCase().includes(q) ||
          (doc.title || '').toLowerCase().includes(q) ||
          (Array.isArray(doc.specialties) &&
            doc.specialties.some((s: string) => s.toLowerCase().includes(q)))
        );
      })
      .map((doc) => {
        const avail = availabilities.find(
          (a) =>
            a.doctorId === doc.id ||
            a.doctorName.trim().toLowerCase() === doc.name.trim().toLowerCase()
        );
        const schedule = getDoctorScheduleForDate(doc, avail, scheduleViewDate, appointments);
        return {
          doctor: doc,
          isSelf: activeDoctor?.id === doc.id,
          ...schedule,
        };
      });
  }, [doctors, availabilities, scheduleViewDate, appointments, activeDoctor?.id, doctorFilterQuery]);

  const availableDoctorsCountOnSelectedDate = useMemo(
    () => clinicDoctorsScheduleOnSelectedDate.filter((d) => d.isAvailable).length,
    [clinicDoctorsScheduleOnSelectedDate]
  );

  const shiftScheduleDate = (deltaDays: number) => {
    const [y, m, d] = scheduleViewDate.split('-').map(Number);
    const dt = y && m && d ? new Date(y, m - 1, d) : new Date();
    dt.setDate(dt.getDate() + deltaDays);
    setScheduleViewDate(toDateKey(dt));
  };

  const doctorGreeting = formatPortalGreeting(
    activeDoctor ? activeDoctor.name : sessionUserName || 'Doctor',
    'doctor'
  );
  const GreetingIcon =
    doctorGreeting.period === 'morning'
      ? Sun
      : doctorGreeting.period === 'afternoon'
      ? Sunset
      : Moon;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* Clean Responsive Top Header */}
      <header className="sticky top-0 z-30 bg-[#060C16] text-white border-b border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1E5AFF] flex items-center justify-center shrink-0 shadow-xs">
              <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
                <span className="truncate">First Avenue Dentistry</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-semibold whitespace-nowrap">Doctor Portal</span>
              </div>
              <h1 className="text-xs sm:text-base font-bold tracking-tight truncate flex items-center gap-1.5">
                <GreetingIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{doctorGreeting.fullGreeting}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleGoHome}
              className="px-2.5 sm:px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Return to Clinic Public Site"
            >
              <Home className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Website</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await signOut();
                onNavigateToLogin();
              }}
              className="px-3 sm:px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Sign Out of Doctor Portal"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-5">
        {/* Logged-In Doctor Summary + Responsive Navigation Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#060C16] text-white flex items-center justify-center font-bold text-base sm:text-lg shrink-0 shadow-xs">
                {activeDoctor ? (activeDoctor.name || 'D').replace(/^Dr\.\s*/i, '').charAt(0) || 'D' : 'D'}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500">
                  <span className="font-semibold text-[#1E5AFF] truncate max-w-[200px]">
                    {activeDoctor?.title || 'Dental Specialist'}
                  </span>
                </div>
                <h2 className="text-sm sm:text-lg font-bold text-[#060C16] truncate">
                  {doctorGreeting.fullGreeting}
                </h2>
              </div>
            </div>

            {/* Responsive Navigation Tabs (Optimized for Phone, Tablet & Desktop) */}
            <div className="flex items-center overflow-x-auto no-scrollbar gap-1 sm:gap-1.5 bg-slate-100 p-1 sm:p-1.5 rounded-xl w-full md:w-auto -mx-1 px-1 sm:mx-0">
              <button
                type="button"
                onClick={() => setActiveTab('availability')}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 min-h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'availability'
                    ? 'bg-[#060C16] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#060C16] hover:bg-slate-200/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>My Availability</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('clinic_schedule')}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 min-h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'clinic_schedule'
                    ? 'bg-[#060C16] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#060C16] hover:bg-slate-200/60'
                }`}
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>Doctors ({availableDoctorsCountOnSelectedDate})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('appointments')}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 min-h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'appointments'
                    ? 'bg-[#060C16] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#060C16] hover:bg-slate-200/60'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Appointments ({doctorAppointments.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: MANAGE MY AVAILABILITY (Own Schedule + Quick View of Other Doctors Available Today) */}
        {activeTab === 'availability' && (
          <div className="space-y-6">
            <DoctorAvailabilityManager
              doctors={doctors}
              availabilities={availabilities}
              selectedDoctorId={selectedDoctorId}
              onSelectDoctor={setSelectedDoctorId}
              allowDoctorSwitch={false}
              actorEmail={user?.email || activeDoctor?.email}
            />

            {/* Compact Read-Only Section: Which Other Doctors Are Available on Selected Day & Time */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-[#060C16]">
                    Doctors Available on {scheduleViewDate}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Schedule overview of all clinic doctors and their available times.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={scheduleViewDate}
                    onChange={(e) => {
                      if (e.target.value) setScheduleViewDate(e.target.value);
                    }}
                    className="px-3 py-2 min-h-[42px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveTab('clinic_schedule')}
                    className="px-3.5 py-2 min-h-[42px] rounded-xl text-xs font-bold text-[#1E5AFF] bg-blue-50 hover:bg-blue-100 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Full Schedule View →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
                {clinicDoctorsScheduleOnSelectedDate.map((item) => (
                  <div
                    key={item.doctor.id}
                    className={`rounded-xl border p-4 transition-all ${
                      item.isAvailable
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-slate-50/70 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-[#060C16] truncate">
                            {item.doctor.name}
                          </h4>
                          {item.isSelf && (
                            <span className="text-[10px] font-bold text-[#1E5AFF]">(You)</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{item.doctor.title}</p>
                      </div>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          item.isAvailable ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {item.isAvailable ? 'Available' : 'Not Available'}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-[#1E5AFF] shrink-0" />
                        <span>{item.workingHoursLabel}</span>
                      </div>

                      {item.isAvailable ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.availableSlots.map((slot) => (
                            <span
                              key={slot}
                              className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-[11px] font-bold text-emerald-800"
                            >
                              {slot}
                            </span>
                          ))}
                        </div>
                      ) : item.upcomingDatesSummary.length > 0 ? (
                        <div className="mt-2 text-[11px] text-slate-600">
                          <span className="font-bold text-slate-700">Next available: </span>
                          {item.upcomingDatesSummary.slice(0, 2).map((u, idx) => (
                            <button
                              key={u.date}
                              type="button"
                              onClick={() => setScheduleViewDate(u.date)}
                              className="text-[#1E5AFF] font-bold hover:underline mr-2 cursor-pointer"
                            >
                              {u.date} ({u.hours}){idx === 0 && item.upcomingDatesSummary.length > 1 ? ',' : ''}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          Doctor has not added available dates yet.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLINIC DOCTORS SCHEDULE (READ-ONLY VIEW OF WHICH DOCTOR IS AVAILABLE ON THAT DAY & TIME) */}
        {activeTab === 'clinic_schedule' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Date Picker & Filter Header */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#060C16]">
                    Doctors Available on {scheduleViewDate}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    See which doctors are available on any day and their available time slots.
                  </p>
                </div>

                {/* Date Controls & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => shiftScheduleDate(-1)}
                      className="p-2.5 min-w-[42px] min-h-[42px] rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                      aria-label="Previous day"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <input
                      type="date"
                      value={scheduleViewDate}
                      onChange={(e) => {
                        if (e.target.value) setScheduleViewDate(e.target.value);
                      }}
                      className="flex-1 sm:flex-initial px-3.5 py-2 min-h-[42px] rounded-xl border border-slate-200 text-xs font-bold text-[#060C16] bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => shiftScheduleDate(1)}
                      className="p-2.5 min-w-[42px] min-h-[42px] rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                      aria-label="Next day"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={doctorFilterQuery}
                      onChange={(e) => setDoctorFilterQuery(e.target.value)}
                      placeholder="Filter doctor by name..."
                      className="w-full sm:w-52 pl-9 pr-3 py-2 min-h-[42px] rounded-xl border border-slate-200 text-xs font-medium bg-slate-50 focus:bg-white focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>
                </div>
              </div>

              {/* Horizontal Quick Date Strip (14 Days) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-t border-slate-100">
                {quickScheduleDates.map((d) => {
                  const isSelected = d.dateKey === scheduleViewDate;
                  return (
                    <button
                      key={d.dateKey}
                      type="button"
                      onClick={() => setScheduleViewDate(d.dateKey)}
                      className={`px-3 py-2 min-w-[68px] min-h-[54px] rounded-xl border text-center transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase opacity-80">{d.dayShort}</div>
                      <div className="text-xs font-bold mt-0.5">
                        {d.monthShort} {d.dayNum}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Doctors Availability Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clinicDoctorsScheduleOnSelectedDate.map((item) => (
                <div
                  key={item.doctor.id}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all ${
                    item.isAvailable ? 'border-emerald-300' : 'border-slate-200/90'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            item.isAvailable
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {(item.doctor.name || 'D').replace(/^Dr\.\s*/i, '').charAt(0) || 'D'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-[#060C16] truncate">
                              {item.doctor.name}
                            </h3>
                            {item.isSelf && (
                              <span className="text-xs font-bold text-[#1E5AFF]">(You)</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {item.doctor.title}
                            {Array.isArray(item.doctor.specialties) &&
                            item.doctor.specialties.length > 0
                              ? ` · ${item.doctor.specialties.slice(0, 2).join(', ')}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold ${
                            item.isAvailable ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {item.isAvailable ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Available</span>
                            </>
                          ) : (
                            <span>Not Available</span>
                          )}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {item.slotDuration} min slots
                        </p>
                      </div>
                    </div>

                    {/* Working Hours & Available Time Slots on Selected Date */}
                    <div className="py-3.5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">
                          Working Hours ({scheduleViewDate}):
                        </span>
                        <span className="font-bold text-[#060C16]">{item.workingHoursLabel}</span>
                      </div>

                      {item.isAvailable ? (
                        <div>
                          <p className="text-xs font-bold text-emerald-800 mb-2">
                            Available Time Slots ({item.availableSlots.length} open
                            {item.bookedSlots.length > 0
                              ? ` · ${item.bookedSlots.length} booked`
                              : ''}
                            ):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.availableSlots.map((slot) => (
                              <span
                                key={slot}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900"
                              >
                                {slot}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-xs text-slate-500">
                          {item.allConfiguredSlots.length > 0
                            ? 'All configured time slots on this date are currently booked.'
                            : 'No working hours or time slots configured for this date.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upcoming Available Dates for this Doctor */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    {item.upcomingDatesSummary.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">Upcoming dates:</span>
                        {item.upcomingDatesSummary.map((u) => (
                          <button
                            key={u.date}
                            type="button"
                            onClick={() => setScheduleViewDate(u.date)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                              u.date === scheduleViewDate
                                ? 'bg-[#1E5AFF] text-white border-[#1E5AFF]'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#1E5AFF]'
                            }`}
                          >
                            {u.date} ({u.hours})
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        No custom dates added yet
                      </span>
                    )}

                    {item.isSelf && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('availability')}
                        className="text-xs font-bold text-[#1E5AFF] hover:underline shrink-0 cursor-pointer"
                      >
                        Edit My Schedule →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MY ASSIGNED PATIENT APPOINTMENTS (Responsive Mobile Cards + Desktop Table) */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#060C16]">
                  My Patient Appointments — {activeDoctor?.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing appointments booked specifically with {activeDoctor?.name}.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                  {(['all', 'pending', 'approved', 'rescheduled', 'declined'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAppointmentStatusFilter(st)}
                      className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                        appointmentStatusFilter === st
                          ? 'bg-[#1E5AFF] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search patient, date..."
                    className="w-full pl-9 pr-4 py-2 min-h-[42px] rounded-xl border border-slate-200 text-xs font-medium bg-slate-50 focus:bg-white focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>
              </div>
            </div>

            {doctorAppointments.length === 0 ? (
              <div className="p-10 text-center">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-[#060C16]">
                  No Appointments Found for {activeDoctor?.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  When patients book an appointment with {activeDoctor?.name}, it will appear here automatically.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile & Tablet Card List */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {doctorAppointments.map((apt) => {
                    const rawApt = apt as any;
                    const st = String(apt.status || 'pending').toUpperCase();
                    const effDate = getEffectiveDate(apt);
                    const effTime = getEffectiveTime(apt);
                    return (
                      <div key={apt.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-[#060C16]">{apt.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {rawApt.serviceName || apt.service || apt.reason || 'Consultation'}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                              st === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : st === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : st === 'RESCHEDULED'
                                ? 'bg-blue-50 text-[#1E5AFF] border border-blue-200'
                                : 'bg-red-50 text-red-600 border border-red-200'
                            }`}
                          >
                            {st}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                          <span className="inline-flex items-center gap-1 font-bold">
                            <Calendar className="w-3.5 h-3.5 text-[#1E5AFF]" />
                            {effDate}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1 font-bold">
                            <Clock className="w-3.5 h-3.5 text-[#1E5AFF]" />
                            {effTime}
                          </span>
                        </div>

                        {/* Direct 1-Tap Mobile Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {apt.phone && (
                            <a
                              href={`tel:${apt.phone}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-[#060C16] text-xs font-bold transition-colors active:scale-95"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#1E5AFF]" />
                              <span>{apt.phone}</span>
                            </a>
                          )}
                          {apt.email && (
                            <a
                              href={`mailto:${apt.email}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-[#060C16] text-xs font-bold transition-colors active:scale-95"
                            >
                              <Mail className="w-3.5 h-3.5 text-[#1E5AFF]" />
                              <span className="truncate max-w-[180px]">{apt.email}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 px-5">Patient</th>
                        <th className="py-3.5 px-5">Appointment Date &amp; Time</th>
                        <th className="py-3.5 px-5">Reason / Service</th>
                        <th className="py-3.5 px-5">Status</th>
                        <th className="py-3.5 px-5">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {doctorAppointments.map((apt) => {
                        const rawApt = apt as any;
                        const st = String(apt.status || 'pending').toUpperCase();
                        const effDate = getEffectiveDate(apt);
                        const effTime = getEffectiveTime(apt);
                        return (
                          <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-5">
                              <div className="font-bold text-[#060C16] text-sm">{apt.name}</div>
                              <div className="text-slate-500 flex items-center gap-3 mt-1">
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="w-3 h-3" /> {apt.email}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {apt.phone}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <div className="font-bold text-[#060C16] flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[#1E5AFF]" />
                                <span>{effDate}</span>
                              </div>
                              <div className="text-slate-600 font-semibold flex items-center gap-1.5 mt-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{effTime}</span>
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <div className="font-semibold text-slate-800">
                                {rawApt.serviceName || apt.service || 'Dental Consultation'}
                              </div>
                              {apt.notes && (
                                <p className="text-slate-500 mt-0.5 line-clamp-1 max-w-xs">
                                  {apt.notes}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-5">
                              <span
                                className={`font-bold ${
                                  st === 'APPROVED'
                                    ? 'text-emerald-700'
                                    : st === 'PENDING'
                                    ? 'text-amber-700'
                                    : st === 'RESCHEDULED'
                                    ? 'text-[#1E5AFF]'
                                    : 'text-red-600'
                                }`}
                              >
                                {st}
                              </span>
                            </td>
                            <td className="py-4 px-5 text-slate-500">
                              {apt.createdAt ? new Date(apt.createdAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default DoctorDashboardPage;
