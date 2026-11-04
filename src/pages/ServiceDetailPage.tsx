import { useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { ORAVO_SERVICES } from "../components/ServicesSection";
import { MOTION_EASE, pageTransitionVariants } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface ServiceDetailPageProps {
  serviceId: string;
  onBookClick: (serviceTitle?: string) => void;
  onNavigate: (page: string, serviceId?: string) => void;
}

export default function ServiceDetailPage({
  serviceId,
  onBookClick,
  onNavigate,
}: ServiceDetailPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentService =
    ORAVO_SERVICES.find((s) => s.id === serviceId) || ORAVO_SERVICES[0];

  const otherServices = ORAVO_SERVICES.filter(
    (s) => s.id !== currentService.id
  );

  useGSAP(
    () => {
      if (imageRef.current) {
        gsap.fromTo(
          imageRef.current,
          { scale: 1.12, yPercent: -3 },
          {
            scale: 1,
            yPercent: 3,
            ease: "none",
            scrollTrigger: {
              trigger: imageRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      }
    },
    { scope: containerRef, dependencies: [serviceId] }
  );

  const paragraphsToRender =
    currentService.fullParagraphs && currentService.fullParagraphs.length > 0
      ? currentService.fullParagraphs
      : [currentService.details];

  return (
    <motion.div
      ref={containerRef}
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full bg-[#F4F7FF] text-[#060C16]"
    >
      {/* 1. Header & Breadcrumb Strip */}
      <div className="pt-24 sm:pt-32 pb-5 px-4 sm:px-6 lg:px-12 bg-[#060C16] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-white/70">
            <button
              type="button"
              onClick={() => onNavigate("home")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Home
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => onNavigate("services")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Services
            </button>
            <span>/</span>
            <span className="text-[#4E8FFF] font-medium">
              {currentService.title}
            </span>
          </nav>

          <button
            type="button"
            onClick={() => onNavigate("services")}
            className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Services</span>
          </button>
        </div>
      </div>

      {/* 2. Service Hero Section */}
      <section className="py-12 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-12 bg-[#060C16] text-white rounded-b-[32px] sm:rounded-b-[48px]">
        <div className="max-w-[1360px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            {/* Left 7 cols: Content */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-6">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12]">
                {currentService.title}
              </h1>

              {currentService.subtitle && (
                <p className="text-xs sm:text-base font-bold uppercase tracking-wider text-[#4E8FFF]">
                  {currentService.subtitle}
                </p>
              )}

              <div className="space-y-4 text-sm sm:text-base text-white/85 leading-relaxed max-w-2xl">
                {paragraphsToRender.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => onBookClick(currentService.title)}
                  className="group inline-flex items-center gap-3 pl-2 pr-6 py-2.5 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-sm font-semibold tracking-wide transition-all shadow-xl hover:shadow-[#1E5AFF]/40 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-white text-[#1E5AFF] flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 shadow-xs">
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <span>Book your appointment today</span>
                </button>

                <a
                  href="tel:5192076890"
                  className="px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-white hover:bg-white/10 border border-white/20 transition-colors"
                >
                  Call 519 207 6890
                </a>
              </div>
            </div>

            {/* Right 5 cols: Large Photographic Feature with GSAP Scrub */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-2xl aspect-[4/3] sm:aspect-[16/11] bg-[#060C16] border border-white/10">
                <img
                  ref={imageRef}
                  src={currentService.image}
                  alt={currentService.title}
                  className="w-full h-full object-cover will-change-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060C16]/80 via-transparent to-transparent pointer-events-none" />

                <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5 p-3.5 sm:p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-between text-xs">
                  <span>First Avenue Family Dentistry</span>
                  <span className="font-semibold text-[#A5C8FF]">St. Thomas, ON</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Detailed Subpage Sections & Highlights */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-white border-b border-[#E9EDF0]">
        <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
          {currentService.contentSections &&
            currentService.contentSections.map((sec, idx) => (
              <div
                key={idx}
                className="p-6 sm:p-10 rounded-[24px] sm:rounded-[28px] bg-[#F8FAFC] border border-[#E9EDF0] space-y-4 sm:space-y-5"
              >
                <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-[#060C16]">
                  {sec.heading}
                </h2>
                {sec.paragraphs &&
                  sec.paragraphs.map((p, pIdx) => (
                    <p
                      key={pIdx}
                      className="text-sm sm:text-base text-[#646464] leading-relaxed"
                    >
                      {p}
                    </p>
                  ))}
                {sec.bullets && (
                  <ul className="space-y-2.5 sm:space-y-3 pt-2">
                    {sec.bullets.map((b, bIdx) => (
                      <li
                        key={bIdx}
                        className="flex items-start gap-3 text-sm sm:text-base text-[#060C16]"
                      >
                        <CheckCircle2 className="w-5 h-5 text-[#1E5AFF] shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          <div className="max-w-2xl space-y-4">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#060C16]">
              {currentService.title} in St. Thomas, ON
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {currentService.highlights.map((hl, i) => (
              <div
                key={i}
                className="h-full p-6 rounded-2xl bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col justify-start space-y-3 hover:border-[#1E5AFF]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h4 className="text-base font-bold text-[#060C16]">{hl}</h4>
                <p className="text-xs text-[#646464] leading-relaxed">
                  Your health and comfort is our top priority at 308 Wellington street, St. Thomas, ON N5R 2S9.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Switch to Other Services */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-white">
        <div className="max-w-[1360px] mx-auto space-y-10 sm:space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-[#1E5AFF]">
                WHAT WE DO
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#060C16]">
                Dental Services
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("services")}
              className="text-xs font-semibold text-[#1E5AFF] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All 12 Services</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {otherServices.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate("service-detail", item.id)}
                className="h-full p-5 sm:p-6 rounded-2xl bg-[#F8FAFC] border border-[#E9EDF0] hover:border-[#1E5AFF]/40 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-start space-y-4 group"
              >
                <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-[#060C16] shrink-0">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#1E5AFF]">
                    {item.category}
                  </span>
                  <h4 className="text-base font-bold text-[#060C16] group-hover:text-[#1E5AFF] transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#646464] line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Booking Banner */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-12 bg-[#EAF2FF]">
        <div className="max-w-[1100px] mx-auto p-6 sm:p-12 rounded-[24px] sm:rounded-[28px] bg-white border border-[#E9EDF0] shadow-md flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2 max-w-lg">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1E5AFF]">
              Request Appointment
            </span>
            <h3 className="text-xl sm:text-3xl font-bold text-[#060C16]">
              Request An Appointment Today
            </h3>
            <p className="text-xs sm:text-sm text-[#646464]">
              Takes 30 seconds — we&apos;ll confirm by phone. Mon. to Fri: 9am to 6pm, Saturdays: 9 am to 5 pm.
            </p>
          </div>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center justify-center gap-3 shrink-0">
            <a
              href="tel:5192076890"
              className="w-full sm:w-auto text-center px-5 py-2.5 rounded-full bg-white hover:bg-[#F4F7FF] text-[#060C16] text-xs font-semibold border border-[#C9C9D0] transition-colors"
            >
              519 207 6890
            </a>

            <button
              type="button"
              onClick={() => onBookClick(currentService.title)}
              className="w-full sm:w-auto text-center px-6 py-2.5 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Book Online
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
