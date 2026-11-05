import { useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Phone, MapPin, Clock, Mail } from "lucide-react";
import { MOTION_EASE } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface HeroSectionProps {
  onBookClick?: () => void;
  onOpenAI?: () => void;
}

export default function HeroSection({ onBookClick }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroBgRef = useRef<HTMLImageElement>(null);
  const infoCardRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Gentle parallax effect on the background image
      if (heroBgRef.current) {
        gsap.to(heroBgRef.current, {
          yPercent: 12,
          scale: 1.05,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (infoCardRef.current) {
        gsap.fromTo(
          infoCardRef.current,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            delay: 0.3,
            ease: "power2.out",
          }
        );
      }
    },
    { scope: containerRef }
  );

  return (
    <section
      id="hero"
      ref={containerRef}
      className="relative w-full min-h-[92vh] lg:min-h-screen flex items-center bg-[#060C16] text-white overflow-hidden rounded-b-[36px] sm:rounded-b-[48px] lg:rounded-b-[60px]"
    >
      {/* Cinematic Portrait Background Image */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          ref={heroBgRef}
          src="/src/assets/images/hero_smile_portrait_1793346677082.jpg"
          alt="First Avenue Dentistry"
          referrerPolicy="no-referrer"
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover object-[center_28%] will-change-transform scale-102"
        />
        {/* Measured dark gradient scrim for contrast and legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060C16]/90 via-[#060C16]/65 to-[#060C16]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060C16] via-transparent to-[#060C16]/60" />
      </div>

      {/* Main Hero Content Container */}
      <div className="relative z-10 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-12 pt-28 pb-16 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-end">
          {/* Left Column: Heading, Tags & Value Proposition (8 cols) */}
          <div className="lg:col-span-8 space-y-5 sm:space-y-7">
            {/* Confident Hero Display Heading */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: MOTION_EASE }}
              className="space-y-1"
            >
              <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-white leading-[1.08] text-balance">
                Schedule Your Visit Today – Call or Book Online!
              </h1>
            </motion.div>

            {/* Subtext description & CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: MOTION_EASE }}
              className="space-y-5 sm:space-y-6 pt-1 sm:pt-2 max-w-xl"
            >
              <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                Looking for a dental team that makes your comfort and care a priority? Our friendly professionals provide comprehensive general and cosmetic dentistry in a modern, welcoming environment. Whether it’s a routine checkup or a smile makeover, we’re here to make your visit easy and stress-free.
              </p>

              <p className="text-xs sm:text-sm text-[#A5C8FF] font-medium flex items-center gap-2 break-all sm:break-normal">
                <Mail className="w-4 h-4 text-[#4E8FFF] shrink-0" />
                <span>Or Email - firstavenuedentistry@gmail.com</span>
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
                <button
                  type="button"
                  onClick={onBookClick}
                  className="group inline-flex items-center gap-3 pl-2 pr-6 py-2 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-xl hover:shadow-[#1E5AFF]/35 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-white text-[#1E5AFF] flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 shadow-xs">
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <span>Book Online</span>
                </button>

                <a
                  href="tel:5192076890"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs sm:text-sm font-medium text-white/85 hover:text-white border border-white/15 hover:border-white/35 bg-white/5 backdrop-blur-xs transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-[#4E8FFF]" />
                  <span>519 207 6890</span>
                </a>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Clinic Card (4 cols) */}
          <div className="lg:col-span-4 flex lg:justify-end">
            <div
              ref={infoCardRef}
              className="w-full sm:max-w-md lg:max-w-[350px] p-5 sm:p-6 rounded-[28px] bg-white/10 backdrop-blur-md border border-white/15 shadow-2xl space-y-5"
            >
              {/* Join Our Family of Smiles Block */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-white leading-snug">
                    Join Our Family of Smiles
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#A5C8FF]">
                  – New Patients Welcome!
                </p>

                {/* Overlapping Patient Avatars */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5 overflow-hidden shrink-0">
                    <img
                      src="/src/assets/images/vantage_about_dentist_consultation_1793342491438.jpg"
                      alt="Patient avatar 1"
                      className="inline-block h-9 w-9 rounded-full ring-2 ring-[#060C16] object-cover"
                    />
                    <img
                      src="/src/assets/images/hero_smile_portrait_1793346677082.jpg"
                      alt="Patient avatar 2"
                      className="inline-block h-9 w-9 rounded-full ring-2 ring-[#060C16] object-cover"
                    />
                    <img
                      src="/src/assets/images/oravo_about_hero_1793347437065.jpg"
                      alt="Patient avatar 3"
                      className="inline-block h-9 w-9 rounded-full ring-2 ring-[#060C16] object-cover"
                    />
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1E5AFF] font-bold text-sm ring-2 ring-[#060C16]">
                      +
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-white/90 leading-tight">
                    Open 6 days a week
                    <br />
                    – Saturday included
                  </span>
                </div>
              </div>

              {/* Clinic Location & Hours Badge */}
              <div className="pt-3 border-t border-white/10 space-y-2 text-xs text-white/85">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#4E8FFF] shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    308 Wellington street, St. Thomas, ON N5R 2S9
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#4E8FFF] shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    Mon. to Fri: 9am to 6pm · Saturdays: 9 am to 5 pm
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={onBookClick}
                  className="w-full py-2.5 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold tracking-wide transition-all shadow-md text-center cursor-pointer"
                >
                  Request An Appointment Today
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
