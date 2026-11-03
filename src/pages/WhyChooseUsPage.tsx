import { useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ShieldCheck,
  CheckCircle2,
  Heart,
} from "lucide-react";
import WhyChooseUsSection from "../components/WhyChooseUsSection";
import { pageTransitionVariants } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface WhyChooseUsPageProps {
  onBookClick: (serviceTitle?: string) => void;
  onNavigate: (page: string) => void;
}

export default function WhyChooseUsPage({
  onBookClick,
  onNavigate,
}: WhyChooseUsPageProps) {
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
      <section className="relative w-full min-h-[50vh] sm:min-h-[60vh] flex items-center bg-[#060C16] text-white pt-28 pb-16 sm:pt-40 sm:pb-24 px-4 sm:px-6 lg:px-12 rounded-b-[28px] sm:rounded-b-[48px]">
        <div className="max-w-[1360px] mx-auto w-full space-y-5 sm:space-y-6">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] max-w-3xl">
            The Leading Family Dental Care Clinic in St. Thomas, ON
          </h1>

          <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl">
            Are you on the lookout for comprehensive dental care in St. Thomas, ON? Head over to First Avenue Dentistry today where your dental health and comfort are our top priorities.
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
              onClick={() => onNavigate("services")}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/20 transition-all cursor-pointer"
            >
              Dental Services
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Numbered Accordion & Large Photo */}
      <WhyChooseUsSection onBookClick={onBookClick} />

      {/* OUR VALUE Grid */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-white border-t border-[#E9EDF0]">
        <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-4xl font-bold text-[#060C16]">
              What you can expect from our team
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            <div className="h-full flex flex-col justify-start p-6 sm:p-8 rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                <Heart className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-lg font-bold text-[#060C16]">
                Compassionate care
              </h3>
              <p className="text-xs sm:text-sm text-[#646464] leading-relaxed">
                Every aspect of your dental health is addressed with compassion.
              </p>
            </div>

            <div className="h-full flex flex-col justify-start p-6 sm:p-8 rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-lg font-bold text-[#060C16]">
                Trusted expertise
              </h3>
              <p className="text-xs sm:text-sm text-[#646464] leading-relaxed">
                Unparalleled expertise and incomparable experience you can rely on.
              </p>
            </div>

            <div className="h-full flex flex-col justify-start p-6 sm:p-8 rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-lg font-bold text-[#060C16]">
                Modern environment
              </h3>
              <p className="text-xs sm:text-sm text-[#646464] leading-relaxed">
                State-of-the-art equipment in a welcoming, comfortable clinic.
              </p>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
