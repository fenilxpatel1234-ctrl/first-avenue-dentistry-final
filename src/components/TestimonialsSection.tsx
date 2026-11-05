import { useRef } from "react";
import { motion } from "motion/react";
import {
  Heart,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Building2,
} from "lucide-react";
import { MOTION_EASE } from "../lib/animation";

interface TestimonialsSectionProps {
  onBookClick?: () => void;
}

export default function TestimonialsSection({
  onBookClick,
}: TestimonialsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="testimonial-section relative w-full py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-[#F4F7FF] text-[#060C16] border-t border-[#E9EDF0] overflow-hidden"
    >
      <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
        {/* Section Heading — What you can expect from our team */}
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4 sm:space-y-5">

          <h2
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#060C16] tracking-tight leading-[1.16]"
            style={{ textWrap: "balance" }}
          >
            What you can expect from our team
          </h2>

          <p className="text-sm sm:text-base text-[#646464] leading-relaxed max-w-lg">
            With a helpful and friendly team, First Avenue Family Dental offers the great community of St. Thomas, Ontario dental care that is attentive and also pleasant.
          </p>
        </div>

        {/* 3 Value Cards from Original Website */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {/* Card 1: Compassionate care */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: MOTION_EASE }}
            className="h-full p-6 sm:p-8 rounded-[24px] bg-white border border-[#E9EDF0] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                <Heart className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-xl font-bold text-[#060C16]">
                Compassionate care
              </h3>
              <p className="text-sm text-[#646464] leading-relaxed">
                Every aspect of your dental health is addressed with compassion.
              </p>
            </div>

            <div className="pt-4 border-t border-[#E9EDF0] flex items-center gap-2 text-xs font-semibold text-[#1E5AFF]">
              <CheckCircle2 className="w-4 h-4 text-[#52B788] shrink-0" />
              <span>Comfort-first care</span>
            </div>
          </motion.div>

          {/* Card 2: Trusted expertise */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease: MOTION_EASE }}
            className="h-full p-6 sm:p-8 rounded-[24px] bg-white border border-[#E9EDF0] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-xl font-bold text-[#060C16]">
                Trusted expertise
              </h3>
              <p className="text-sm text-[#646464] leading-relaxed">
                Unparalleled expertise and incomparable experience you can rely on.
              </p>
            </div>

            <div className="pt-4 border-t border-[#E9EDF0] flex items-center gap-2 text-xs font-semibold text-[#1E5AFF]">
              <CheckCircle2 className="w-4 h-4 text-[#52B788] shrink-0" />
              <span>Family-friendly for all ages</span>
            </div>
          </motion.div>

          {/* Card 3: Modern environment */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, ease: MOTION_EASE }}
            className="h-full p-6 sm:p-8 rounded-[24px] bg-[#060C16] text-white border border-white/10 shadow-xl flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 text-[#4E8FFF] flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Modern environment
              </h3>
              <p className="text-sm text-white/75 leading-relaxed">
                State-of-the-art equipment in a welcoming, comfortable clinic.
              </p>
            </div>

            <div className="pt-4 border-t border-white/15 flex items-center justify-between gap-2">
              <a
                href="https://www.google.com/maps/search/?api=1&query=First+Avenue+Dentistry+308+Wellington+Street+St+Thomas+ON"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A5C8FF] hover:text-white transition-colors"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>

              <button
                type="button"
                onClick={onBookClick}
                className="px-4 py-1.5 rounded-full bg-[#1E5AFF] text-white text-xs font-semibold hover:bg-[#0452FF] transition-all cursor-pointer shrink-0"
              >
                Book Online
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
