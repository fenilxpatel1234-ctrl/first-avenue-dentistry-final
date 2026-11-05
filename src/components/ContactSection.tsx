import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  FileText,
  Download,
} from "lucide-react";
import { MOTION_EASE } from "../lib/animation";
import {
  PATIENT_FORMS,
  triggerPatientFormDownload,
} from "../data/patientFormsData";

import { submitEnquiry } from "../lib/firestoreService";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface ContactSectionProps {
  onBookClick?: () => void;
}

export default function ContactSection({ onBookClick }: ContactSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  // Form states matching First Avenue Dentistry Home & Contact forms:
  // First name*, Last name*, Phone number*, Email, Subject, Message, Submit
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    service: "General Dentistry",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useGSAP(
    () => {
      if (leftColRef.current && rightColRef.current) {
        gsap.fromTo(
          leftColRef.current,
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 75%",
              toggleActions: "play none none reverse",
            },
          }
        );

        gsap.fromTo(
          rightColRef.current,
          { opacity: 0, x: 30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 75%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    },
    { scope: sectionRef }
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.firstName.trim()) errs.firstName = "First name is required";
    if (!formData.lastName.trim()) errs.lastName = "Last name is required";
    if (!formData.phone.trim()) {
      errs.phone = "Phone number is required";
    }
    if (
      formData.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      errs.email = "Please enter a valid email address";
    }
    if (!formData.message.trim()) {
      errs.message = "Message is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitError(null);
    setIsSubmitting(true);
    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    try {
      await submitEnquiry({
        name: fullName,
        email: formData.email.trim() || "firstavenuedentistry@gmail.com",
        phone: formData.phone.trim(),
        service: formData.service,
        message: formData.message.trim(),
      });

      try {
        await fetch("/api/enquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            email: formData.email.trim() || "firstavenuedentistry@gmail.com",
            phone: formData.phone.trim(),
            service: formData.service,
            message: formData.message.trim(),
          }),
        });
      } catch (emailErr) {
        console.warn("Enquiry email dispatch warning:", emailErr);
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error("Enquiry submission error:", err);
      setSubmitError("Unable to submit at this moment. Please call 519 207 6890.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      service: "General Dentistry",
      message: "",
    });
    setErrors({});
    setIsSubmitted(false);
  };

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="relative w-full py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-[#F4F7FF] text-[#060C16] overflow-hidden border-t border-[#E9EDF0]"
    >
      <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
        {/* Section Heading */}
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4 sm:space-y-5">

          <h2
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#060C16] tracking-tight leading-[1.16]"
            style={{ textWrap: "balance" }}
          >
            Request An Appointment Today
          </h2>

          <p className="text-sm sm:text-base text-[#646464] leading-relaxed max-w-lg">
            Fill in the form below to let us know which service you&apos;re interested in. Tell us a bit about you — we&apos;ll be in touch the same business day. Takes 30 seconds — we&apos;ll confirm by phone.
          </p>
        </div>

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Clinic Contact Details & Map Card (5 cols) */}
          <div ref={leftColRef} className="lg:col-span-5 space-y-6">
            {/* Contact Info Box */}
            <div className="p-6 sm:p-10 rounded-[24px] sm:rounded-[28px] bg-white border border-[#E9EDF0] shadow-sm space-y-6 sm:space-y-7">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#1E5AFF]">
                  CONTACT
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                  FIRST AVENUE FAMILY DENTISTRY
                </h3>
                <p className="text-xs text-[#646464]">
                  Join Our Family of Smiles – New Patients Welcome!
                </p>
              </div>

              <div className="space-y-4 text-sm">
                {/* Address */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#060C16]">
                      Address
                    </span>
                    <span className="text-[#646464] leading-relaxed">
                      308 Wellington street,
                      <br />
                      St. Thomas, ON N5R 2S9
                    </span>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#060C16]">
                      Tel
                    </span>
                    <a
                      href="tel:5192076890"
                      className="font-medium text-[#1E5AFF] hover:underline"
                    >
                      519 207 6890
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-[#060C16]">
                      Email
                    </span>
                    <a
                      href="mailto:firstavenuedentistry@gmail.com"
                      className="font-medium text-[#1E5AFF] hover:underline break-all"
                    >
                      firstavenuedentistry@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Verified Opening Hours */}
              <div className="pt-5 border-t border-[#E9EDF0] space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#060C16]">
                  <Clock className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                  <span>Open 6 days a week – Saturday included</span>
                </div>

                <div className="space-y-1.5 text-xs text-[#646464]">
                  <div className="flex justify-between py-1 border-b border-[#F4F7FF]">
                    <span>Mon. to Fri</span>
                    <span className="font-semibold text-[#060C16]">9am to 6pm</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Saturdays</span>
                    <span className="font-semibold text-[#060C16]">9 am to 5 pm</span>
                  </div>
                </div>
              </div>

              {/* Medical History Forms */}
              <div className="pt-4 border-t border-[#E9EDF0] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#060C16]">
                  <FileText className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                  <span>Patient Forms</span>
                </div>
                <div className="flex flex-col gap-1.5 text-xs font-semibold text-[#1E5AFF]">
                  {PATIENT_FORMS.map((form) => (
                    <span
                      key={form.id}
                      onClick={(e) => triggerPatientFormDownload(form, e)}
                      className="inline-flex items-center gap-1.5 hover:text-[#0452FF] hover:underline transition-colors cursor-pointer w-fit"
                    >
                      <a
                        href={form.downloadUrl}
                        download={form.downloadFileName}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerPatientFormDownload(form, e);
                        }}
                        className="inline-flex items-center gap-1.5"
                      >
                        <span>{form.contactLabel}</span>
                        <Download className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Google Maps Card */}
            <div className="p-3 bg-white rounded-[24px] border border-[#E9EDF0] shadow-sm space-y-3">
              <div className="relative w-full h-[220px] rounded-[18px] overflow-hidden bg-[#E9EDF0]">
                <iframe
                  title="First Avenue Family Dentistry Location Map"
                  src="https://maps.google.com/maps?q=308+Wellington+Street,+St.+Thomas,+ON+N5R+2S9&t=&z=15&ie=UTF8&iwloc=&output=embed"
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div className="px-2 sm:px-3 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-[#646464]">308 Wellington street, St. Thomas, ON N5R 2S9</span>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=First+Avenue+Dentistry+308+Wellington+Street+St+Thomas+ON"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#1E5AFF] hover:underline shrink-0"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Contact / Request Appointment Form (7 cols) */}
          <div ref={rightColRef} className="lg:col-span-7">
            <div className="p-6 sm:p-10 lg:p-12 rounded-[24px] sm:rounded-[28px] bg-white border border-[#E9EDF0] shadow-sm">
              <AnimatePresence mode="wait">
                {isSubmitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.35, ease: MOTION_EASE }}
                    className="py-12 px-4 text-center space-y-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
                    </div>

                    <div className="space-y-2 max-w-md mx-auto">
                      <h3 className="text-2xl font-bold text-[#060C16]">
                        Request Appointment Received!
                      </h3>
                      <p className="text-sm text-[#646464] leading-relaxed">
                        Thank you,{" "}
                        <strong className="text-[#060C16]">
                          {formData.firstName} {formData.lastName}
                        </strong>
                        . We&apos;ll be in touch the same business day and confirm by phone at{" "}
                        <strong className="text-[#060C16]">{formData.phone}</strong>.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E9EDF0] text-xs text-[#646464] max-w-md mx-auto">
                      <span className="font-semibold text-[#060C16]">Call 519 207 6890</span>{" "}
                      or visit our dental clinic at 308 Wellington street, St. Thomas, ON N5R 2S9.
                    </div>

                    <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-6 py-2.5 rounded-full bg-[#060C16] text-white text-xs font-semibold hover:bg-[#1E5AFF] transition-colors cursor-pointer"
                      >
                        Send Another Message
                      </button>

                      <button
                        type="button"
                        onClick={onBookClick}
                        className="px-6 py-2.5 rounded-full bg-[#1E5AFF] text-white text-xs font-semibold hover:bg-[#0452FF] transition-colors cursor-pointer"
                      >
                        Book Online
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                    noValidate
                  >
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-[#060C16] tracking-tight">
                        Request Appointment
                      </h3>
                      <p className="text-xs sm:text-sm text-[#646464]">
                        Fill in the form below to let us know which service you&apos;re interested in. Tell us a bit about you — we&apos;ll be in touch the same business day.
                      </p>
                    </div>

                    {submitError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      {/* First name* */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="contact-first-name"
                          className="block text-xs font-bold text-[#060C16]"
                        >
                          First name <span className="text-[#1E5AFF]">*</span>
                        </label>
                        <input
                          id="contact-first-name"
                          type="text"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({ ...formData, firstName: e.target.value })
                          }
                          placeholder="First name"
                          className={`w-full px-4 py-3 min-h-[44px] rounded-xl border text-base sm:text-sm text-[#060C16] placeholder:text-[#A1A1A8] focus:outline-none focus:ring-2 transition-all ${
                            errors.firstName
                              ? "border-red-400 focus:ring-red-200"
                              : "border-[#E9EDF0] focus:border-[#1E5AFF] focus:ring-[#1E5AFF]/20"
                          }`}
                        />
                        {errors.firstName && (
                          <span className="flex items-center gap-1 text-[11px] text-red-500">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.firstName}
                          </span>
                        )}
                      </div>

                      {/* Last name* */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="contact-last-name"
                          className="block text-xs font-bold text-[#060C16]"
                        >
                          Last name <span className="text-[#1E5AFF]">*</span>
                        </label>
                        <input
                          id="contact-last-name"
                          type="text"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({ ...formData, lastName: e.target.value })
                          }
                          placeholder="Last name"
                          className={`w-full px-4 py-3 min-h-[44px] rounded-xl border text-base sm:text-sm text-[#060C16] placeholder:text-[#A1A1A8] focus:outline-none focus:ring-2 transition-all ${
                            errors.lastName
                              ? "border-red-400 focus:ring-red-200"
                              : "border-[#E9EDF0] focus:border-[#1E5AFF] focus:ring-[#1E5AFF]/20"
                          }`}
                        />
                        {errors.lastName && (
                          <span className="flex items-center gap-1 text-[11px] text-red-500">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.lastName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      {/* Phone number* */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="contact-phone"
                          className="block text-xs font-bold text-[#060C16]"
                        >
                          Phone number <span className="text-[#1E5AFF]">*</span>
                        </label>
                        <input
                          id="contact-phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          placeholder="519 207 6890"
                          className={`w-full px-4 py-3 min-h-[44px] rounded-xl border text-base sm:text-sm text-[#060C16] placeholder:text-[#A1A1A8] focus:outline-none focus:ring-2 transition-all ${
                            errors.phone
                              ? "border-red-400 focus:ring-red-200"
                              : "border-[#E9EDF0] focus:border-[#1E5AFF] focus:ring-[#1E5AFF]/20"
                          }`}
                        />
                        {errors.phone && (
                          <span className="flex items-center gap-1 text-[11px] text-red-500">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.phone}
                          </span>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="contact-email"
                          className="block text-xs font-bold text-[#060C16]"
                        >
                          Email
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="Email"
                          className={`w-full px-4 py-3 min-h-[44px] rounded-xl border text-base sm:text-sm text-[#060C16] placeholder:text-[#A1A1A8] focus:outline-none focus:ring-2 transition-all ${
                            errors.email
                              ? "border-red-400 focus:ring-red-200"
                              : "border-[#E9EDF0] focus:border-[#1E5AFF] focus:ring-[#1E5AFF]/20"
                          }`}
                        />
                        {errors.email && (
                          <span className="flex items-center gap-1 text-[11px] text-red-500">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="contact-service"
                        className="block text-xs font-bold text-[#060C16]"
                      >
                        Subject
                      </label>
                      <select
                        id="contact-service"
                        value={formData.service}
                        onChange={(e) =>
                          setFormData({ ...formData, service: e.target.value })
                        }
                        className="w-full px-4 py-3 min-h-[44px] rounded-xl border border-[#E9EDF0] text-base sm:text-sm text-[#060C16] bg-white focus:outline-none focus:border-[#1E5AFF] focus:ring-2 focus:ring-[#1E5AFF]/20 transition-all cursor-pointer"
                      >
                        <option value="General Dentistry">General Dentistry</option>
                        <option value="Crowns & Bridges">Crowns &amp; Bridges</option>
                        <option value="Wisdom Teeth Extraction">Wisdom Teeth Extraction</option>
                        <option value="Oral Surgery">Oral Surgery</option>
                        <option value="Teeth Cleaning">Teeth Cleaning</option>
                        <option value="Root Canals">Root Canals</option>
                        <option value="Orthodontics">Orthodontics / Invisalign</option>
                        <option value="Sedation Sleep Dentistry">Sedation Sleep Dentistry</option>
                        <option value="Children's Dentistry">Children&apos;s Dentistry</option>
                        <option value="Veneers">Veneers</option>
                        <option value="Teeth Whitening">Teeth Whitening</option>
                        <option value="Implant">Dental Implant</option>
                        <option value="Oral Cancer Screening">Oral Cancer Screening</option>
                        <option value="Emergency Dental Care">Emergency Dental Care</option>
                      </select>
                    </div>

                    {/* Message */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="contact-message"
                        className="block text-xs font-bold text-[#060C16]"
                      >
                        Message <span className="text-[#1E5AFF]">*</span>
                      </label>
                      <textarea
                        id="contact-message"
                        rows={4}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        placeholder="Message"
                        className={`w-full px-4 py-3 min-h-[56px] rounded-xl border text-base sm:text-sm text-[#060C16] placeholder:text-[#A1A1A8] focus:outline-none focus:ring-2 transition-all resize-none ${
                          errors.message
                            ? "border-red-400 focus:ring-red-200"
                            : "border-[#E9EDF0] focus:border-[#1E5AFF] focus:ring-[#1E5AFF]/20"
                        }`}
                      />
                      {errors.message && (
                        <span className="flex items-center gap-1 text-[11px] text-red-500">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {errors.message}
                        </span>
                      )}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs text-[#8E8E93]">
                        <ShieldCheck className="w-4 h-4 text-[#1E5AFF]" />
                        <span>Takes 30 seconds — we&apos;ll confirm by phone.</span>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 min-h-[48px] rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs sm:text-sm font-semibold tracking-wide shadow-md shadow-[#0452FF]/20 hover:shadow-lg transition-all duration-300 disabled:opacity-60 cursor-pointer touch-manipulation active:scale-95"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <span>Submit</span>
                            <Send className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
