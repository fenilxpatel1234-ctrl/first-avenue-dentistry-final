import { useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MOTION_EASE } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface AboutSectionProps {
  onLearnMoreClick?: () => void;
  onBookClick?: () => void;
}

export default function AboutSection({
  onLearnMoreClick,
  onBookClick,
}: AboutSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const leftImageRef = useRef<HTMLDivElement>(null);
  const rightImageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Subtle parallax effect on the flanking imagery
      if (leftImageRef.current) {
        gsap.fromTo(
          leftImageRef.current,
          { y: 35 },
          {
            y: -25,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      }

      if (rightImageRef.current) {
        gsap.fromTo(
          rightImageRef.current,
          { y: -25 },
          {
            y: 35,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      }
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative w-full py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-white text-[#060C16] overflow-hidden"
    >
      <div className="max-w-[1360px] mx-auto space-y-10 lg:space-y-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Flanking Image with Clipping Mask Reveal (3 cols on desktop) */}
          <div
            ref={leftImageRef}
            className="hidden lg:block lg:col-span-3 space-y-4"
          >
            <motion.div
              initial={{ clipPath: "inset(12% 0% 12% 0%)", opacity: 0 }}
              whileInView={{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.9, ease: MOTION_EASE }}
              className="relative rounded-[28px] overflow-hidden shadow-xl aspect-[3/4] bg-[#060C16] group"
            >
              <img
                src="/src/assets/images/vantage_about_dentist_consultation_1793342491438.jpg"
                alt="First Avenue Family Dentistry consultation"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-106 will-change-transform"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-white/95 backdrop-blur-md text-xs font-semibold text-[#060C16] shadow-xs">
                Comfort-first care
              </div>
            </motion.div>
          </div>

          {/* Center Column: Editorial Narrative (6 cols) */}
          <div className="lg:col-span-6 flex flex-col items-center text-center space-y-5 sm:space-y-6 px-1 sm:px-2">

            <motion.h2
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: MOTION_EASE }}
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#060C16] tracking-tight leading-[1.14]"
              style={{ textWrap: "balance" }}
            >
              Welcome to First Avenue Family Dentistry
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: MOTION_EASE }}
              className="text-sm sm:text-base text-[#646464] leading-relaxed max-w-xl space-y-4"
            >
              <p>
                Your health and comfort is our top priority. We offer quality dental services and guidance which will set you on the path for a lifetime of exceptional dental and oral health. The foundation of a beautiful smile is a healthy smile.
              </p>
              <p>
                First Avenue Family Dental team provides family dental care, cosmetic dentistry, dental implants, dentures, sedation, teeth whitening, orthodontics, and so much more. Therefore, with a full range of services, our patients can enjoy quality attention in just one convenient location. Our team is excited to make your first appointment at our First Avenue Family Dental a wonderful experience for both you and your family.
              </p>
              <p>
                With a helpful and friendly team, First Avenue Family Dental offers the great community of St. Thomas, Ontario dental care that is attentive and also pleasant. Are you looking for a St. Thomas dentist? Call 519 207 6890 or visit our dental clinic for personalized dental care for patients of all ages. We look forward to treating you and your family and seeing your smiles in our First Avenue Family Dental soon!
              </p>
            </motion.div>

            {/* Core commitments list */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.28, ease: MOTION_EASE }}
              className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-medium text-[#060C16] pt-1"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E5AFF]" />
                Comfort-first care
              </span>
              <span className="hidden sm:inline text-[#C9C9D0]">·</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E5AFF]" />
                Family-friendly
              </span>
              <span className="hidden sm:inline text-[#C9C9D0]">·</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E5AFF]" />
                Open 6 days a week – Saturday included
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.35, ease: MOTION_EASE }}
              className="pt-2 sm:pt-3 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            >
              <button
                type="button"
                onClick={onLearnMoreClick}
                className="oravo-button-pill"
              >
                <div className="oravo-arrow-gradient">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span>About Us</span>
              </button>

              <button
                type="button"
                onClick={onBookClick}
                className="px-6 py-3 rounded-full text-xs font-semibold text-[#060C16] hover:bg-[#F4F7FF] border border-[#C9C9D0] transition-colors cursor-pointer"
              >
                Request Appointment
              </button>
            </motion.div>
          </div>

          {/* Right Flanking Image with Clipping Mask Reveal (3 cols on desktop) */}
          <div
            ref={rightImageRef}
            className="hidden lg:block lg:col-span-3 space-y-4"
          >
            <motion.div
              initial={{ clipPath: "inset(12% 0% 12% 0%)", opacity: 0 }}
              whileInView={{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.9, ease: MOTION_EASE }}
              className="relative rounded-[28px] overflow-hidden shadow-xl aspect-[3/4] bg-[#060C16] group"
            >
              <img
                src="/src/assets/images/vantage_about_modern_clinic_1793342492297.jpg"
                alt="First Avenue Dentistry clinic"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-106 will-change-transform"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-white/95 backdrop-blur-md text-xs font-semibold text-[#060C16] shadow-xs">
                Modern, welcoming environment
              </div>
            </motion.div>
          </div>
        </div>

        {/* Mobile & Tablet Visual Pair (visible below lg breakpoint) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:hidden">
          <div className="relative rounded-[24px] overflow-hidden shadow-md aspect-[16/10] bg-[#060C16]">
            <img
              src="/src/assets/images/vantage_about_dentist_consultation_1793342491438.jpg"
              alt="First Avenue Family Dentistry consultation"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-xs font-semibold text-[#060C16] text-center">
              Comfort-first care
            </div>
          </div>

          <div className="relative rounded-[24px] overflow-hidden shadow-md aspect-[16/10] bg-[#060C16]">
            <img
              src="/src/assets/images/vantage_about_modern_clinic_1793342492297.jpg"
              alt="First Avenue Dentistry clinic"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-xs font-semibold text-[#060C16] text-center">
              Modern, welcoming environment
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
