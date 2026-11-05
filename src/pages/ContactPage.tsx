import { useRef } from "react";
import { motion } from "motion/react";
import ContactSection from "../components/ContactSection";
import { pageTransitionVariants } from "../lib/animation";

interface ContactPageProps {
  onBookClick: (serviceTitle?: string) => void;
  onNavigate: (page: string) => void;
}

export default function ContactPage({ onBookClick }: ContactPageProps) {
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
      <section className="relative w-full min-h-[48vh] sm:min-h-[55vh] flex items-center bg-[#060C16] text-white pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6 lg:px-12 rounded-b-[32px] sm:rounded-b-[48px]">
        <div className="max-w-[1360px] mx-auto w-full space-y-5 sm:space-y-6">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] max-w-3xl">
            308 Wellington street, St. Thomas, ON N5R 2S9
          </h1>

          <p className="text-xs sm:text-base text-white/80 leading-relaxed max-w-2xl break-words">
            Tel: 519 207 6890 · Email: firstavenuedentistry@gmail.com · Mon. to Fri: 9am to 6pm · Saturdays: 9 am to 5 pm
          </p>
        </div>
      </section>

      {/* Main Contact Section with Form & Interactive Map */}
      <ContactSection onBookClick={onBookClick} />
    </motion.div>
  );
}
