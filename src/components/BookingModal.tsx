import { useState, useEffect, useId, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Calendar as CalendarIcon,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  UserCheck,
  UserPlus,
  Mail,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Stethoscope,
  Download,
  CalendarCheck,
  KeyRound,
  RefreshCw,
  Lock,
  Timer,
  FileText,
  Copy,
  Check,
  Users,
  Edit2,
} from "lucide-react";
import {
  submitAppointmentRequest,
  subscribeToAppointments,
  subscribeToDoctors,
  subscribeToDoctorAvailabilities,
  subscribeToBookingServices,
  subscribeToRealtimeClinicEvents,
  fetchDoctorDateSlotStatuses,
  lockTemporarySlotReservation,
  releaseTemporarySlotReservation,
} from "../lib/firestoreService";
import type { Appointment, Doctor } from "../types/admin";
import {
  DoctorAvailabilityRecord,
  ComputedTimeSlot,
  TemporarySlotReservation,
  BookingServiceItem,
  DEFAULT_BOOKING_SERVICES,
  normalizeServiceKey,
  getConfiguredDoctorSlotsForDate,
} from "../types/scheduling";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialService?: string;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeSlotTo24h(slot: string): string {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(String(slot).trim());
  if (!m) return "09:00";
  let h = parseInt(m[1], 10);
  const min = m[2] ? m[2].padStart(2, "0") : "00";
  if ((m[3] || "").toUpperCase() === "PM" && h < 12) h += 12;
  if ((m[3] || "").toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim());
}

function buildGoogleCalendarLink(apt: {
  service: string;
  doctor: string;
  date: string;
  time: string;
}) {
  const cleanDate = (apt.date || "").replace(/-/g, "");
  const time24 = timeSlotTo24h(apt.time).replace(":", "");
  const startStr = `${cleanDate}T${time24}00`;
  const [sh, sm] = timeSlotTo24h(apt.time).split(":").map(Number);
  const endMin = (sh * 60 + sm + 30) % 1440;
  const endH = String(Math.floor(endMin / 60)).padStart(2, "0");
  const endM = String(endMin % 60).padStart(2, "0");
  const endStr = `${cleanDate}T${endH}${endM}00`;

  const title = encodeURIComponent(`Dental Visit: ${apt.service} - First Avenue Dentistry`);
  const details = encodeURIComponent(
    `Dental appointment for ${apt.service} with ${apt.doctor}.\nLocation: 308 Wellington Street, St. Thomas, ON N5R 2S9\nPhone: (519) 207-6890`
  );
  const location = encodeURIComponent("308 Wellington Street, St. Thomas, ON N5R 2S9");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
}

function downloadIcsInvite(apt: {
  service: string;
  doctor: string;
  date: string;
  time: string;
  patientName: string;
}) {
  const cleanDate = (apt.date || "").replace(/-/g, "");
  const time24 = timeSlotTo24h(apt.time).replace(":", "");
  const [sh, sm] = timeSlotTo24h(apt.time).split(":").map(Number);
  const endMin = (sh * 60 + sm + 30) % 1440;
  const endH = String(Math.floor(endMin / 60)).padStart(2, "0");
  const endM = String(endMin % 60).padStart(2, "0");
  const endStr = `${cleanDate}T${endH}${endM}00`;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//First Avenue Dentistry//Appointment Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `SUMMARY:Dental Visit: ${apt.service} - First Avenue Dentistry`,
    `DESCRIPTION:Patient: ${apt.patientName}\\nSpecialist: ${apt.doctor}\\nPhone: (519) 207-6890\\nAddress: 308 Wellington St, St. Thomas ON`,
    "LOCATION:308 Wellington Street, St. Thomas, ON N5R 2S9",
    `DTSTART:${cleanDate}T${time24}00`,
    `DTEND:${endStr}`,
    "STATUS:TENTATIVE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FirstAvenueDentistry-${cleanDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getOrCreatePatientSessionId(): string {
  try {
    const existing = sessionStorage.getItem("fad_booking_session_id");
    if (existing) return existing;
    const generated = `SESS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("fad_booking_session_id", generated);
    return generated;
  } catch {
    return `SESS-${Date.now()}`;
  }
}

type BookingStep = 1 | 2 | 3 | 4 | 5;

const stepSlideVariants = {
  initial: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? 24 : -24,
    y: 4,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.28,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -24 : 24,
    y: -4,
    transition: {
      duration: 0.18,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

export default function BookingModal({
  isOpen,
  onClose,
  initialService,
}: BookingModalProps) {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const tomorrowStr = useMemo(() => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    return tm.toISOString().split("T")[0];
  }, []);
  const sessionId = useMemo(() => getOrCreatePatientSessionId(), []);
  const serviceSelectId = useId();

  // Steps:
  // 1 = Patient Type (New vs Returning + Email OTP Verification for Returning)
  // 2 = Choose Doctor, Date & Time Slot (5-min lock)
  // 3 = Patient Details (First Name, Last Name, Email, Phone - auto-filled if Returning)
  // 4 = Review Summary Before Submitting Request
  // 5 = Simple Confirmation Page
  const [step, setStep] = useState<BookingStep>(1);
  const [stepDirection, setStepDirection] = useState<number>(1);

  const navigateToStep = (target: BookingStep) => {
    setStepDirection(target >= step ? 1 : -1);
    setSubmitError(null);
    setStep(target);
  };

  // Live Database State
  const [liveDoctors, setLiveDoctors] = useState<Doctor[]>([]);
  const [bookingServices, setBookingServices] = useState<BookingServiceItem[]>(
    DEFAULT_BOOKING_SERVICES
  );
  const [availabilitiesMap, setAvailabilitiesMap] = useState<
    Record<string, DoctorAvailabilityRecord>
  >({});
  const [liveAppointments, setLiveAppointments] = useState<Appointment[]>([]);

  // Selected Doctor, Dropdown open state, Calendar Month & Date
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("any");
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState<boolean>(false);
  const doctorDropdownRef = useRef<HTMLDivElement | null>(null);

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Slots & Filter
  const [dateSlots, setDateSlots] = useState<ComputedTimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotTimeFilter, setSlotTimeFilter] = useState<"all" | "morning" | "afternoon">("all");

  // 5-Minute Temporary Reservation State
  const [activeReservation, setActiveReservation] =
    useState<TemporarySlotReservation | null>(null);
  const [reservationRemainingSeconds, setReservationRemainingSeconds] =
    useState<number>(0);
  const [isLockingSlot, setIsLockingSlot] = useState<boolean>(false);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);

  // Patient Form Data (Split into firstName & lastName + email & phone; service selected in Step 2)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    service: initialService || "",
    preferredTime: "",
    isNewPatient: true,
    notes: "",
  });

  // Step 1 Returning Patient Email Verification States
  const [lookupEmail, setLookupEmail] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Submission & Confirmation States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingRefId, setBookingRefId] = useState<string>("");
  const [copiedRef, setCopiedRef] = useState(false);

  // Close doctor dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        doctorDropdownRef.current &&
        !doctorDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDoctorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeReservation, step]);

  // Subscribe to Doctors, Availabilities, Appointments, and Booking Services
  useEffect(() => {
    const unsubDocs = subscribeToDoctors((docs) => {
      const active = docs.filter((d) => d.status === "active");
      setLiveDoctors(active);
    });

    const unsubAvail = subscribeToDoctorAvailabilities((records) => {
      const map: Record<string, DoctorAvailabilityRecord> = {};
      records.forEach((r) => {
        if (r && r.doctorId) map[r.doctorId] = r;
      });
      setAvailabilitiesMap(map);
    });

    const unsubApts = subscribeToAppointments((apts) => {
      setLiveAppointments(apts);
    });

    const unsubServices = subscribeToBookingServices((services) => {
      if (Array.isArray(services) && services.length > 0) {
        setBookingServices(services.filter((s) => s.isActive !== false));
      } else {
        setBookingServices(DEFAULT_BOOKING_SERVICES);
      }
    });

    return () => {
      unsubDocs();
      unsubAvail();
      unsubApts();
      unsubServices();
    };
  }, []);

  // Selected Booking Service Item
  const selectedServiceItem = useMemo(() => {
    if (!formData.service) return null;
    const norm = normalizeServiceKey(formData.service);
    return (
      bookingServices.find(
        (s) =>
          s.title === formData.service ||
          s.id === formData.service ||
          normalizeServiceKey(s.title) === norm ||
          normalizeServiceKey(s.id) === norm
      ) || null
    );
  }, [bookingServices, formData.service]);

  // Doctors eligible for the currently selected service
  const eligibleDoctors = useMemo(() => {
    if (
      selectedServiceItem &&
      Array.isArray(selectedServiceItem.allowedDoctorIds) &&
      selectedServiceItem.allowedDoctorIds.length > 0
    ) {
      const allowedSet = new Set(
        selectedServiceItem.allowedDoctorIds.map((id) => String(id).trim().toLowerCase())
      );
      const filtered = liveDoctors.filter(
        (d) =>
          allowedSet.has(d.id.toLowerCase()) ||
          allowedSet.has(d.name.trim().toLowerCase())
      );
      if (filtered.length > 0) return filtered;
    }
    return liveDoctors;
  }, [liveDoctors, selectedServiceItem]);

  // Ensure selectedDoctorId stays valid when service changes
  useEffect(() => {
    if (selectedDoctorId !== "any") {
      const stillEligible = eligibleDoctors.some((d) => d.id === selectedDoctorId);
      if (!stillEligible) {
        setSelectedDoctorId("any");
      }
    }
  }, [eligibleDoctors, selectedDoctorId]);

  const isAnyDoctor = selectedDoctorId === "any";

  const selectedDoctor = useMemo(() => {
    if (isAnyDoctor) {
      return {
        id: "any",
        name: "Any Available Doctor",
        title: "First Available Clinical Dentist",
        qualifications: "Licensed Clinical Specialist",
        specialties: ["General Dentistry", "Hygiene", "Emergency Care"],
        status: "active" as const,
      };
    }
    return (
      eligibleDoctors.find((d) => d.id === selectedDoctorId) ||
      eligibleDoctors[0] ||
      null
    );
  }, [isAnyDoctor, eligibleDoctors, selectedDoctorId]);

  const selectedDoctorAvailability = useMemo(
    () => (selectedDoctor && !isAnyDoctor ? availabilitiesMap[selectedDoctor.id] || null : null),
    [selectedDoctor, isAnyDoctor, availabilitiesMap]
  );

  // Filtered Slots
  const filteredDateSlots = useMemo(() => {
    if (slotTimeFilter === "all") return dateSlots;
    return dateSlots.filter((slot) => {
      const isPM = /PM/i.test(slot.time);
      const hour = parseInt(slot.time.split(":")[0], 10);
      const isNoon = hour === 12;

      if (slotTimeFilter === "morning") {
        return !isPM;
      }
      if (slotTimeFilter === "afternoon") {
        return isPM && (isNoon || hour >= 1);
      }
      return true;
    });
  }, [dateSlots, slotTimeFilter]);

  // Service-specific Date Summary Calculation
  const getDoctorDateSummary = useCallback(
    (doctorId: string, dateStr: string) => {
      if (dateStr < todayStr || !formData.service) {
        return { configuredCount: 0, bookedCount: 0, availableCount: 0 };
      }

      if (doctorId === "any") {
        let totalConfigured = 0;
        let totalAvailable = 0;

        for (const doc of eligibleDoctors) {
          const availRec = availabilitiesMap[doc.id];
          const configuredSlots = getConfiguredDoctorSlotsForDate(
            availRec,
            dateStr,
            formData.service
          );
          if (configuredSlots.length === 0) continue;

          totalConfigured += configuredSlots.length;
          const bookedTimes = new Set(
            liveAppointments
              .filter((a) => {
                if (a.status !== "pending" && a.status !== "approved" && a.status !== "rescheduled") {
                  return false;
                }
                const matchesDoc =
                  a.doctorId === doc.id ||
                  String(a.assignedDoctor || "").toLowerCase() === doc.name.toLowerCase();
                if (!matchesDoc) return false;
                const effDate = a.confirmedDate || a.preferredDate;
                return effDate === dateStr;
              })
              .map((a) => a.confirmedTime || a.preferredTime)
          );

          const openCount = configuredSlots.filter((s) => !bookedTimes.has(s)).length;
          totalAvailable += openCount;
        }

        return {
          configuredCount: totalConfigured,
          bookedCount: totalConfigured - totalAvailable,
          availableCount: totalAvailable,
        };
      }

      const docObj = eligibleDoctors.find((d) => d.id === doctorId);
      if (!docObj) {
        return { configuredCount: 0, bookedCount: 0, availableCount: 0 };
      }
      const docName = docObj.name || "";
      const availRec = availabilitiesMap[doctorId];
      const configuredSlots = getConfiguredDoctorSlotsForDate(
        availRec,
        dateStr,
        formData.service
      );
      if (configuredSlots.length === 0) {
        return { configuredCount: 0, bookedCount: 0, availableCount: 0 };
      }

      const bookedTimes = new Set(
        liveAppointments
          .filter((a) => {
            if (a.status !== "pending" && a.status !== "approved" && a.status !== "rescheduled") {
              return false;
            }
            const matchesDoc =
              a.doctorId === doctorId ||
              String(a.assignedDoctor || "").toLowerCase() === docName.toLowerCase();
            if (!matchesDoc) return false;
            const effDate = a.confirmedDate || a.preferredDate;
            return effDate === dateStr;
          })
          .map((a) => a.confirmedTime || a.preferredTime)
      );

      const availableCount = configuredSlots.filter((s) => !bookedTimes.has(s)).length;
      return {
        configuredCount: configuredSlots.length,
        bookedCount: bookedTimes.size,
        availableCount,
      };
    },
    [availabilitiesMap, liveAppointments, eligibleDoctors, todayStr, formData.service]
  );

  // Next available date for the chosen service & doctor
  const nextAvailableDateStr = useMemo(() => {
    if (!formData.service) return todayStr;
    const base = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      const sum = getDoctorDateSummary(selectedDoctorId, dateStr);
      if (sum.availableCount > 0) {
        return dateStr;
      }
    }
    return todayStr;
  }, [selectedDoctorId, getDoctorDateSummary, todayStr, formData.service]);

  // Auto-select earliest available date whenever service or doctor changes
  useEffect(() => {
    if (!formData.service) return;
    if (selectedDate && selectedDate >= todayStr) {
      const check = getDoctorDateSummary(selectedDoctorId, selectedDate);
      if (check.availableCount > 0) return;
    }

    if (nextAvailableDateStr) {
      setSelectedDate(nextAvailableDateStr);
      const [y, m] = nextAvailableDateStr.split("-").map(Number);
      setCalendarMonth(new Date(y, m - 1, 1));
    }
  }, [
    selectedDoctorId,
    formData.service,
    nextAvailableDateStr,
    getDoctorDateSummary,
    selectedDate,
    todayStr,
  ]);

  // Fetch live slot statuses for the chosen service, doctor, and date
  const refreshDateSlots = useCallback(async () => {
    if (!selectedDate || !formData.service) {
      setDateSlots([]);
      return;
    }
    setLoadingSlots(true);
    try {
      const targetId = isAnyDoctor ? "any" : selectedDoctor?.id || "any";
      const res = await fetchDoctorDateSlotStatuses(
        targetId,
        selectedDate,
        sessionId,
        formData.service
      );
      setDateSlots(res.slots || []);
    } catch {
      setDateSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDoctor?.id, isAnyDoctor, selectedDate, sessionId, formData.service]);

  useEffect(() => {
    if (isOpen && selectedDate && formData.service) {
      refreshDateSlots();
    } else if (!formData.service) {
      setDateSlots([]);
    }
  }, [isOpen, selectedDoctorId, selectedDate, formData.service, refreshDateSlots]);

  // Real-time SSE listener
  useEffect(() => {
    if (!isOpen) return;
    const unsubSSE = subscribeToRealtimeClinicEvents((ev) => {
      if (
        ev.type === "availability_updated" ||
        ev.type === "booking_services_updated" ||
        ev.type === "reservation_locked" ||
        ev.type === "reservation_released" ||
        ev.type === "reservations_expired" ||
        ev.type === "appointment_created" ||
        ev.type === "appointment_updated" ||
        ev.type === "appointment_deleted"
      ) {
        refreshDateSlots();
      }
    });
    return () => unsubSSE();
  }, [isOpen, refreshDateSlots]);

  // 5-Minute Reservation Countdown
  useEffect(() => {
    if (!activeReservation) {
      setReservationRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((activeReservation.expiresAtMs - Date.now()) / 1000)
      );
      setReservationRemainingSeconds(remaining);

      if (remaining <= 0) {
        const expiredResId = activeReservation.id;
        setActiveReservation(null);
        setFormData((prev) => ({ ...prev, preferredTime: "" }));
        navigateToStep(2);
        setExpiredNotice(
          "Your 5-minute reservation expired and the time slot was released. Please select an open time slot to continue."
        );
        releaseTemporarySlotReservation(expiredResId, sessionId).finally(() => {
          refreshDateSlots();
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeReservation, sessionId, refreshDateSlots]);

  // Prefill service if provided, else leave empty so user picks from 'Select A Reason' in Step 2
  useEffect(() => {
    if (initialService) {
      const norm = normalizeServiceKey(initialService);
      const matched = bookingServices.find(
        (s) =>
          s.title === initialService ||
          s.id === initialService ||
          normalizeServiceKey(s.title) === norm
      );
      setFormData((prev) => ({
        ...prev,
        service: matched ? matched.title : initialService,
      }));
    } else if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        service: prev.service || "",
      }));
    }
  }, [initialService, bookingServices, isOpen]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setStepDirection(1);
      setSubmitError(null);
      setExpiredNotice(null);
      setOtpError(null);
      setCopiedRef(false);
      setIsDoctorDropdownOpen(false);
      if (!initialService) {
        setFormData((prev) => ({ ...prev, service: "", preferredTime: "" }));
      }
    }
  }, [isOpen, initialService]);

  const handleCloseModal = async () => {
    if (activeReservation && step !== 5) {
      try {
        await releaseTemporarySlotReservation(activeReservation.id, sessionId);
      } catch {}
      setActiveReservation(null);
    }
    onClose();
  };

  // Handle changing the Service / Reason in Step 2
  const handleSelectServiceReason = async (newServiceTitle: string) => {
    if (newServiceTitle === formData.service) return;
    if (activeReservation) {
      try {
        await releaseTemporarySlotReservation(activeReservation.id, sessionId);
      } catch {}
      setActiveReservation(null);
    }
    setFormData((prev) => ({
      ...prev,
      service: newServiceTitle,
      preferredTime: "",
    }));
    setSubmitError(null);
    setExpiredNotice(null);
  };

  const handleSelectDoctorId = async (docId: string) => {
    if (docId === selectedDoctorId) {
      setIsDoctorDropdownOpen(false);
      return;
    }
    if (activeReservation) {
      try {
        await releaseTemporarySlotReservation(activeReservation.id, sessionId);
      } catch {}
      setActiveReservation(null);
    }
    setSelectedDoctorId(docId);
    setIsDoctorDropdownOpen(false);
    setFormData((prev) => ({ ...prev, preferredTime: "" }));
    setSubmitError(null);
    setExpiredNotice(null);
  };

  const handleSelectDate = async (dateStr: string) => {
    if (dateStr === selectedDate) return;
    if (activeReservation) {
      try {
        await releaseTemporarySlotReservation(activeReservation.id, sessionId);
      } catch {}
      setActiveReservation(null);
    }
    setSelectedDate(dateStr);
    setFormData((prev) => ({ ...prev, preferredTime: "" }));
    setSubmitError(null);
  };

  // Lock 5-Minute Temporary Slot Reservation
  const handleSelectTimeSlot = async (slot: ComputedTimeSlot) => {
    if (!selectedDate || !formData.service) return;
    if (slot.status === "booked" || slot.status === "reserved_other") return;

    setIsLockingSlot(true);
    setSubmitError(null);
    setExpiredNotice(null);

    const fullName = `${formData.firstName} ${formData.lastName}`.trim();

    try {
      const reservation = await lockTemporarySlotReservation({
        doctorId: isAnyDoctor ? "any" : selectedDoctor?.id || "any",
        doctorName: isAnyDoctor ? "Any Available Doctor" : selectedDoctor?.name || "Doctor",
        date: selectedDate,
        time: slot.time,
        sessionId,
        service: formData.service,
        patientName: fullName || undefined,
        patientEmail: formData.email || undefined,
      });

      setActiveReservation(reservation);
      setFormData((prev) => ({ ...prev, preferredTime: slot.time }));
      await refreshDateSlots();
    } catch (err: any) {
      setSubmitError(
        err?.message ||
          "This time slot is currently held by another patient's 5-minute reservation. Please choose another time."
      );
      await refreshDateSlots();
    } finally {
      setIsLockingSlot(false);
    }
  };

  // Calendar cells
  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: {
      dateStr: string;
      dayNum: number;
      isPast: boolean;
      configuredCount: number;
      availableCount: number;
    }[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({
        dateStr: "",
        dayNum: 0,
        isPast: true,
        configuredCount: 0,
        availableCount: 0,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isPast = dateStr < todayStr;
      const summary = !isPast
        ? getDoctorDateSummary(selectedDoctorId, dateStr)
        : { configuredCount: 0, bookedCount: 0, availableCount: 0 };

      cells.push({
        dateStr,
        dayNum: d,
        isPast,
        configuredCount: summary.configuredCount,
        availableCount: summary.availableCount,
      });
    }
    return cells;
  }, [calendarMonth, todayStr, selectedDoctorId, getDoctorDateSummary]);

  // Returning Patient OTP Cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Step 1: Send OTP to Returning Patient's Email
  const handleSendReturningPatientOtp = async () => {
    const emailToSearch = lookupEmail.trim().toLowerCase();
    if (!emailToSearch || !isValidEmail(emailToSearch)) {
      setOtpError("Please enter a valid email address.");
      return;
    }

    setIsLookingUp(true);
    setOtpError(null);
    setSubmitError(null);

    try {
      const firestoreMatch = liveAppointments.find(
        (a) => String(a.email || "").trim().toLowerCase() === emailToSearch
      );
      let cachedMatch: any = null;
      try {
        const cached = localStorage.getItem("vantage_patient_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (String(parsed.email || "").trim().toLowerCase() === emailToSearch) {
            cachedMatch = parsed;
          }
        }
      } catch {}

      const res = await fetch("/api/patients/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToSearch,
          patientHint: firestoreMatch || cachedMatch || null,
        }),
      });

      const data = await res.json();
      if (data.found && data.success) {
        setOtpDigits(["", "", "", "", "", ""]);
        setOtpSent(true);
        setResendCooldown(45);
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 120);
      } else {
        setOtpError(
          data.message || "No records found for this email. You can continue as a New Patient."
        );
      }
    } catch {
      setOtpError("Unable to send verification code right now. Please try again.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean && val !== "") return;
    const newDigits = [...otpDigits];
    newDigits[index] = clean ? clean[clean.length - 1] : "";
    setOtpDigits(newDigits);
    if (clean && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Step 1: Verify Returning Patient OTP & Auto-Fill Step 3 Details
  const handleVerifyReturningPatientOtp = async () => {
    const fullOtp = otpDigits.join("").trim();
    if (fullOtp.length < 6) {
      setOtpError("Please enter all 6 digits of the verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    const emailToSearch = lookupEmail.trim().toLowerCase();

    try {
      const res = await fetch("/api/patients/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSearch, otp: fullOtp }),
      });
      const data = await res.json();
      if (data.verified && data.patient) {
        const p = data.patient;
        const rawFullName = String(p.name || "").trim();
        const derivedFirst =
          p.firstName || (rawFullName ? rawFullName.split(" ")[0] : "Patient");
        const derivedLast =
          p.lastName ||
          (rawFullName ? rawFullName.split(" ").slice(1).join(" ") : "");

        setFormData((prev) => ({
          ...prev,
          firstName: derivedFirst,
          lastName: derivedLast,
          phone: p.phone ? formatPhoneNumber(p.phone) : prev.phone,
          email: p.email || emailToSearch,
          isNewPatient: false,
        }));
        setAutoFilled(true);
        setOtpSent(false);
      } else {
        setOtpError(data.error || "Incorrect verification code. Please try again.");
      }
    } catch {
      setOtpError("Unable to verify code at this moment.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Validate Step 3 before advancing to Step 4 Summary
  const handleProceedToSummary = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.firstName.trim()) {
      setSubmitError("Please enter your first name.");
      return;
    }
    if (!formData.lastName.trim()) {
      setSubmitError("Please enter your last name.");
      return;
    }
    if (!formData.email.trim() || !isValidEmail(formData.email)) {
      setSubmitError("Please enter a valid email address.");
      return;
    }
    if (formData.phone.replace(/\D/g, "").length < 10) {
      setSubmitError("Please enter a valid 10-digit phone number.");
      return;
    }

    navigateToStep(4);
  };

  // Step 4: Final Appointment Request Submission -> Transitions to Step 5 Confirmation
  const handleConfirmAndSubmit = async () => {
    setSubmitError(null);

    if (!selectedDate || !formData.preferredTime) {
      setSubmitError("Please select an appointment date and time slot.");
      navigateToStep(2);
      return;
    }

    if (!activeReservation || reservationRemainingSeconds <= 0) {
      setExpiredNotice("Your 5-minute slot reservation expired. Please choose a time slot again.");
      navigateToStep(2);
      return;
    }

    const cleanFirst = formData.firstName.trim();
    const cleanLast = formData.lastName.trim();
    const cleanFullName = `${cleanFirst} ${cleanLast}`.trim();
    const cleanPhone = formData.phone.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanService =
      formData.service ||
      bookingServices[0]?.title ||
      "New Patient Exam- All ages";

    setIsSubmitting(true);

    try {
      try {
        localStorage.setItem(
          "vantage_patient_profile",
          JSON.stringify({
            firstName: cleanFirst,
            lastName: cleanLast,
            name: cleanFullName,
            phone: cleanPhone,
            email: cleanEmail,
          })
        );
      } catch {}

      const assignedDocId = activeReservation.doctorId || selectedDoctor?.id || "doc-1";
      const assignedDocName =
        activeReservation.doctorName || selectedDoctor?.name || "Clinical Dentist";

      const createdId = await submitAppointmentRequest({
        name: cleanFullName,
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone,
        email: cleanEmail,
        service: cleanService,
        reason: formData.notes.trim() || cleanService,
        doctorId: assignedDocId,
        assignedDoctor: assignedDocName,
        preferredDate: selectedDate,
        preferredTime: formData.preferredTime,
        durationMinutes:
          selectedServiceItem?.durationMinutes ||
          selectedDoctorAvailability?.defaultDuration ||
          30,
        reservationId: activeReservation.id,
        sessionId,
        notes: formData.notes.trim() || cleanService,
      });

      setBookingRefId(createdId);
      setActiveReservation(null);
      navigateToStep(5);
    } catch (err: any) {
      setSubmitError(
        err?.message ||
          "Could not complete appointment booking. Please verify your selected slot is still available."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRef = () => {
    if (!bookingRefId) return;
    navigator.clipboard.writeText(bookingRefId);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return "Not selected";
    return new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDate]);

  if (!isOpen) return null;

  const stepsMeta = [
    { num: 1 as BookingStep, label: "Patient" },
    { num: 2 as BookingStep, label: "Service & Time" },
    { num: 3 as BookingStep, label: "Details" },
    { num: 4 as BookingStep, label: "Summary" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 lg:p-6 overflow-y-auto"
    >
      {/* Sober Dark Navy Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleCloseModal}
        className="fixed inset-0 bg-[#060C16]/75 backdrop-blur-xs"
      />

      {/* Main Sober Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 14 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl bg-white sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-[#E2E8F0] overflow-hidden z-10 flex flex-col my-auto h-full sm:h-auto sm:max-h-[92vh]"
      >
        {/* Top Header Bar */}
        <div className="bg-gradient-to-b from-[#EAF1FF] via-[#F3F7FF] to-[#F8FAFF] border-b border-[#DCE6FF] text-[#060C16] px-6 sm:px-8 py-5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#060C16] via-[#0A1933] to-[#002156] flex items-center justify-center shrink-0 shadow-md shadow-[#002156]/15 border border-[#002156]/20 ring-4 ring-[#1E5AFF]/10">
              <img
                src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
                alt="First Avenue Dentistry"
                className="h-7 sm:h-8 w-auto max-w-[135px] sm:max-w-[155px] object-contain"
              />
            </div>
            <div className="min-w-0">
              <h2
                id="booking-modal-title"
                className="font-display text-base sm:text-xl font-bold tracking-tight text-[#002156] truncate"
              >
                Book Your Dental Visit
              </h2>
              <p className="text-xs font-medium text-[#475569] truncate mt-0.5">
                First Avenue Family Dentistry · St. Thomas, ON
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* 5-Minute Hold Pill when active */}
            {activeReservation && reservationRemainingSeconds > 0 && step < 5 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border ${
                  reservationRemainingSeconds <= 60
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-white text-[#1E5AFF] border-[#C7D8FF] shadow-xs"
                }`}
                title="Selected time slot is reserved exclusively for you for 5 minutes"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>{formatTimer(reservationRemainingSeconds)}</span>
              </motion.div>
            )}

            <button
              type="button"
              onClick={handleCloseModal}
              className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white border border-[#DCE6FF] text-[#475569] hover:text-[#002156] flex items-center justify-center transition-all shadow-2xs cursor-pointer"
              aria-label="Close booking form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean 4-Step Progress Bar (Hidden on Step 5 Confirmation) */}
        {step < 5 && (
          <div className="bg-[#F8FAFF] border-b border-[#E2E8F0] px-6 sm:px-8 py-3.5 shrink-0">
            <div className="grid grid-cols-4 gap-2.5">
              {stepsMeta.map((s) => {
                const isActive = step === s.num;
                const isDone = step > s.num;
                return (
                  <div key={s.num} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors shrink-0 ${
                          isActive
                            ? "bg-[#1E5AFF] text-white shadow-xs shadow-[#1E5AFF]/30"
                            : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-[#DCE6FF] text-[#475569]"
                        }`}
                      >
                        {isDone ? <Check className="w-3 h-3" /> : s.num}
                      </span>
                      <span
                        className={`text-[11px] font-semibold truncate ${
                          isActive
                            ? "text-[#002156]"
                            : isDone
                            ? "text-emerald-700"
                            : "text-[#64748B]"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-[#DCE6FF]/70 overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{
                          width: isDone ? "100%" : isActive ? "100%" : "0%",
                        }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${
                          isDone ? "bg-emerald-600" : "bg-[#1E5AFF]"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrollable Step Workspace */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 bg-white">
          {/* Global Error or Expired Notice */}
          <AnimatePresence>
            {expiredNotice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5"
              >
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{expiredNotice}</span>
              </motion.div>
            )}

            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" custom={stepDirection}>
            {/* ================= STEP 1: NEW OR RETURNING PATIENT ================= */}
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={stepDirection}
                variants={stepSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-[#060C16]">
                    Have you visited First Avenue Dentistry before?
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Select your patient status below. Returning patients can verify their email to auto-fill their details.
                  </p>
                </div>

                {/* Patient Type Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* New Patient Card */}
                  <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, isNewPatient: true }));
                      setAutoFilled(false);
                      setOtpSent(false);
                      setOtpError(null);
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                      formData.isNewPatient
                        ? "border-[#1E5AFF] bg-[#F8FAFF] shadow-sm ring-1 ring-[#1E5AFF]"
                        : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          formData.isNewPatient
                            ? "bg-[#1E5AFF] text-white"
                            : "bg-[#F1F5F9] text-[#475569]"
                        }`}
                      >
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          formData.isNewPatient
                            ? "border-[#1E5AFF] bg-[#1E5AFF] text-white"
                            : "border-[#CBD5E1]"
                        }`}
                      >
                        {formData.isNewPatient && <Check className="w-3 h-3" />}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#060C16]">New Patient</div>
                      <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                        First time booking with our clinic. You will enter your contact details in Step 3.
                      </p>
                    </div>
                  </motion.button>

                  {/* Returning Patient Card */}
                  <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, isNewPatient: false }));
                      setOtpError(null);
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                      !formData.isNewPatient
                        ? "border-[#1E5AFF] bg-[#F8FAFF] shadow-sm ring-1 ring-[#1E5AFF]"
                        : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          !formData.isNewPatient
                            ? "bg-[#1E5AFF] text-white"
                            : "bg-[#F1F5F9] text-[#475569]"
                        }`}
                      >
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          !formData.isNewPatient
                            ? "border-[#1E5AFF] bg-[#1E5AFF] text-white"
                            : "border-[#CBD5E1]"
                        }`}
                      >
                        {!formData.isNewPatient && <Check className="w-3 h-3" />}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#060C16]">Returning Patient</div>
                      <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                        Verify your email now to automatically fill your name, email, and phone in Step 3.
                      </p>
                    </div>
                  </motion.button>
                </div>

                {/* Returning Patient Inline Email Verification Section */}
                <AnimatePresence>
                  {!formData.isNewPatient && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
                        {autoFilled ? (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-[#060C16]">
                                  Welcome back, {formData.firstName} {formData.lastName}
                                </div>
                                <div className="text-[11px] text-[#64748B]">
                                  Verified ({formData.email})
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAutoFilled(false);
                                setOtpSent(false);
                              }}
                              className="text-[11px] font-semibold text-[#1E5AFF] hover:underline cursor-pointer shrink-0"
                            >
                              Change Email
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <label className="block text-xs font-bold text-[#060C16]">
                                Verify Your Registered Email Address
                              </label>
                              <p className="text-[11px] text-[#64748B]">
                                We&apos;ll send a 6-digit code to unlock and auto-fill your saved profile.
                              </p>
                            </div>

                            {otpError && (
                              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                                {otpError}
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-2">
                              <div className="relative flex-1">
                                <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                                <input
                                  type="email"
                                  value={lookupEmail}
                                  onChange={(e) => setLookupEmail(e.target.value)}
                                  placeholder="yourname@gmail.com"
                                  className="w-full pl-10 pr-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={isLookingUp || !lookupEmail.trim()}
                                onClick={handleSendReturningPatientOtp}
                                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#060C16] hover:bg-[#1E293B] text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 shrink-0"
                              >
                                {isLookingUp
                                  ? "Sending Code..."
                                  : otpSent
                                  ? "Resend Code"
                                  : "Send 6-Digit Code"}
                              </button>
                            </div>

                            {/* 6-Digit OTP Input Boxes */}
                            {otpSent && (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="pt-2 space-y-3 border-t border-[#E2E8F0]"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-[#060C16]">
                                    Enter 6-digit code sent to {lookupEmail}
                                  </span>
                                  {resendCooldown > 0 && (
                                    <span className="text-[11px] text-[#64748B]">
                                      Resend in {resendCooldown}s
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-6 gap-2 max-w-xs">
                                  {otpDigits.map((digit, i) => (
                                    <input
                                      key={i}
                                      ref={(el) => {
                                        otpInputRefs.current[i] = el;
                                      }}
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={1}
                                      value={digit}
                                      onChange={(e) => handleOtpChange(i, e.target.value)}
                                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                      className="w-full h-11 text-center font-mono text-base font-bold rounded-xl border border-[#CBD5E1] bg-white text-[#060C16] focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] focus:outline-none"
                                    />
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  disabled={isVerifyingOtp || otpDigits.join("").length < 6}
                                  onClick={handleVerifyReturningPatientOtp}
                                  className="px-5 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                                >
                                  {isVerifyingOtp ? "Verifying..." : "Verify & Auto-Fill Details"}
                                </button>
                              </motion.div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Step 1 Footer Action */}
                <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end">
                  <motion.button
                    type="button"
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!formData.isNewPatient && !autoFilled}
                    onClick={() => navigateToStep(2)}
                    className="w-full sm:w-auto px-6 py-3 min-h-[46px] rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>
                      {!formData.isNewPatient && !autoFilled
                        ? "Verify Email Above to Continue"
                        : "Continue to Service & Time"}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ================= STEP 2: SELECT A REASON (SERVICE), DOCTOR, DATE & TIME ================= */}
            {step === 2 && (
              <motion.div
                key="step-2"
                custom={stepDirection}
                variants={stepSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-5"
              >
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-[#060C16]">
                    Select A Reason, Doctor &amp; Time
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Choose the reason for your visit below to view doctor availability and open times.
                  </p>
                </div>

                {/* 1. Select A Reason (Service Selection) */}
                <div className="p-4 rounded-2xl border border-[#DCE6FF] bg-[#F8FAFF] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={serviceSelectId}
                      className="block text-xs font-bold text-[#002156]"
                    >
                      1. Select A Reason for Your Visit *
                    </label>
                    {selectedServiceItem && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-[#C7D8FF] text-[#1E5AFF] text-[11px] font-bold">
                        <Clock className="w-3 h-3" />
                        <span>{`${selectedServiceItem.durationMinutes || 45} mins`}</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      id={serviceSelectId}
                      value={formData.service}
                      onChange={(e) => handleSelectServiceReason(e.target.value)}
                      className="w-full px-4 py-3 min-h-[48px] rounded-xl border border-[#1E5AFF]/40 bg-white text-xs sm:text-sm font-bold text-[#060C16] focus:outline-none focus:border-[#1E5AFF] focus:ring-2 focus:ring-[#1E5AFF]/15 cursor-pointer shadow-2xs"
                    >
                      <option value="">Select A Reason</option>
                      {bookingServices.map((svc) => (
                        <option key={svc.id} value={svc.title}>
                          {svc.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Reveal Doctor Selector & Service-Specific Availability Calendar once Service is chosen */}
                {!formData.service ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center space-y-2.5"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#EAF1FF] text-[#1E5AFF] flex items-center justify-center mx-auto">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-[#060C16]">
                      Select A Reason Above to View Openings
                    </h4>
                    <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                      Each dental service has its own dedicated doctor schedule and appointment duration. Choose a reason from the dropdown above to load live openings.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`schedule-for-${formData.service}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                  >
                    {/* Doctor Selector Box */}
                    <div className="space-y-1.5" ref={doctorDropdownRef}>
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-bold text-[#060C16]">
                          2. Select Doctor
                        </label>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsDoctorDropdownOpen((prev) => !prev)}
                          className={`w-full px-4 py-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isDoctorDropdownOpen
                              ? "border-[#1E5AFF] bg-[#F8FAFF] ring-1 ring-[#1E5AFF]"
                              : "border-[#CBD5E1] bg-white hover:border-[#94A3B8]"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] text-[#1E5AFF] flex items-center justify-center shrink-0 font-bold text-xs">
                              {isAnyDoctor ? (
                                <Users className="w-4 h-4" />
                              ) : (
                                <Stethoscope className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-[#060C16] truncate">
                                {selectedDoctor?.name || "Select Doctor"}
                              </div>
                              <div className="text-[11px] text-[#64748B] truncate">
                                {isAnyDoctor
                                  ? `Shows all open slots for ${formData.service}`
                                  : selectedDoctor?.title || "Clinical Dentist"}
                              </div>
                            </div>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform duration-200 ${
                              isDoctorDropdownOpen ? "rotate-180 text-[#1E5AFF]" : ""
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {isDoctorDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#CBD5E1] shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-[#F1F5F9]"
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectDoctorId("any")}
                                className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                                  isAnyDoctor ? "bg-[#F0F5FF]/70" : ""
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isAnyDoctor
                                        ? "bg-[#1E5AFF] text-white"
                                        : "bg-[#F1F5F9] text-[#1E5AFF]"
                                    }`}
                                  >
                                    <Users className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-[#060C16]">
                                      Any Available Doctor
                                    </div>
                                    <div className="text-[11px] text-[#64748B]">
                                      Earliest available opening for this service
                                    </div>
                                  </div>
                                </div>
                                {isAnyDoctor && (
                                  <Check className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                                )}
                              </button>

                              {eligibleDoctors.map((doc) => {
                                const isSelected = !isAnyDoctor && selectedDoctor?.id === doc.id;
                                return (
                                  <button
                                    key={doc.id}
                                    type="button"
                                    onClick={() => handleSelectDoctorId(doc.id)}
                                    className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                                      isSelected ? "bg-[#F0F5FF]/70" : ""
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                          isSelected
                                            ? "bg-[#1E5AFF] text-white"
                                            : "bg-[#F1F5F9] text-[#060C16]"
                                        }`}
                                      >
                                        {doc.name
                                          .replace(/^Dr\.\s*/i, "")
                                          .slice(0, 2)
                                          .toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-[#060C16] truncate">
                                          {doc.name}
                                        </div>
                                        <div className="text-[11px] text-[#64748B] truncate">
                                          {doc.title || "Clinical Dentist"}
                                        </div>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <Check className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* 3. Date & Time Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Calendar Column (7 cols) */}
                      <div className="md:col-span-7 p-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#060C16]">
                            {calendarMonth.toLocaleDateString("en-US", {
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setCalendarMonth(
                                  new Date(
                                    calendarMonth.getFullYear(),
                                    calendarMonth.getMonth() - 1,
                                    1
                                  )
                                )
                              }
                              className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#060C16] cursor-pointer"
                              aria-label="Previous month"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCalendarMonth(
                                  new Date(
                                    calendarMonth.getFullYear(),
                                    calendarMonth.getMonth() + 1,
                                    1
                                  )
                                )
                              }
                              className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#060C16] cursor-pointer"
                              aria-label="Next month"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Quick Date Shortcuts */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSelectDate(todayStr)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
                              selectedDate === todayStr
                                ? "bg-[#1E5AFF] text-white"
                                : "bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#060C16]"
                            }`}
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectDate(tomorrowStr)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
                              selectedDate === tomorrowStr
                                ? "bg-[#1E5AFF] text-white"
                                : "bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#060C16]"
                            }`}
                          >
                            Tomorrow
                          </button>
                          {nextAvailableDateStr &&
                            nextAvailableDateStr !== todayStr &&
                            nextAvailableDateStr !== tomorrowStr && (
                              <button
                                type="button"
                                onClick={() => handleSelectDate(nextAvailableDateStr)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
                                  selectedDate === nextAvailableDateStr
                                    ? "bg-[#1E5AFF] text-white"
                                    : "bg-white border border-[#E2E8F0] text-[#1E5AFF]"
                                }`}
                              >
                                Next Open ({nextAvailableDateStr.slice(5)})
                              </button>
                            )}
                        </div>

                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {WEEKDAY_SHORT.map((w) => (
                            <div
                              key={w}
                              className="text-[10px] font-semibold text-[#64748B] py-0.5"
                            >
                              {w}
                            </div>
                          ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {calendarCells.map((cell, idx) => {
                            if (!cell.dateStr) {
                              return <div key={`empty-${idx}`} className="h-9" />;
                            }
                            const isSelected = cell.dateStr === selectedDate;
                            const hasOpen = !cell.isPast && cell.availableCount > 0;
                            const isDisabled = cell.isPast || cell.configuredCount === 0;

                            return (
                              <button
                                key={cell.dateStr}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => handleSelectDate(cell.dateStr)}
                                className={`h-9 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all relative ${
                                  isSelected
                                    ? "bg-[#1E5AFF] text-white shadow-xs cursor-pointer"
                                    : hasOpen
                                    ? "bg-white text-[#060C16] border border-[#E2E8F0] hover:border-[#1E5AFF] cursor-pointer"
                                    : "text-[#CBD5E1] cursor-not-allowed"
                                }`}
                              >
                                <span>{cell.dayNum}</span>
                                {hasOpen && !isSelected && (
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Time Slots Column (5 cols) */}
                      <div className="md:col-span-5 p-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] flex flex-col justify-between space-y-3">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#060C16]">
                              Available Times
                            </span>
                            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#E2E8F0]">
                              {(["all", "morning", "afternoon"] as const).map((f) => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => setSlotTimeFilter(f)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize cursor-pointer transition-colors ${
                                    slotTimeFilter === f
                                      ? "bg-[#060C16] text-white"
                                      : "text-[#64748B] hover:text-[#060C16]"
                                  }`}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>

                          {loadingSlots ? (
                            <div className="py-12 text-center text-xs text-[#64748B] flex flex-col items-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin text-[#1E5AFF]" />
                              <span>Loading schedule...</span>
                            </div>
                          ) : filteredDateSlots.length === 0 ? (
                            <div className="py-10 text-center space-y-2">
                              <p className="text-xs text-[#64748B]">
                                No open slots for this service on this date.
                              </p>
                              {nextAvailableDateStr && nextAvailableDateStr !== selectedDate && (
                                <button
                                  type="button"
                                  onClick={() => handleSelectDate(nextAvailableDateStr)}
                                  className="px-3 py-1.5 rounded-lg bg-[#1E5AFF] text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Jump to Next Available
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
                              {filteredDateSlots.map((slot) => {
                                const isSelected =
                                  formData.preferredTime === slot.time &&
                                  Boolean(activeReservation);
                                const isUnavailable =
                                  slot.status === "booked" ||
                                  slot.status === "reserved_other";

                                return (
                                  <motion.button
                                    key={slot.time}
                                    type="button"
                                    whileTap={!isUnavailable ? { scale: 0.97 } : undefined}
                                    disabled={isUnavailable || isLockingSlot}
                                    onClick={() => handleSelectTimeSlot(slot)}
                                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                      isSelected
                                        ? "bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-xs cursor-pointer"
                                        : isUnavailable
                                        ? "bg-[#F1F5F9] text-[#94A3B8] border-[#E2E8F0] line-through cursor-not-allowed"
                                        : "bg-white text-[#060C16] border-[#E2E8F0] hover:border-[#1E5AFF] cursor-pointer"
                                    }`}
                                  >
                                    {isSelected && <Lock className="w-3 h-3 shrink-0" />}
                                    <span>{slot.time}</span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Selected Slot Status Footer */}
                        {activeReservation && formData.preferredTime && (
                          <div className="p-2.5 rounded-xl bg-[#F0F5FF] border border-[#BFDBFE] text-[11px] text-[#1E3A8A] flex items-center justify-between">
                            <span className="font-semibold truncate">
                              Reserved: {formData.preferredTime}
                            </span>
                            <span className="font-mono font-bold text-[#1E5AFF] shrink-0">
                              {formatTimer(reservationRemainingSeconds)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2 Navigation Buttons */}
                <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigateToStep(1)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#060C16] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <motion.button
                    type="button"
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={
                      !formData.service ||
                      !selectedDate ||
                      !formData.preferredTime ||
                      !activeReservation
                    }
                    onClick={() => navigateToStep(3)}
                    className="px-6 py-3 min-h-[46px] rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Continue to Patient Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ================= STEP 3: PATIENT DETAILS ================= */}
            {step === 3 && (
              <motion.form
                key="step-3"
                custom={stepDirection}
                variants={stepSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onSubmit={handleProceedToSummary}
                className="space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-lg sm:text-xl font-bold text-[#060C16]">
                      {formData.isNewPatient
                        ? "Enter Your Contact Details"
                        : "Confirm Your Details"}
                    </h3>
                  </div>
                </div>

                {/* Selected Reason & Slot Summary Pill */}
                <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-[#DCE6FF] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-[#64748B] block">
                      Selected Reason &amp; Appointment Time
                    </span>
                    <span className="font-bold text-[#002156] block truncate">
                      {formData.service} · {formattedSelectedDate} at {formData.preferredTime}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToStep(2)}
                    className="text-xs font-bold text-[#1E5AFF] hover:underline cursor-pointer shrink-0"
                  >
                    Change
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#060C16]">
                      First Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({ ...formData, firstName: e.target.value })
                        }
                        placeholder="First name"
                        className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white text-xs sm:text-sm text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#060C16]">
                      Last Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        placeholder="Last name"
                        className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white text-xs sm:text-sm text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#060C16]">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white text-xs sm:text-sm text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#060C16]">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phone: formatPhoneNumber(e.target.value),
                          })
                        }
                        placeholder="(519) 207-6890"
                        className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white text-xs sm:text-sm text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>

                  {/* Optional Note */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-bold text-[#060C16]">
                      Additional Notes <span className="font-normal text-[#64748B]">(Optional)</span>
                    </label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="Any specific tooth concern or preference..."
                        className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white text-xs sm:text-sm text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3 Footer Actions */}
                <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigateToStep(2)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#060C16] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <motion.button
                    type="submit"
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 min-h-[46px] rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <span>Review Booking Summary</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.form>
            )}

            {/* ================= STEP 4: BOOKING SUMMARY BEFORE SUBMITTING ================= */}
            {step === 4 && (
              <motion.div
                key="step-4"
                custom={stepDirection}
                variants={stepSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-5"
              >
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-[#060C16]">
                    Review Your Appointment Summary
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Please verify your appointment and contact details below before submitting your request.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] divide-y divide-[#E2E8F0] overflow-hidden">
                  {/* Section A: Schedule Summary */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                        Appointment Schedule
                      </span>
                      <button
                        type="button"
                        onClick={() => navigateToStep(2)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E5AFF] hover:underline cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Change</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="p-3 rounded-xl bg-white border border-[#E2E8F0]">
                        <span className="text-[11px] text-[#64748B] block">Doctor</span>
                        <span className="text-xs sm:text-sm font-bold text-[#060C16] mt-0.5 block truncate">
                          {activeReservation?.doctorName || selectedDoctor?.name}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-[#E2E8F0]">
                        <span className="text-[11px] text-[#64748B] block">Date</span>
                        <span className="text-xs sm:text-sm font-bold text-[#060C16] mt-0.5 block">
                          {formattedSelectedDate}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-[#E2E8F0]">
                        <span className="text-[11px] text-[#64748B] block">Time Slot</span>
                        <span className="text-xs sm:text-sm font-bold text-[#1E5AFF] mt-0.5 block">
                          {formData.preferredTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Patient Information Summary */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                        Patient Details ({formData.isNewPatient ? "New Patient" : "Returning Patient"})
                      </span>
                      <button
                        type="button"
                        onClick={() => navigateToStep(3)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E5AFF] hover:underline cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="flex justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                        <span className="text-[#64748B]">First &amp; Last Name:</span>
                        <span className="font-bold text-[#060C16]">
                          {formData.firstName} {formData.lastName}
                        </span>
                      </div>
                      <div className="flex justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                        <span className="text-[#64748B]">Phone Number:</span>
                        <span className="font-bold text-[#060C16]">{formData.phone}</span>
                      </div>
                      <div className="flex justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0] sm:col-span-2">
                        <span className="text-[#64748B]">Email Address:</span>
                        <span className="font-bold text-[#060C16]">{formData.email}</span>
                      </div>
                      <div className="flex justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0] sm:col-span-2">
                        <span className="text-[#64748B]">Dental Service:</span>
                        <span className="font-bold text-[#060C16]">{formData.service}</span>
                      </div>
                      {formData.notes.trim() && (
                        <div className="flex justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0] sm:col-span-2">
                          <span className="text-[#64748B]">Notes:</span>
                          <span className="font-medium text-[#060C16]">{formData.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 4 Actions */}
                <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigateToStep(3)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#060C16] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isSubmitting}
                    onClick={handleConfirmAndSubmit}
                    className="px-7 py-3.5 min-h-[48px] rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-[#1E5AFF]/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="w-4 h-4" />
                        <span>Confirm &amp; Submit Request</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ================= STEP 5: SIMPLE CONFIRMATION PAGE ================= */}
            {step === 5 && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="py-4 space-y-6 text-center max-w-md mx-auto"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
                  className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="w-9 h-9" />
                </motion.div>

                <div className="space-y-1.5">
                  <h3 className="text-xl sm:text-2xl font-bold text-[#060C16]">
                    Appointment Request Received
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    Thank you,{" "}
                    <strong className="text-[#060C16]">
                      {formData.firstName} {formData.lastName}
                    </strong>
                    . A confirmation email has been sent to{" "}
                    <strong className="text-[#060C16]">{formData.email}</strong>.
                  </p>
                </div>

                {/* Simple Sober Summary Box */}
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-left space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">Reference ID</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#060C16]">
                        {bookingRefId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyRef}
                        className="p-1 rounded-md bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#060C16] cursor-pointer"
                        title="Copy Reference ID"
                      >
                        {copiedRef ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-[#64748B]">Doctor</span>
                    <span className="font-bold text-[#060C16]">
                      {selectedDoctor?.name}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-[#64748B]">Date &amp; Time</span>
                    <span className="font-bold text-[#1E5AFF]">
                      {formattedSelectedDate} · {formData.preferredTime}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-[#64748B]">Service</span>
                    <span className="font-bold text-[#060C16]">{formData.service}</span>
                  </div>
                </div>

                {/* Simple Calendar & Done Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                  <a
                    href={buildGoogleCalendarLink({
                      service: formData.service,
                      doctor: selectedDoctor?.name || "Doctor",
                      date: selectedDate,
                      time: formData.preferredTime,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#060C16] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>Add to Google Calendar</span>
                  </a>

                  <button
                    type="button"
                    onClick={() =>
                      downloadIcsInvite({
                        service: formData.service,
                        doctor: selectedDoctor?.name || "Doctor",
                        date: selectedDate,
                        time: formData.preferredTime,
                        patientName: `${formData.firstName} ${formData.lastName}`.trim(),
                      })
                    }
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#060C16] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>Download .ICS</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full sm:w-auto px-6 py-2.5 min-h-[42px] rounded-xl bg-[#060C16] hover:bg-[#1E293B] text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
