import { useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { MOTION_EASE } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface TeamSectionProps {
  onBookClick?: () => void;
}

const CLINICAL_CARE_DIVISIONS = [
  {
    id: "general-dentistry",
    title: "GENERAL DENTISTRY",
    designation: "Comprehensive Family Dental Care",
    items: [
      "Composite Filling",
      "Dental Bonding",
      "Dental Bridge",
      "Dental Crown",
      "Dental Extractions",
      "Dental Implant",
      "Dentures",
      "Root canal",
      "Teeth Cleaning",
    ],
    image: "/src/assets/images/vantage_about_dentist_consultation_1793342491438.jpg",
    badge: "General Dentistry",
  },
  {
    id: "cosmetic-dentistry",
    title: "COSMETIC DENTISTRY",
    designation: "Enhance Your Smile & Self-Confidence",
    items: [
      "Dental Veneers",
      "Invisalign",
      "Orthodontics",
      "Veneers",
      "Teeth Whitening",
    ],
    image: "/src/assets/images/vantage_service_dental_implants_1793343971749.jpg",
    badge: "Cosmetic Dentistry",
  },
  {
    id: "childrens-dentistry",
    title: "CHILDREN'S DENTISTRY",
    designation: "Start Healthy Dental Habits Early",
    items: [
      "Child's First Appointment",
      "Orthodontics for Teens",
      "Sealants and Fluoride",
      "Teeth Cleaning for Kids",
    ],
    image: "/src/assets/images/vantage_service_pediatric_1793343974427.jpg",
    badge: "Children's Dentistry",
  },
  {
    id: "additional-service",
    title: "ADDITIONAL SERVICE",
    designation: "Specialized & Preventive Treatments",
    items: [
      "Sport Guards",
      "TMJ Therapy",
      "Tooth Sensitivity Treatment",
      "Wisdom Teeth Extraction",
    ],
    image: "/src/assets/images/vantage_service_invisalign_1793343973187.jpg",
    badge: "Additional Service",
  },
];

export default function TeamSection({ onBookClick }: TeamSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>(".team-card-reveal");
      gsap.fromTo(
        cards,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: cardsContainerRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="doctors"
      ref={sectionRef}
      className="our-team-section relative w-full py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-white text-[#060C16] border-t border-[#E9EDF0] overflow-hidden"
    >
      <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4 sm:space-y-5">

          <motion.h2
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: MOTION_EASE }}
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#060C16] tracking-tight leading-[1.16]"
            style={{ textWrap: "balance" }}
          >
            Comprehensive Dental Care in St. Thomas, ON
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2, ease: MOTION_EASE }}
            className="text-sm sm:text-base text-[#646464] leading-relaxed max-w-xl"
          >
            Have you been on the lookout for comprehensive dental services in St. Thomas, ON? Head over to the leading family dental care clinic: First Avenue Family Dentistry today.
          </motion.p>
        </div>

        {/* 4 Category Cards Grid — Top-aligned content & equal-height cards */}
        <div
          ref={cardsContainerRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7 items-stretch"
        >
          {CLINICAL_CARE_DIVISIONS.map((item) => (
            <div
              key={item.id}
              className="team-card-reveal team-member-card h-full flex flex-col justify-start rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] p-4 sm:p-5 hover:border-[#1E5AFF]/35 hover:bg-white hover:shadow-xl transition-all duration-300 group"
            >
              {/* Image Wrap — Fixed aspect ratio at top of every card */}
              <div className="relative rounded-[18px] overflow-hidden bg-[#060C16] aspect-[4/3] sm:aspect-[4/4.2] w-full shrink-0 shadow-xs transition-all duration-500 clip-mask-reveal">
                <img
                  src={item.image}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108 will-change-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                <div className="absolute top-3 left-3">
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/95 backdrop-blur-md text-[#060C16] shadow-xs">
                    {item.badge}
                  </span>
                </div>
              </div>

              {/* Info Wrap — Top-aligned immediately below image across all 4 columns */}
              <div className="flex flex-col flex-1 justify-start pt-5 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#060C16] tracking-tight group-hover:text-[#1E5AFF] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#1E5AFF] leading-snug">
                    {item.designation}
                  </p>
                </div>

                <ul className="space-y-2 pt-1 text-xs sm:text-[13px] text-[#646464] flex-1">
                  {item.items.map((svc) => (
                    <li key={svc} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1E5AFF] shrink-0 mt-0.5" />
                      <span className="leading-snug">{svc}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 mt-auto border-t border-[#E9EDF0]">
                  <button
                    type="button"
                    onClick={onBookClick}
                    className="w-full inline-flex items-center justify-between text-xs font-semibold text-[#060C16] group-hover:text-[#1E5AFF] transition-colors cursor-pointer"
                  >
                    <span>Book Online</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#1E5AFF] transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="p-5 sm:p-8 rounded-2xl bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col lg:flex-row items-center justify-between gap-5 text-xs text-[#646464]">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-5 text-center sm:text-left">
            <span className="flex items-center gap-2 font-semibold text-[#060C16] text-sm">
              <ShieldCheck className="w-4 h-4 text-[#1E5AFF] shrink-0" />
              <span>First Avenue Family Dentistry</span>
            </span>
            <span className="hidden sm:inline text-[#C9C9D0]">|</span>
            <span className="text-xs sm:text-sm">
              Join Our Family of Smiles – New Patients Welcome! Call 519 207 6890
            </span>
          </div>

          <button
            type="button"
            onClick={onBookClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold tracking-wide transition-all shadow-xs cursor-pointer shrink-0"
          >
            <span>Request An Appointment Today</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
