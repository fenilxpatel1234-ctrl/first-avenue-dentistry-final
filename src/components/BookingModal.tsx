import { useState, useEffect, useId, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Calendar,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Mail,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Stethoscope,
  Download,
  CalendarCheck,
  Search,
  KeyRound,
  RefreshCw,
  Lock,
  Building,
} from "lucide-react";
import {
  submitAppointmentRequest,
  subscribeToAppointments,
  subscribeToDoctors,
  subscribeToTimeSlots,
  TimeSlotGroup,
  DEFAULT_TIME_SLOT_GROUPS,
} from "../lib/firestoreService";
import type { Appointment } from "../types/admin";
import { ALL_SERVICES } from "../data/servicesData";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialService?: string;
}

// 12 Standard Services + Emergency Care
const CLINICAL_SERVICES = [
  {
    id: "emergency-care",
    title: "Emergency Dental Care",
    category: "Emergency",
    duration: "Same-Day Priority",
    badge: "Urgent Care",
    description: "Acute toothache, broken or knocked-out teeth, facial swelling, or dental trauma.",
  },
  ...ALL_SERVICES.map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category.includes("Cosmetic")
      ? "Cosmetic"
      : s.category.includes("Preventive")
      ? "Preventive"
      : s.category.includes("Surgery") || s.category.includes("Extraction")
      ? "Surgical"
      : "Restorative",
    duration:
      s.id === "teeth-cleaning"
        ? "45 mins"
        : s.id === "oral-cancer-screening"
        ? "20 mins"
        : "60 mins",
    badge: s.category.includes("Cosmetic")
      ? "Aesthetic"
      : s.category.includes("Preventive")
      ? "Routine Care"
      : "Clinical Treatment",
    description: s.description,
  })),
];

const MAJOR_INSURANCE_PROVIDERS = [
  "Sun Life Financial",
  "Manulife",
  "Canada Life / Great-West",
  "Green Shield Canada (GSC)",
  "Blue Cross",
  "Canadian Dental Care Plan (CDCP)",
  "Desjardins Insurance",
  "Standard Life",
  "Other Direct-Billing Insurance",
  "Self-Pay / Non-Insured",
];

// Helper: Convert time slot to 24h
function timeSlotTo24h(slot: string): string {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(String(slot).trim());
  if (!m) return "09:00";
  let h = parseInt(m[1], 10);
  const min = m[2] ? m[2].padStart(2, "0") : "00";
  if ((m[3] || "").toUpperCase() === "PM" && h < 12) h += 12;
  if ((m[3] || "").toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

// Build Google Calendar Link
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
  const endMin = (sh * 60 + sm + 60) % 1440;
  const endH = String(Math.floor(endMin / 60)).padStart(2, "0");
  const endM = String(endMin % 60).padStart(2, "0");
  const endStr = `${cleanDate}T${endH}${endM}00`;

  const title = encodeURIComponent(
    `Dental Appointment: ${apt.service} - First Avenue Family Dentistry`
  );
  const details = encodeURIComponent(
    `Confirmed dental appointment for ${apt.service} with ${apt.doctor}.\nLocation: 308 Wellington Street, St. Thomas, ON N5R 2S9\nPhone: (519) 207-6890\nPlease arrive 10 minutes prior for check-in.`
  );
  const location = encodeURIComponent("308 Wellington Street, St. Thomas, ON N5R 2S9");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
}

// Download .ics Calendar File
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
  const endMin = (sh * 60 + sm + 60) % 1440;
  const endH = String(Math.floor(endMin / 60)).padStart(2, "0");
  const endM = String(endMin % 60).padStart(2, "0");
  const endStr = `${cleanDate}T${endH}${endM}00`;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//First Avenue Family Dentistry//Appointment Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `SUMMARY:Dental Visit: ${apt.service} - First Avenue Family Dentistry`,
    `DESCRIPTION:Patient: ${apt.patientName}\\nDoctor: ${apt.doctor}\\nQuestions: (519) 207-6890\\nAddress: 308 Wellington St, St. Thomas ON`,
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

export default function BookingModal({
  isOpen,
  onClose,
  initialService,
}: BookingModalProps) {
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const serviceSearchId = useId();

  // Multi-step: 1 = Service & Specialist, 2 = Date & Slot, 3 = Patient Info, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Live Firestore Doctors, Time Slots & Appointments Subscriptions
  const [liveDoctors, setLiveDoctors] = useState<{ id: string; name: string; title: string }[]>([]);
  const [liveTimeSlots, setLiveTimeSlots] = useState<TimeSlotGroup[]>(DEFAULT_TIME_SLOT_GROUPS);
  const [liveAppointments, setLiveAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    const unsubDocs = subscribeToDoctors((docs) => {
      const active = docs
        .filter((d) => d.status === "active")
        .map((d) => ({
          id: d.id,
          name: d.name,
          title: d.title || (d.specialties?.length ? d.specialties.join(", ") : "Dentist"),
        }));
      setLiveDoctors(active);
    });

    const unsubSlots = subscribeToTimeSlots((groups) => {
      if (groups && groups.length > 0) {
        setLiveTimeSlots(groups);
      }
    });

    const unsubApts = subscribeToAppointments((apts) => {
      setLiveAppointments(apts);
    });

    return () => {
      unsubDocs();
      unsubSlots();
      unsubApts();
    };
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    service: initialService || "Emergency Dental Care",
    doctorPreference: "First Available Specialist",
    preferredDate: tomorrowStr,
    preferredTime: "09:00 AM",
    isNewPatient: true,
    hasInsurance: true,
    insuranceProvider: "Sun Life Financial",
    notes: "",
  });

  // Returning Patient & OTP State
  const [lookupEmail, setLookupEmail] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "success" | "not_found">("idle");
  const [autoFilled, setAutoFilled] = useState(false);

  // OTP Verification Modal Popup
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [serviceSearch, setServiceSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingRefId, setBookingRefId] = useState<string>("");

  // Update selected service if parent requested it
  useEffect(() => {
    if (initialService) {
      setFormData((prev) => ({ ...prev, service: initialService }));
    }
  }, [initialService]);

  // Reset steps on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSubmitError(null);
      try {
        const cached = localStorage.getItem("vantage_patient_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.email && !lookupEmail) {
            setLookupEmail(parsed.email);
          }
        }
      } catch {}
    }
  }, [isOpen, lookupEmail]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isOtpOpen) {
          setIsOtpOpen(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isOtpOpen, onClose]);

  // Filtered services
  const filteredServices = CLINICAL_SERVICES.filter((svc) => {
    const matchesCategory =
      categoryFilter === "All" ||
      (categoryFilter === "Preventive" && svc.category === "Preventive") ||
      (categoryFilter === "Restorative" && svc.category === "Restorative") ||
      (categoryFilter === "Cosmetic" && svc.category === "Cosmetic") ||
      (categoryFilter === "Surgical" && svc.category === "Surgical") ||
      (categoryFilter === "Emergency" && svc.category === "Emergency");

    const matchesSearch =
      svc.title.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      svc.description.toLowerCase().includes(serviceSearch.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleNextStep = () => {
    setSubmitError(null);
    if (step === 1) {
      if (!formData.service) {
        setSubmitError("Please choose a dental service to proceed.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.preferredDate || !formData.preferredTime) {
        setSubmitError("Please select both your preferred date and time slot.");
        return;
      }
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setSubmitError(null);
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  // 1. Dispatch OTP to Real Gmail
  const handleInitiateOtpLookup = async (targetEmail?: string) => {
    const emailToSearch = (targetEmail || lookupEmail || formData.email).trim().toLowerCase();
    if (!emailToSearch || !emailToSearch.includes("@")) {
      setSubmitError("Please enter a valid email address to search records.");
      return;
    }

    setIsLookingUp(true);
    setSubmitError(null);
    setOtpError(null);

    try {
      // Find matching record in Firestore appointments or local cache to pass as hint
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
        setResendCooldown(45);
        setIsOtpOpen(true);
        setLookupStatus("idle");

        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
      } else {
        setLookupStatus("not_found");
        setSubmitError(data.message || "No prior records found for this email. Please register as a new patient.");
      }
    } catch (err) {
      console.warn("OTP dispatch network error:", err);
      setSubmitError("Unable to reach verification service. Please enter details manually.");
    } finally {
      setIsLookingUp(false);
    }
  };

  // 2. OTP Input Handler
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

  // 3. Verify OTP & Auto-Fill Patient Blank Details
  const handleVerifyOtp = async () => {
    const fullOtp = otpDigits.join("").trim();
    if (fullOtp.length < 6) {
      setOtpError("Please enter all 6 digits of your verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    const emailToSearch = (lookupEmail || formData.email).trim().toLowerCase();

    try {
      const res = await fetch("/api/patients/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSearch, otp: fullOtp }),
      });

      const data = await res.json();

      if (data.verified && data.patient) {
        applyPatientData(data.patient, emailToSearch);
        setIsOtpOpen(false);
      } else {
        setOtpError(data.error || "Incorrect verification code. Please check your Gmail.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setOtpError("Unable to verify code at this moment. Please check your network.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const applyPatientData = useCallback(
    (patientData: any, emailToSearch: string) => {
      const resolvedFirst =
        patientData.firstName || (patientData.name ? patientData.name.split(" ")[0] : "");
      const resolvedLast =
        patientData.lastName || (patientData.name ? patientData.name.split(" ").slice(1).join(" ") : "");

      setFormData((prev) => ({
        ...prev,
        firstName: resolvedFirst || prev.firstName,
        lastName: resolvedLast || prev.lastName,
        phone: patientData?.phone || prev.phone,
        email: patientData?.email || emailToSearch,
        isNewPatient: false,
        ...(patientData?.insuranceProvider
          ? { hasInsurance: true, insuranceProvider: patientData.insuranceProvider }
          : {}),
      }));

      setLookupEmail(patientData.email || emailToSearch);
      setLookupStatus("success");
      setAutoFilled(true);
    },
    []
  );

  // 4. Submit Appointment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const fullPatientName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    if (!formData.firstName.trim() || !formData.phone.trim() || !formData.email.trim()) {
      setSubmitError("Please provide your full name, telephone number, and email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const generatedId = `APT-${Math.floor(100000 + Math.random() * 900000)}`;
      setBookingRefId(generatedId);

      try {
        localStorage.setItem(
          "vantage_patient_profile",
          JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            name: fullPatientName,
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            insuranceProvider: formData.hasInsurance ? formData.insuranceProvider : "",
          })
        );
      } catch {}

      // Submit to Firestore
      await submitAppointmentRequest({
        name: fullPatientName,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        service: formData.service,
        assignedDoctor: formData.doctorPreference,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        insuranceProvider: formData.hasInsurance ? formData.insuranceProvider : undefined,
        notes: formData.notes.trim() || undefined,
      });

      // Automated email dispatch via backend
      try {
        await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            name: fullPatientName,
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            service: formData.service,
            serviceName: formData.service,
            assignedDoctor: formData.doctorPreference,
            preferredDate: formData.preferredDate,
            preferredTime: formData.preferredTime,
            preferredTimeSlot: formData.preferredTime,
            insuranceProvider: formData.hasInsurance ? formData.insuranceProvider : undefined,
            notes: formData.notes.trim() || undefined,
          }),
        });
      } catch (emailErr) {
        console.warn("Backend notification notice:", emailErr);
      }

      setStep(4);
    } catch (err: unknown) {
      console.error("Submission failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg || "Unable to save appointment. Please try again or call (519) 207-6890.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-[#060C16]/80 backdrop-blur-sm"
      />

      {/* Main Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden z-10 flex flex-col my-auto max-h-[92vh]"
      >
        {/* Header Bar */}
        <div className="px-6 py-5 bg-[#060C16] text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1E5AFF] tracking-wider uppercase">
                First Avenue Family Dentistry
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#8E8E93]">
                St. Thomas, ON
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">
              Book Your Dental Appointment
            </h2>
            <p className="text-xs text-[#8E8E93] mt-0.5 flex items-center gap-2">
              <span>(519) 207-6890</span>
              <span>•</span>
              <span>308 Wellington Street</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close booking modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar (Only during steps 1-3) */}
        {step < 4 && (
          <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] shrink-0">
            <div className="flex items-center justify-between max-w-lg mx-auto">
              {/* Step 1 */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= 1 ? "bg-[#1E5AFF] text-white" : "bg-[#E2E8F0] text-[#64748B]"
                  }`}
                >
                  1
                </div>
                <span
                  className={`text-xs font-semibold ${
                    step === 1 ? "text-[#060C16]" : "text-[#64748B]"
                  }`}
                >
                  Treatment &amp; Doctor
                </span>
              </div>

              <div className="flex-1 h-[2px] bg-[#E2E8F0] mx-3">
                <div
                  className={`h-full bg-[#1E5AFF] transition-all duration-300 ${
                    step >= 2 ? "w-full" : "w-0"
                  }`}
                />
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= 2 ? "bg-[#1E5AFF] text-white" : "bg-[#E2E8F0] text-[#64748B]"
                  }`}
                >
                  2
                </div>
                <span
                  className={`text-xs font-semibold ${
                    step === 2 ? "text-[#060C16]" : "text-[#64748B]"
                  }`}
                >
                  Date &amp; Time
                </span>
              </div>

              <div className="flex-1 h-[2px] bg-[#E2E8F0] mx-3">
                <div
                  className={`h-full bg-[#1E5AFF] transition-all duration-300 ${
                    step >= 3 ? "w-full" : "w-0"
                  }`}
                />
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 3 ? "bg-[#1E5AFF] text-white" : "bg-[#E2E8F0] text-[#64748B]"
                  }`}
                >
                  3
                </div>
                <span
                  className={`text-xs font-semibold ${
                    step === 3 ? "text-[#060C16]" : "text-[#64748B]"
                  }`}
                >
                  Patient Details
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {submitError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold">Required Information</p>
                <p className="text-[11px] mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          {/* ================= STEP 1: SERVICE & SPECIALIST ================= */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Patient Type Switcher */}
              <div className="p-4 rounded-2xl bg-[#F0F5FF] border border-[#BFDBFE] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#060C16] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    Are you a New or Returning Patient?
                  </span>
                  {autoFilled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Record Verified &amp; Auto-Filled
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isNewPatient: true })}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      formData.isNewPatient
                        ? "bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-sm"
                        : "bg-white text-[#64748B] border-[#CBD5E1] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    First-Time Patient
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isNewPatient: false })}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      !formData.isNewPatient
                        ? "bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-sm"
                        : "bg-white text-[#64748B] border-[#CBD5E1] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    Returning Patient (Auto-Fill)
                  </button>
                </div>

                {/* Returning Patient Email Lookup Input */}
                {!formData.isNewPatient && !autoFilled && (
                  <div className="pt-2 border-t border-[#BFDBFE] space-y-2">
                    <p className="text-[11px] text-[#475569]">
                      Enter your email address to receive a secure 6-digit verification code directly to your Gmail. Once verified, your full name, phone number, and insurance will automatically fill in.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                        <input
                          type="email"
                          value={lookupEmail}
                          onChange={(e) => setLookupEmail(e.target.value)}
                          placeholder="Enter your email address..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInitiateOtpLookup()}
                        disabled={isLookingUp || !lookupEmail.trim()}
                        className="px-4 py-2 rounded-xl bg-[#060C16] hover:bg-[#151D2A] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                      >
                        {isLookingUp ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-3.5 h-3.5 text-[#1E5AFF]" />
                            <span>Verify &amp; Auto-Fill</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Dental Service Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={serviceSearchId}
                    className="block text-xs font-bold text-[#060C16] uppercase tracking-wide"
                  >
                    1. Select Dental Service / Treatment *
                  </label>
                  <span className="text-[11px] text-[#64748B]">
                    Selected: <strong className="text-[#1E5AFF]">{formData.service}</strong>
                  </span>
                </div>

                {/* Search & Category filter */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                    <input
                      id={serviceSearchId}
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder="Search procedures (e.g. cleaning, crown, extraction, emergency)..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold text-[#64748B]">
                    {["All", "Emergency", "Preventive", "Restorative", "Cosmetic", "Surgical"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                          categoryFilter === cat
                            ? "bg-[#060C16] text-white font-bold"
                            : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Services List / Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {filteredServices.map((svc) => {
                    const isSelected = formData.service === svc.title;
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, service: svc.title })}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-[#EFF6FF] border-[#1E5AFF] ring-1 ring-[#1E5AFF] shadow-xs"
                            : "bg-white border-[#E2E8F0] hover:border-[#CBD5E1]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                svc.id === "emergency-care"
                                  ? "bg-rose-100 text-rose-700 font-bold"
                                  : "bg-[#F1F5F9] text-[#64748B]"
                              }`}
                            >
                              {svc.badge}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">{svc.duration}</span>
                          </div>
                          <span className="block font-bold text-xs text-[#060C16] leading-snug">
                            {svc.title}
                          </span>
                          <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                            {svc.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Doctor / Specialist Selection (Synced Live with Firestore) */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#060C16] uppercase tracking-wide">
                  2. Doctor / Specialist Preference
                </label>
                <div className="relative">
                  <select
                    value={
                      formData.doctorPreference === "First Available Specialist" ||
                      liveDoctors.some((d) => d.name === formData.doctorPreference)
                        ? formData.doctorPreference
                        : "First Available Specialist"
                    }
                    onChange={(e) => setFormData({ ...formData, doctorPreference: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] bg-white focus:outline-none focus:border-[#1E5AFF]"
                  >
                    <option value="First Available Specialist">
                      First Available Specialist (Recommended • Earliest opening)
                    </option>
                    {liveDoctors.map((doc) => (
                      <option key={doc.id} value={doc.name}>
                        {doc.name} — {doc.title}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Choosing &ldquo;First Available Specialist&rdquo; offers the earliest schedule availability.
                </p>
              </div>

              {/* Bottom Step 1 Action */}
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-sm shadow-[#1E5AFF]/25 flex items-center gap-2"
                >
                  <span>Select Date &amp; Time</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: DATE & LIVE TIME SLOTS ================= */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Date Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#060C16] uppercase tracking-wide">
                    Choose Appointment Date *
                  </label>
                  <span className="text-xs font-semibold text-[#1E5AFF]">
                    {new Date(formData.preferredDate + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        preferredDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#060C16] cursor-pointer"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        preferredDate: new Date(Date.now() + 172800000).toISOString().split("T")[0],
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#060C16] cursor-pointer"
                  >
                    In 2 Days
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        preferredDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#060C16] cursor-pointer"
                  >
                    Next Week
                  </button>
                </div>

                <div className="relative">
                  <Calendar className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] bg-white focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>
              </div>

              {/* Live Time Slots (Synced in real time with Admin Panel) */}
              <div className="space-y-4 pt-2 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#060C16] uppercase tracking-wide">
                    Select Available Time Slot *
                  </label>
                  <span className="text-xs text-[#64748B]">
                    Selected: <strong className="text-[#1E5AFF]">{formData.preferredTime}</strong>
                  </span>
                </div>

                <div className="space-y-4">
                  {liveTimeSlots.map((group) => (
                    <div key={group.group} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#1E5AFF]" />
                        <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">
                          {group.group}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {group.slots.map((slot) => {
                          const isSelected = formData.preferredTime === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setFormData({ ...formData, preferredTime: slot })}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                                isSelected
                                  ? "bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-sm shadow-[#1E5AFF]/20"
                                  : "bg-[#F8FAFC] text-[#060C16] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-white"
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#060C16] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-sm shadow-[#1E5AFF]/25 flex items-center gap-2"
                >
                  <span>Continue to Patient Details</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: PATIENT INFORMATION & INSURANCE ================= */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                <span className="block text-xs font-bold text-[#060C16]">
                  Patient Contact Information
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-[#64748B]">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="e.g. John"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-[#64748B]">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="e.g. Smith"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-[#64748B]">
                      Mobile Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-2.5" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(519) 000-0000"
                        className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-[#64748B]">
                      Email Address (For Calendar &amp; Confirmation) *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-2.5" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="patient@example.com"
                        className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Billing Insurance */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#060C16] flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasInsurance}
                      onChange={(e) => setFormData({ ...formData, hasInsurance: e.target.checked })}
                      className="w-4 h-4 rounded text-[#1E5AFF] focus:ring-[#1E5AFF]"
                    />
                    <span>I have Dental Insurance (Direct Billing to Major Insurers)</span>
                  </label>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                    Zero Hassle
                  </span>
                </div>

                {formData.hasInsurance && (
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[11px] font-semibold text-[#64748B]">
                      Select Insurance Carrier
                    </label>
                    <select
                      value={formData.insuranceProvider}
                      onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                    >
                      {MAJOR_INSURANCE_PROVIDERS.map((ins) => (
                        <option key={ins} value={ins}>
                          {ins}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Medical / Dental Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#060C16]">
                  Clinical Concerns or Specific Requests (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Sensitivity in upper left molar, dental anxiety, prefer gentle care..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                />
              </div>

              {/* Practice Reassurance Badge */}
              <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[11px] text-[#1E3A8A] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1E5AFF] shrink-0 mt-0.5" />
                <span>
                  No payment is required today. We electronically bill directly to your insurance company. Convenient free parking is available on-site at 308 Wellington Street, St. Thomas.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#060C16] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-md shadow-[#1E5AFF]/25 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Confirming Booking...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Appointment Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= STEP 4: CONFIRMATION & CALENDAR DOSSIER ================= */}
          {step === 4 && (
            <div className="py-4 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Request Confirmed &bull; Reference #{bookingRefId}
                </span>
                <h3 className="text-2xl font-bold text-[#060C16] tracking-tight">
                  We Have Received Your Appointment Request!
                </h3>
                <p className="text-xs text-[#64748B] max-w-md mx-auto">
                  A confirmation acknowledgment has been dispatched to <strong>{formData.email}</strong>. Our reception team will review your dossier and verify your booking.
                </p>
              </div>

              {/* Booking Summary Card */}
              <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] max-w-md mx-auto text-left space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B]">Patient:</span>
                  <strong className="text-[#060C16]">
                    {formData.firstName} {formData.lastName}
                  </strong>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B]">Service:</span>
                  <strong className="text-[#1E5AFF]">{formData.service}</strong>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B]">Assigned Specialist:</span>
                  <strong className="text-[#060C16]">{formData.doctorPreference}</strong>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B]">Scheduled Date &amp; Time:</span>
                  <strong className="text-[#060C16]">
                    {formData.preferredDate} &bull; {formData.preferredTime}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Location:</span>
                  <strong className="text-[#060C16]">308 Wellington St, St. Thomas</strong>
                </div>
              </div>

              {/* Calendar Export Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href={buildGoogleCalendarLink({
                    service: formData.service,
                    doctor: formData.doctorPreference,
                    date: formData.preferredDate,
                    time: formData.preferredTime,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>Add to Google Calendar</span>
                </a>

                <button
                  type="button"
                  onClick={() =>
                    downloadIcsInvite({
                      service: formData.service,
                      doctor: formData.doctorPreference,
                      date: formData.preferredDate,
                      time: formData.preferredTime,
                      patientName: `${formData.firstName} ${formData.lastName}`,
                    })
                  }
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#060C16] text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#64748B]" />
                  <span>Download .ics Invite</span>
                </button>
              </div>

              {/* Close Dialog Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-2.5 rounded-xl bg-[#060C16] hover:bg-[#151D2A] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ================= OTP VERIFICATION POPUP MODAL ================= */}
      <AnimatePresence>
        {isOtpOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOtpOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#E2E8F0] z-10 space-y-5 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#1E5AFF] mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#060C16]">
                  Patient Identity Verification
                </h3>
                <p className="text-xs text-[#64748B]">
                  We sent a 6-digit one-time passcode to{" "}
                  <strong className="text-[#060C16]">{lookupEmail || formData.email}</strong>.
                  Please check your inbox.
                </p>
              </div>

              {otpError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{otpError}</span>
                </div>
              )}

              {/* 6 Digit Inputs */}
              <div className="flex justify-center gap-2 sm:gap-2.5">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#060C16] focus:outline-none focus:border-[#1E5AFF] focus:bg-white focus:ring-1 focus:ring-[#1E5AFF] transition-all"
                  />
                ))}
              </div>

              {/* Verify Button */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp || otpDigits.join("").length < 6}
                  className="w-full py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                >
                  {isVerifyingOtp ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Passcode...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify &amp; Unlock Records</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                  <button
                    type="button"
                    onClick={() => setIsOtpOpen(false)}
                    className="hover:text-[#060C16] font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={() => handleInitiateOtpLookup()}
                    className="text-[#1E5AFF] hover:underline font-semibold disabled:text-[#94A3B8] disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
