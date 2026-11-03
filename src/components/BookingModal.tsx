import { useState, useEffect, useId, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Calendar,
  Phone,
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
  Sun,
  Zap,
  Check,
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

// Curated list of clinical services with category tags and icons
const CLINICAL_SERVICES = [
  {
    id: "emergency-care",
    title: "Emergency Dental Care",
    category: "Urgent",
    duration: "Same-Day Priority",
    badge: "Urgent",
    description: "Acute toothache, broken tooth, severe swelling, or dental trauma.",
  },
  {
    id: "teeth-cleaning",
    title: "Teeth Cleaning & Hygiene",
    category: "Routine",
    duration: "45 mins",
    badge: "Most Popular",
    description: "Comprehensive exam, gentle scaling, tartar removal, and fluoride polish.",
  },
  {
    id: "invisalign",
    title: "Invisalign & Clear Aligners",
    category: "Cosmetic",
    duration: "45 mins",
    badge: "Aesthetic",
    description: "Virtually invisible orthodontic aligners for teeth straightening.",
  },
  {
    id: "teeth-whitening",
    title: "Professional Teeth Whitening",
    category: "Cosmetic",
    duration: "60 mins",
    badge: "Fast Results",
    description: "In-office laser whitening & custom take-home whitening trays.",
  },
  {
    id: "dental-implants",
    title: "Dental Implants",
    category: "Restorative",
    duration: "60 mins",
    badge: "Permanent",
    description: "Titanium tooth root replacement for lifelong crowns or bridges.",
  },
  {
    id: "porcelain-veneers",
    title: "Porcelain Veneers",
    category: "Cosmetic",
    duration: "60 mins",
    badge: "Smile Design",
    description: "Ultra-thin custom porcelain shells for a flawless smile makeover.",
  },
  {
    id: "root-canal",
    title: "Root Canal Therapy",
    category: "Restorative",
    duration: "60 mins",
    badge: "Pain Relief",
    description: "Gentle nerve infection treatment to save and restore your natural tooth.",
  },
  {
    id: "wisdom-teeth",
    title: "Wisdom Teeth & Extractions",
    category: "Surgical",
    duration: "45 mins",
    badge: "Comfort Care",
    description: "Safe, painless extractions with advanced local sedation.",
  },
  {
    id: "pediatric-dentistry",
    title: "Pediatric Dentistry (Kids)",
    category: "Routine",
    duration: "30 mins",
    badge: "Family Care",
    description: "Gentle, welcoming dental visits tailored for children and teens.",
  },
  {
    id: "crowns-bridges",
    title: "Dental Crowns & Bridges",
    category: "Restorative",
    duration: "60 mins",
    badge: "Strengthening",
    description: "Durable ceramic caps to restore damaged or missing teeth.",
  },
  {
    id: "dentures",
    title: "Dentures & Implant Dentures",
    category: "Restorative",
    duration: "45 mins",
    badge: "Custom Fit",
    description: "Full, partial, and implant-stabilized natural dentures.",
  },
  {
    id: "oral-cancer-screening",
    title: "Oral Cancer & Health Exam",
    category: "Routine",
    duration: "20 mins",
    badge: "Preventive",
    description: "Thorough tissue exam & digital imaging for preventive wellness.",
  },
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
    service: initialService || "Teeth Cleaning & Hygiene",
    doctorPreference: "First Available Specialist",
    preferredDate: tomorrowStr,
    preferredTime: "09:00 AM",
    isNewPatient: true,
    hasInsurance: true,
    insuranceProvider: "Sun Life Financial",
    notes: "",
  });

  // Returning Patient & OTP State
  const [showAutoFillBox, setShowAutoFillBox] = useState(false);
  const [lookupEmail, setLookupEmail] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
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
      (categoryFilter === "Routine" && svc.category === "Routine") ||
      (categoryFilter === "Restorative" && svc.category === "Restorative") ||
      (categoryFilter === "Cosmetic" && svc.category === "Cosmetic") ||
      (categoryFilter === "Urgent" && svc.category === "Urgent");

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

  // Dispatch OTP to Email
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

        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
      } else {
        setSubmitError(data.message || "No prior records found for this email. You can fill details manually in step 3.");
      }
    } catch (err) {
      console.warn("OTP dispatch network error:", err);
      setSubmitError("Unable to reach verification service. Please enter details manually.");
    } finally {
      setIsLookingUp(false);
    }
  };

  // OTP Input Handler
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
      setAutoFilled(true);
      setShowAutoFillBox(false);
    },
    []
  );

  // Verify OTP
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
        setOtpError(data.error || "Incorrect verification code. Please check your inbox.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setOtpError("Unable to verify code at this moment. Please check your network.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Submit Appointment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const fullPatientName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    if (!formData.firstName.trim() || !formData.phone.trim() || !formData.email.trim()) {
      setSubmitError("Please provide your full name, phone number, and email address.");
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
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col my-auto max-h-[92vh]"
      >
        {/* Header Bar */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-[#060C16] to-[#0D1B2A] text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#4E8FFF] uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                First Avenue Family Dentistry
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                St. Thomas, ON
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
              Book Your Visit in 3 Easy Steps
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close booking modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Minimal Progress Bar (Steps 1-3) */}
        {step < 4 && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 shrink-0">
            <div className="flex items-center justify-between max-w-sm mx-auto text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    step >= 1 ? "bg-[#1E5AFF] text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  1
                </span>
                <span className={step === 1 ? "text-[#060C16] font-bold" : "text-slate-500"}>
                  Treatment
                </span>
              </div>

              <div className="w-8 sm:w-14 h-[2px] bg-slate-200">
                <div
                  className={`h-full bg-[#1E5AFF] transition-all duration-300 ${
                    step >= 2 ? "w-full" : "w-0"
                  }`}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    step >= 2 ? "bg-[#1E5AFF] text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  2
                </span>
                <span className={step === 2 ? "text-[#060C16] font-bold" : "text-slate-500"}>
                  Schedule
                </span>
              </div>

              <div className="w-8 sm:w-14 h-[2px] bg-slate-200">
                <div
                  className={`h-full bg-[#1E5AFF] transition-all duration-300 ${
                    step >= 3 ? "w-full" : "w-0"
                  }`}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    step >= 3 ? "bg-[#1E5AFF] text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  3
                </span>
                <span className={step === 3 ? "text-[#060C16] font-bold" : "text-slate-500"}>
                  Patient
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {submitError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold">Please check:</p>
                <p className="text-[11px] mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          {/* ================= STEP 1: SERVICE & SPECIALIST ================= */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Category Pills & Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={serviceSearchId}
                    className="text-xs font-bold text-[#060C16] uppercase tracking-wide flex items-center gap-1.5"
                  >
                    <Stethoscope className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>Select Dental Treatment</span>
                  </label>
                  <span className="text-[11px] font-semibold text-[#1E5AFF]">
                    Selected: {formData.service}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      id={serviceSearchId}
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder="Search treatment (e.g. cleaning, whitening, filling)..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-[#060C16] bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#1E5AFF] transition-colors"
                    />
                  </div>
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold">
                  {["All", "Routine", "Cosmetic", "Restorative", "Urgent"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                        categoryFilter === cat
                          ? "bg-[#1E5AFF] text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {filteredServices.map((svc) => {
                  const isSelected = formData.service === svc.title;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, service: svc.title })}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                        isSelected
                          ? "bg-blue-50/70 border-[#1E5AFF] ring-2 ring-[#1E5AFF]/20 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              svc.id === "emergency-care"
                                ? "bg-rose-100 text-rose-700 font-bold"
                                : isSelected
                                ? "bg-[#1E5AFF] text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {svc.badge}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {svc.duration}
                          </span>
                        </div>
                        <span className="block font-bold text-xs text-[#060C16] leading-snug">
                          {svc.title}
                        </span>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {svc.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="absolute right-2.5 bottom-2.5 text-[#1E5AFF]">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Doctor / Specialist Dropdown */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-[#060C16] uppercase tracking-wide">
                  Doctor Preference
                </label>
                <select
                  value={
                    formData.doctorPreference === "First Available Specialist" ||
                    liveDoctors.some((d) => d.name === formData.doctorPreference)
                      ? formData.doctorPreference
                      : "First Available Specialist"
                  }
                  onChange={(e) => setFormData({ ...formData, doctorPreference: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-[#060C16] bg-white focus:outline-none focus:border-[#1E5AFF]"
                >
                  <option value="First Available Specialist">
                    ⚡ First Available Specialist (Fastest • Recommended)
                  </option>
                  {liveDoctors.map((doc) => (
                    <option key={doc.id} value={doc.name}>
                      {doc.name} — {doc.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Returning Patient Auto-Fill Hint */}
              <div className="pt-2">
                {!autoFilled ? (
                  !showAutoFillBox ? (
                    <button
                      type="button"
                      onClick={() => setShowAutoFillBox(true)}
                      className="text-[11px] font-semibold text-[#1E5AFF] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-[#1E5AFF]" />
                      <span>Visited us before? Click to auto-fill with email code</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#060C16]">
                        <span>Enter your email to receive an instant verification code:</span>
                        <button
                          type="button"
                          onClick={() => setShowAutoFillBox(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={lookupEmail}
                          onChange={(e) => setLookupEmail(e.target.value)}
                          placeholder="Your email address..."
                          className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-[#1E5AFF]"
                        />
                        <button
                          type="button"
                          onClick={() => handleInitiateOtpLookup()}
                          disabled={isLookingUp || !lookupEmail.trim()}
                          className="px-3.5 py-1.5 rounded-xl bg-[#060C16] text-white text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                          {isLookingUp ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <KeyRound className="w-3 h-3 text-[#4E8FFF]" />
                          )}
                          <span>Send Code</span>
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Your patient details have been auto-filled!</span>
                  </div>
                )}
              </div>

              {/* Bottom Step 1 Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold tracking-wide transition-all cursor-pointer shadow-md shadow-[#1E5AFF]/25 flex items-center gap-2 hover:translate-x-0.5"
                >
                  <span>Choose Date &amp; Time</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: DATE & TIME SLOTS ================= */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Date Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#060C16] uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>Choose Preferred Date</span>
                  </label>
                  <span className="text-xs font-semibold text-[#1E5AFF]">
                    {new Date(formData.preferredDate + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        preferredDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#060C16] transition-colors cursor-pointer"
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
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#060C16] transition-colors cursor-pointer"
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
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#060C16] transition-colors cursor-pointer"
                  >
                    Next Week
                  </button>
                </div>

                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs text-[#060C16] bg-white focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#060C16] uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>Select Time Slot</span>
                  </label>
                  <span className="text-xs font-bold text-[#1E5AFF]">
                    {formData.preferredTime}
                  </span>
                </div>

                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {liveTimeSlots.map((group) => (
                    <div key={group.group} className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        <Sun className="w-3 h-3 text-amber-500" />
                        <span>{group.group}</span>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {group.slots.map((slot) => {
                          const isSelected = formData.preferredTime === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setFormData({ ...formData, preferredTime: slot })}
                              className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                                isSelected
                                  ? "bg-[#1E5AFF] text-white shadow-sm shadow-[#1E5AFF]/30 font-bold"
                                  : "bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-white"
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
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#060C16] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold tracking-wide transition-all cursor-pointer shadow-md shadow-[#1E5AFF]/25 flex items-center gap-2 hover:translate-x-0.5"
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
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#060C16] uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#1E5AFF]" />
                  <span>Your Contact Information</span>
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="e.g. John"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="e.g. Smith"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(519) 000-0000"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Billing Insurance Toggle */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#060C16] flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.hasInsurance}
                      onChange={(e) => setFormData({ ...formData, hasInsurance: e.target.checked })}
                      className="w-4 h-4 rounded text-[#1E5AFF] focus:ring-[#1E5AFF]"
                    />
                    <span>I have dental insurance (Direct Electronic Billing)</span>
                  </label>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full font-bold">
                    Direct Billing
                  </span>
                </div>

                {formData.hasInsurance && (
                  <div className="pt-1">
                    <select
                      value={formData.insuranceProvider}
                      onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
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

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Special requests or symptoms (Optional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Tooth sensitivity, anxiety, prefer gentle touch..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                />
              </div>

              {/* Trust Badge */}
              <div className="p-2.5 rounded-xl bg-blue-50/70 text-[11px] text-[#1E3A8A] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                <span>
                  No payment required today • Free parking on-site • Immediate confirmation
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#060C16] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold tracking-wide transition-all cursor-pointer shadow-md shadow-[#1E5AFF]/25 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Appointment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= STEP 4: SUCCESS CONFIRMATION ================= */}
          {step === 4 && (
            <div className="py-4 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                  Request Confirmed &bull; #{bookingRefId}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                  You&apos;re All Set!
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  A confirmation email has been dispatched to <strong>{formData.email}</strong>.
                </p>
              </div>

              {/* Booking Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-sm mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Patient:</span>
                  <strong className="text-[#060C16]">
                    {formData.firstName} {formData.lastName}
                  </strong>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Treatment:</span>
                  <strong className="text-[#1E5AFF]">{formData.service}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Date &amp; Time:</span>
                  <strong className="text-[#060C16]">
                    {formData.preferredDate} &bull; {formData.preferredTime}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location:</span>
                  <strong className="text-[#060C16]">308 Wellington St, St. Thomas</strong>
                </div>
              </div>

              {/* Calendar Export Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                <a
                  href={buildGoogleCalendarLink({
                    service: formData.service,
                    doctor: formData.doctorPreference,
                    date: formData.preferredDate,
                    time: formData.preferredTime,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4" />
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
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[#060C16] text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Download .ics</span>
                </button>
              </div>

              {/* Close Dialog Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-2 rounded-xl bg-[#060C16] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
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
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 z-10 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E5AFF] mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#060C16]">
                  Enter 6-Digit Code
                </h3>
                <p className="text-xs text-slate-500">
                  Sent to <strong className="text-[#060C16]">{lookupEmail || formData.email}</strong>
                </p>
              </div>

              {otpError && (
                <div className="p-2 rounded-xl bg-rose-50 text-rose-700 text-xs">
                  {otpError}
                </div>
              )}

              {/* 6 Digit Input Boxes */}
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
                className="w-full py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-[#1E5AFF]/25"
              >
                {isVerifyingOtp ? "Verifying..." : "Verify & Auto-Fill"}
              </button>

              <div className="text-xs text-slate-500">
                {resendCooldown > 0 ? (
                  <span>Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInitiateOtpLookup()}
                    className="text-[#1E5AFF] font-bold hover:underline cursor-pointer"
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
