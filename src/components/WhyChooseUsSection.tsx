import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ChevronDown,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { MOTION_EASE } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface WhyChooseUsSectionProps {
  onBookClick?: () => void;
}

const CHOOSE_US_ITEMS = [
  {
    number: "01 —",
    title: "Emergency Dental Care",
    desc: "We offer quick and immediate care services for all kinds of dental emergencies. Our emergency dental clinic is equipped with state-of-the-art equipment and leading-edge technology to handle a variety of urgent dental concerns.",
  },
  {
    number: "02 —",
    title: "Family Dental Care",
    desc: "At First Avenue Dentistry, we believe in nurturing healthy smiles for the whole family. Our family dental care services are designed to meet the needs of patients of all ages.",
  },
  {
    number: "03 —",
    title: "Cosmetic Dentistry",
    desc: "Our cosmetic dentistry services will help enhance the appearance of your teeth and boost your self-confidence. From teeth whitening and porcelain veneers to dental implants, we can do it all.",
  },
  {
    number: "04 —",
    title: "Comfort-first care",
    desc: "Modern, welcoming environment built around you. All ages, from first visits to senior care.",
  },
  {
    number: "05 —",
    title: "Open 6 days a week – Saturday included",
    desc: "General, cosmetic, emergency & more- location at 308 Wellington street, St. Thomas, ON N5R 2S9. Mon. to Fri: 9am to 6pm, Saturdays: 9 am to 5 pm.",
  },
];

export default function WhyChooseUsSection({ onBookClick }: WhyChooseUsSectionProps) {
  const [activeItem, setActiveItem] = useState<number | null>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      if (imageRef.current && imageContainerRef.current) {
        gsap.fromTo(
          imageRef.current,
          { scale: 1.15, yPercent: -4 },
          {
            scale: 1,
            yPercent: 4,
            ease: "none",
            scrollTrigger: {
              trigger: imageContainerRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1.2,
            },
          }
        );
      }
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="why-choose-us"
      ref={sectionRef}
      className="choose-us-section relative w-full py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-white text-[#060C16] border-t border-[#E9EDF0] overflow-hidden"
    >
      <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16 lg:space-y-20">
        {/* Section Heading */}
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-4 sm:space-y-5">

          {/* Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: MOTION_EASE }}
            className="text-2xl sm:text-4xl lg:text-[44px] font-bold text-[#060C16] tracking-tight leading-[1.18]"
            style={{ textWrap: "balance" }}
          >
            Three pillars of care for every patient
          </motion.h2>

          {/* Paragraph */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2, ease: MOTION_EASE }}
            className="text-sm sm:text-base text-[#646464] leading-relaxed max-w-2xl"
          >
            Are you on the lookout for comprehensive dental care in St. Thomas, ON? Head over to First Avenue Dentistry today where your dental health and comfort are our top priorities.
          </motion.p>
        </div>

        {/* 2-Column Content Layout: Numbered Accordion Features (Left) + Large Clinic Image (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left Column: Numbered Dropdown / Accordion Features */}
          <div className="lg:col-span-7 space-y-4">
            {CHOOSE_US_ITEMS.map((item, idx) => {
              const isOpen = activeItem === idx;
              return (
                <motion.div
                  key={item.number}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.45,
                    delay: idx * 0.08,
                    ease: MOTION_EASE,
                  }}
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isOpen
                      ? "bg-[#EAF2FF] border-[#B8D5FF] shadow-sm"
                      : "bg-[#F8FAFC] hover:bg-[#EAF2FF]/60 border-[#E9EDF0]"
                  }`}
                >
                  {/* Accordion Toggle Header */}
                  <button
                    type="button"
                    onClick={() => setActiveItem(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full p-4 sm:p-6 text-left flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group"
                  >
                    <div className="flex items-start sm:items-center gap-3 sm:gap-5 flex-1 min-w-0">
                      <span className="font-mono text-sm sm:text-lg font-bold text-[#1E5AFF] shrink-0 mt-0.5 sm:mt-0">
                        {item.number}
                      </span>

                      <span className="text-sm sm:text-lg lg:text-xl font-bold text-[#060C16] group-hover:text-[#1E5AFF] transition-colors leading-snug">
                        {item.title}
                      </span>
                    </div>

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${
                        isOpen
                          ? "bg-[#1E5AFF] text-white rotate-180"
                          : "bg-white text-[#555C68] group-hover:text-[#1E5AFF] shadow-xs"
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Accordion Content Wrap */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: MOTION_EASE }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-2 text-xs sm:text-base text-[#646464] leading-relaxed border-t border-[#1E5AFF]/15">
                          <p>{item.desc}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Right Column: Sticky High-Quality Dental Clinic Photograph */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 self-start relative">
            <motion.div
              ref={imageContainerRef}
              initial={{ clipPath: "inset(8% 0% 8% 0%)", opacity: 0 }}
              whileInView={{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, ease: MOTION_EASE }}
              className="relative w-full h-[380px] sm:h-[480px] lg:h-[560px] rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-2xl border border-[#060C16]/10 bg-[#060C16] group"
            >
              <img
                ref={imageRef}
                src="/src/assets/images/vantage_about_modern_clinic_1793342492297.jpg"
                alt="First Avenue Family Dentistry in St. Thomas"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center will-change-transform scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#060C16]/90 via-[#060C16]/30 to-transparent pointer-events-none" />

              {/* Bottom Card Overlay */}
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 p-4 sm:p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white space-y-2.5 sm:space-y-3 z-10 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-[#1E5AFF] text-white">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>First Avenue Family Dentistry</span>
                  </span>
                  <span className="text-[11px] font-mono text-white/80">
                    St. Thomas, ON
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-base sm:text-lg font-bold leading-snug">
                    308 Wellington street, St. Thomas, ON N5R 2S9
                  </h4>
                  <p className="text-xs text-white/80 leading-relaxed">
                    State-of-the-art equipment in a welcoming, comfortable clinic.
                  </p>
                </div>

                <div className="pt-2 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-white/90">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#4E8FFF]" />
                    Mon. to Fri: 9am to 6pm
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#52B788]" />
                    Saturdays: 9 am to 5 pm
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
