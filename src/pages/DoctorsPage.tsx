import { useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import TeamSection from "../components/TeamSection";
import { pageTransitionVariants } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface DoctorsPageProps {
  onBookClick: (serviceTitle?: string) => void;
  onNavigate: (page: string) => void;
}

export default function DoctorsPage({
  onBookClick,
  onNavigate,
}: DoctorsPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={containerRef}
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full bg-[#F4F7FF] text-[#060C16]"
    >
      {/* Page Hero */}
      <section className="relative w-full min-h-[52vh] sm:min-h-[60vh] flex items-center bg-[#060C16] text-white pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6 lg:px-12 rounded-b-[32px] sm:rounded-b-[48px]">
        <div className="max-w-[1360px] mx-auto w-full space-y-5 sm:space-y-6">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] max-w-3xl">
            Welcome to First Avenue Family Dentistry
          </h1>

          <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl">
            Your health and comfort is our top priority. We offer quality dental services and guidance which will set you on the path for a lifetime of exceptional dental and oral health. The foundation of a beautiful smile is a healthy smile.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onBookClick()}
              className="px-6 py-3 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs sm:text-sm font-semibold transition-all shadow-md cursor-pointer"
            >
              Book Online
            </button>

            <button
              type="button"
              onClick={() => onNavigate("about")}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/20 transition-all cursor-pointer"
            >
              About Us
            </button>
          </div>
        </div>
      </section>

      {/* Main Team Section Component */}
      <TeamSection onBookClick={onBookClick} />

      {/* What you can expect from our team */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#F4F7FF]">
        <div className="max-w-[1100px] mx-auto p-6 sm:p-14 rounded-[28px] sm:rounded-[32px] bg-white border border-[#E9EDF0] shadow-sm space-y-8">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-bold text-[#060C16]">
              What you can expect from our team
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-[#646464] leading-relaxed items-stretch">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E9EDF0] space-y-2">
              <span className="font-bold text-sm text-[#060C16] block">
                Compassionate care
              </span>
              <p>
                Every aspect of your dental health is addressed with compassion.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E9EDF0] space-y-2">
              <span className="font-bold text-sm text-[#060C16] block">
                Trusted expertise
              </span>
              <p>
                Unparalleled expertise and incomparable experience you can rely on.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E9EDF0] space-y-2">
              <span className="font-bold text-sm text-[#060C16] block">
                Modern environment
              </span>
              <p>
                State-of-the-art equipment in a welcoming, comfortable clinic.
              </p>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
