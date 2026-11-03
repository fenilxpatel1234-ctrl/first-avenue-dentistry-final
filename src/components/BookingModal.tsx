import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  Check,
  ChevronRight,
  ChevronLeft,
  CalendarCheck,
  Download,
  AlertCircle,
  Clock,
  ShieldCheck,
  Loader2,
  KeyRound,
  RefreshCw,
  Lock,
  Sparkles,
} from "lucide-react";
import {
  submitAppointmentRequest,
  subscribeToDoctors,
  subscribeToTimeSlots,
  TimeSlotGroup,
  DEFAULT_TIME_SLOT_GROUPS,
} from "../lib/firestoreService";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialService?: string;
}

// Clean, categorized treatments
const SERVICES = [
  { id: "teeth-cleaning", title: "Teeth Cleaning & Hygiene", duration: "45 mins" },
  { id: "emergency-care", title: "Emergency Dental Care", duration: "Same-Day Priority" },
  { id: "teeth-whitening", title: "Professional Teeth Whitening", duration: "60 mins" },
  { id: "invisalign", title: "Invisalign & Clear Aligners", duration: "45 mins" },
  { id: "dental-implants", title: "Dental Implants Consultation", duration: "60 mins" },
  { id: "porcelain-veneers", title: "Porcelain Veneers & Smile Design", duration: "60 mins" },
  { id: "root-canal", title: "Root Canal Therapy", duration: "60 mins" },
  { id: "wisdom-teeth", title: "Wisdom Teeth & Extractions", duration: "45 mins" },
  { id: "pediatric-dentistry", title: "Pediatric Dentistry (Kids)", duration: "30 mins" },
  { id: "crowns-bridges", title: "Crowns & Bridges", duration: "60 mins" },
  { id: "dentures", title: "Dentures & Denture Implants", duration: "45 mins" },
  { id: "oral-cancer-screening", title: "Comprehensive Oral Health Exam", duration: "30 mins" },
];

const POPULAR_QUICK_PICKS = [
  "Teeth Cleaning & Hygiene",
  "Emergency Dental Care",
  "Professional Teeth Whitening",
  "Invisalign & Clear Aligners",
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

// Google Calendar link builder
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

  const title = encodeURIComponent(`Dental Visit: ${apt.service} - First Avenue Dentistry`);
  const details = encodeURIComponent(
    `Confirmed appointment for ${apt.service} with ${apt.doctor}.\nAddress: 308 Wellington Street, St. Thomas, ON N5R 2S9\nPhone: (519) 207-6890`
  );
  const location = encodeURIComponent("308 Wellington Street, St. Thomas, ON N5R 2S9");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
}

// .ics Calendar invite downloader
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
    "PRODID:-//First Avenue Family Dentistry//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `SUMMARY:Dental Visit: ${apt.service}`,
    `DESCRIPTION:Patient: ${apt.patientName}\\nDoctor: ${apt.doctor}\\nPhone: (519) 207-6890\\nLocation: 308 Wellington St, St. Thomas, ON`,
    "LOCATION:308 Wellington Street, St. Thomas, ON N5R 2S9",
    `DTSTART:${cleanDate}T${time24}00`,
    `DTEND:${endStr}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DentalAppointment-${cleanDate}.ics`;
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State (Insurance completely removed as requested)
  const [formData, setFormData] = useState({
    service: initialService || "Teeth Cleaning & Hygiene",
    doctorPreference: "Any Available Specialist",
    preferredDate: tomorrowStr,
    preferredTime: "09:00 AM",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [liveDoctors, setLiveDoctors] = useState<{ id: string; name: string; title: string }[]>([]);
  const [liveTimeSlots, setLiveTimeSlots] = useState<TimeSlotGroup[]>(DEFAULT_TIME_SLOT_GROUPS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingRefId, setBookingRefId] = useState("");

  // Returning Patient OTP Verification State
  const [lookupEmail, setLookupEmail] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync initial service
  useEffect(() => {
    if (initialService) {
      setFormData((prev) => ({ ...prev, service: initialService }));
    }
  }, [initialService]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      setOtpError(null);
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Subscribe to live doctors & time slots
  useEffect(() => {
    const unsubDocs = subscribeToDoctors((docs) => {
      const active = docs
        .filter((d) => d.status === "active")
        .map((d) => ({
          id: d.id,
          name: d.name,
          title: d.title || "Dentist",
        }));
      setLiveDoctors(active);
    });

    const unsubSlots = subscribeToTimeSlots((groups) => {
      if (groups && groups.length > 0) {
        setLiveTimeSlots(groups);
      }
    });

    return () => {
      unsubDocs();
      unsubSlots();
    };
  }, []);

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isOtpModalOpen) {
          setIsOtpModalOpen(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isOtpModalOpen, onClose]);

  // 1. Send 6-digit OTP code to the patient's Gmail / email
  const handleSendOtp = async (emailInput?: string) => {
    const targetEmail = (emailInput || lookupEmail || formData.email).trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      setError("Please enter a valid email address to send your verification code.");
      return;
    }

    setIsSendingOtp(true);
    setError(null);
    setOtpError(null);

    try {
      const res = await fetch("/api/patients/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await res.json();

      if (data.success || data.found) {
        setOtpDigits(["", "", "", "", "", ""]);
        setResendCooldown(45);
        setIsOtpModalOpen(true);
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
      } else {
        setError(data.message || data.error || "No previous records found for this email. You can fill details manually.");
      }
    } catch (err) {
      console.warn("OTP dispatch error:", err);
      setError("Unable to reach verification service. Please enter your details manually.");
    } finally {
      setIsSendingOtp(false);
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

  // 3. Verify OTP & Auto-fill details
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
        const p = data.patient;
        const resolvedFirst = p.firstName || (p.name ? p.name.split(" ")[0] : "");
        const resolvedLast = p.lastName || (p.name ? p.name.split(" ").slice(1).join(" ") : "");

        setFormData((prev) => ({
          ...prev,
          firstName: resolvedFirst || prev.firstName,
          lastName: resolvedLast || prev.lastName,
          phone: p.phone || prev.phone,
          email: p.email || emailToSearch,
        }));

        setIsVerified(true);
        setIsOtpModalOpen(false);
        setStep(3); // Take them straight to details if they triggered it from step 1
      } else {
        setOtpError(data.error || "Incorrect verification code. Please check your Gmail.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setOtpError("Unable to verify code right now. Please check your connection.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const validateStep = (currentStep: number) => {
    setError(null);
    if (currentStep === 1) {
      if (!formData.service) {
        setError("Please choose a treatment to continue.");
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (!formData.preferredDate || !formData.preferredTime) {
        setError("Please select both a date and an available time slot.");
        return false;
      }
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  const prevStep = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.firstName.trim() || !formData.phone.trim() || !formData.email.trim()) {
      setError("Please fill in your name, phone number, and email.");
      return;
    }

    setIsSubmitting(true);
    const fullPatientName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    const generatedId = `APT-${Math.floor(100000 + Math.random() * 900000)}`;
    setBookingRefId(generatedId);

    try {
      // Save local profile for future visits
      try {
        localStorage.setItem(
          "vantage_patient_profile",
          JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            name: fullPatientName,
            phone: formData.phone.trim(),
            email: formData.email.trim(),
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
        notes: formData.notes.trim() || undefined,
      });

      // Notify backend to dispatch confirmation email
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
            notes: formData.notes.trim() || undefined,
          }),
        });
      } catch (err) {
        console.warn("Backend email dispatch note:", err);
      }

      setStep(4);
    } catch (err: unknown) {
      console.error("Booking error:", err);
      setError("Could not complete booking right now. Please call us at (519) 207-6890.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Sober Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Sober Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-xl shadow-slate-900/10 border border-slate-200/90 overflow-hidden z-10 flex flex-col my-auto max-h-[92vh]"
      >
        {/* Sober White Header */}
        <div className="px-6 pt-6 pb-4 bg-white flex items-start justify-between border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                First Avenue Family Dentistry
              </span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight mt-1">
              {step === 4 ? "Appointment Confirmed" : "Book an Appointment"}
            </h2>
            {step < 4 && (
              <p className="text-xs text-slate-500 mt-0.5">
                St. Thomas, ON &bull; (519) 207-6890
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Minimal Stepper Tabs (Steps 1 to 3) */}
        {step < 4 && (
          <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
            <span className={step === 1 ? "text-[#1E5AFF] font-semibold" : ""}>
              1. Treatment
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className={step === 2 ? "text-[#1E5AFF] font-semibold" : ""}>
              2. Date &amp; Time
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className={step === 3 ? "text-[#1E5AFF] font-semibold" : ""}>
              3. Your Details
            </span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ================= STEP 1: SERVICE & DOCTOR ================= */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Popular Quick Picks */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Popular Treatments
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_QUICK_PICKS.map((quickTitle) => {
                    const isSelected = formData.service === quickTitle;
                    return (
                      <button
                        key={quickTitle}
                        type="button"
                        onClick={() => setFormData({ ...formData, service: quickTitle })}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-medium ${
                          isSelected
                            ? "bg-[#1E5AFF] text-white border-[#1E5AFF] shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {quickTitle}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  All Dental Services
                </label>
                <select
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-[#1E5AFF] transition-colors cursor-pointer"
                >
                  {SERVICES.map((srv) => (
                    <option key={srv.id} value={srv.title}>
                      {srv.title} ({srv.duration})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Need urgent help? Select Emergency Dental Care for same-day priority.
                </p>
              </div>

              {/* Doctor Preference */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Doctor or Specialist
                </label>
                <select
                  value={formData.doctorPreference}
                  onChange={(e) => setFormData({ ...formData, doctorPreference: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-[#1E5AFF] transition-colors cursor-pointer"
                >
                  <option value="Any Available Specialist">
                    Any Available Specialist (Fastest availability)
                  </option>
                  {liveDoctors.map((doc) => (
                    <option key={doc.id} value={doc.name}>
                      {doc.name} — {doc.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Returning Patient Auto-fill Shortcut */}
              <div className="pt-2 border-t border-slate-100">
                {!isVerified ? (
                  <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                      <span>Already a patient? Auto-fill with a 6-digit code</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(3);
                      }}
                      className="text-[#1E5AFF] font-semibold hover:underline cursor-pointer text-xs shrink-0"
                    >
                      Enter Email →
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Patient details verified &amp; auto-filled!</span>
                  </div>
                )}
              </div>

              {/* Bottom Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-5 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#1548CC] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>Select Date &amp; Time</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: DATE & TIME ================= */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Date Presets + Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Preferred Date
                  </label>
                  <span className="text-xs font-medium text-[#1E5AFF]">
                    {new Date(formData.preferredDate + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        preferredDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                      })
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
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
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
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
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                  >
                    Next Week
                  </button>
                </div>

                <div className="relative">
                  <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>Available Time</span>
                  </label>
                  <span className="text-xs font-semibold text-[#1E5AFF]">
                    Selected: {formData.preferredTime}
                  </span>
                </div>

                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {liveTimeSlots.map((group) => (
                    <div key={group.group} className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        {group.group}
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {group.slots.map((slot) => {
                          const isSelected = formData.preferredTime === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setFormData({ ...formData, preferredTime: slot })}
                              className={`py-2 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
                                isSelected
                                  ? "bg-[#1E5AFF] text-white shadow-xs font-semibold"
                                  : "bg-slate-50/70 text-slate-700 border border-slate-200/80 hover:bg-white hover:border-slate-300"
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

              {/* Navigation */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-5 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#1548CC] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Details</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: PATIENT INFORMATION ================= */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Returning Patient Email Lookup Banner */}
              {!isVerified ? (
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#1E5AFF]" />
                      <span>Returning Patient? Auto-fill with OTP</span>
                    </span>
                    <span className="text-[10px] text-slate-500">6-digit code via Gmail</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={lookupEmail}
                        onChange={(e) => setLookupEmail(e.target.value)}
                        placeholder="Enter past appointment email..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendOtp(lookupEmail)}
                      disabled={isSendingOtp || !lookupEmail.trim()}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1E5AFF] hover:bg-[#1548CC] text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      {isSendingOtp ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Send Code</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[3]" />
                    <span>
                      Details auto-filled for <strong>{formData.firstName} {formData.lastName}</strong> ({formData.email})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVerified(false)}
                    className="text-xs text-emerald-700 underline font-medium cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Jane"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Doe"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>
              </div>

              {/* Phone & Email Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(519) 000-0000"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jane@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>
                </div>
              </div>

              {/* Notes / Symptoms (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">
                  Notes or Symptoms (Optional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Toothache, preference for gentle care..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#1E5AFF]"
                />
              </div>

              {/* Sober Reassurance Badge */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No upfront fee &bull; Free parking on-site &bull; Immediate confirmation</span>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#1548CC] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Appointment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= STEP 4: SOBER CONFIRMATION ================= */}
          {step === 4 && (
            <div className="py-5 text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                <Check className="w-7 h-7 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Reference #{bookingRefId}
                </span>
                <h3 className="text-xl font-semibold text-slate-900 mt-2">
                  Appointment Requested
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  A confirmation has been sent to <strong>{formData.email}</strong>. Our team will review your booking.
                </p>
              </div>

              {/* Summary card */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 max-w-sm mx-auto text-left text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Patient:</span>
                  <span className="font-semibold text-slate-800">
                    {formData.firstName} {formData.lastName}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Service:</span>
                  <span className="font-semibold text-[#1E5AFF]">{formData.service}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Date &amp; Time:</span>
                  <span className="font-semibold text-slate-800">
                    {formData.preferredDate} &bull; {formData.preferredTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location:</span>
                  <span className="text-slate-700">308 Wellington St, St. Thomas</span>
                </div>
              </div>

              {/* Calendar Export */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <a
                  href={buildGoogleCalendarLink({
                    service: formData.service,
                    doctor: formData.doctorPreference,
                    date: formData.preferredDate,
                    time: formData.preferredTime,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Google Calendar</span>
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
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Download .ics</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ================= 6-DIGIT OTP VERIFICATION POPUP ================= */}
      <AnimatePresence>
        {isOtpModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOtpModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 z-10 space-y-4 text-center text-slate-800"
            >
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#1E5AFF] mx-auto flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">
                  Verify Your Email
                </h3>
                <p className="text-xs text-slate-500">
                  Enter the 6-digit code sent to <strong className="text-slate-800">{lookupEmail || formData.email}</strong>
                </p>
              </div>

              {otpError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs">
                  {otpError}
                </div>
              )}

              {/* 6 Digit Inputs */}
              <div className="flex justify-center gap-1.5 py-1">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    maxLength={1}
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-10 h-11 text-center text-base font-bold rounded-xl border border-slate-300 focus:border-[#1E5AFF] focus:ring-2 focus:ring-[#1E5AFF]/20 focus:outline-none bg-slate-50/50"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || otpDigits.join("").length < 6}
                className="w-full py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#1548CC] text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify &amp; Auto-Fill Details</span>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOtpModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>

                {resendCooldown > 0 ? (
                  <span>Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    className="text-[#1E5AFF] font-semibold hover:underline cursor-pointer"
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
