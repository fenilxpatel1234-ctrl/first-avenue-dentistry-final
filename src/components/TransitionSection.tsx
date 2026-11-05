import { useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowUpRight,
  HeartHandshake,
  Cpu,
  Users,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { MOTION_EASE } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface TransitionSectionProps {
  onLearnMoreClick?: () => void;
}

const CORE_VALUES = [
  {
    icon: HeartHandshake,
    title: "Compassionate Care",
    desc: "Kindness, empathy, and gentle sedation options so you always feel safe and relaxed.",
  },
  {
    icon: Cpu,
    title: "Advanced Technology",
    desc: "Digital 3D X-rays, intraoral cameras, and modern tools for fast, accurate treatment.",
  },
  {
    icon: Users,
    title: "All-Ages Family Care",
    desc: "From a toddler's very first checkup to restorative care and dentures for seniors.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent & Direct",
    desc: "Upfront pricing, direct insurance billing, and clear answers to every question.",
  },
];

export default function TransitionSection({
  onLearnMoreClick,
}: TransitionSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const imagesContainerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Staggered reveal for about images on scroll
      const images = gsap.utils.toArray<HTMLElement>(".about-reveal-image");
      gsap.fromTo(
        images,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: imagesContainerRef.current,
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
      id="about"
      ref={sectionRef}
      className="relative w-full py-20 md:py-32 px-4 sm:px-6 lg:px-12 bg-[#F4F7FF] text-[#060C16] overflow-hidden"
    >
      <div className="max-w-[1360px] mx-auto space-y-16 md:space-y-24">
        {/* Top Header & Editorial Statement */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-5">
            {/* Editorial Statement */}
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#060C16] leading-[1.18]"
              style={{ textWrap: "balance" }}
            >
              We believe that every smile tells a story — and we’re here to make
              yours healthier, brighter, and confident.
            </h2>
          </div>

          <div className="lg:col-span-4 lg:pt-8 flex lg:justify-end">
            <button
              type="button"
              onClick={onLearnMoreClick}
              className="group relative inline-flex items-center gap-3 pl-6 pr-2 py-2 rounded-full bg-white border border-[#060C16]/15 hover:border-[#1E5AFF]/40 text-[#060C16] text-sm font-semibold tracking-wide shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>Learn More About Our Practice</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#0452FF] to-[#1E5AFF] text-white flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:rotate-45 shadow-sm">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>

        {/* Detailed Description & Key Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-[#555C68] text-base leading-relaxed">
          <div className="lg:col-span-6 space-y-4">
            <p>
              Conveniently located at{" "}
              <strong className="text-[#060C16] font-semibold">
                308 Wellington street, St. Thomas, ON N5R 2S9
              </strong>
              , our modern clinic is designed from the ground up for patient
              relaxation. We combine compassionate care with cutting-edge dental
              technologies so you and your loved ones receive the gentle,
              unhurried attention you deserve.
            </p>
          </div>
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#060C16]">
            {[
              "Emergency visits handled promptly",
              "Direct insurance coordination",
              "Sedation dentistry for anxious patients",
              "Family & pediatric dentistry",
              "Custom implants, crowns & bridges",
              "Invisalign clear aligner therapy",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dual Staggered Image Showcase matching Oravo layout */}
        <div
          ref={imagesContainerRef}
          className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
        >
          {/* Card 1: Dentist Consultation */}
          <div className="about-reveal-image md:col-span-7 relative rounded-3xl overflow-hidden shadow-xl border border-[#060C16]/10 group aspect-[4/3]">
            <img
              src="/src/assets/images/vantage_about_dentist_consultation_1793342491438.jpg"
              alt="Dentist consulting with adult patient in comfortable clinic"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060C16]/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white space-y-1">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-[#1E5AFF] text-white">
                Patient-Centered Care
              </span>
              <h3 className="text-lg md:text-xl font-bold">
                Personalized Treatment Plans with Gentle Touch
              </h3>
            </div>
          </div>

          {/* Card 2: Modern Clinic Operatory */}
          <div className="about-reveal-image md:col-span-5 relative rounded-3xl overflow-hidden shadow-xl border border-[#060C16]/10 group aspect-[4/3] md:translate-y-8">
            <img
              src="/src/assets/images/vantage_about_modern_clinic_1793342492297.jpg"
              alt="Modern dental operatory room with advanced equipment"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060C16]/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white space-y-1">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white">
                Modern Operatories
              </span>
              <h3 className="text-base md:text-lg font-bold">
                Advanced Digital Diagnostics in St. Thomas
              </h3>
            </div>
          </div>
        </div>

        {/* 4 Core Value Cards matching Oravo's core-value-section */}
        <div className="pt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CORE_VALUES.map((val) => {
              const IconComp = val.icon;
              return (
                <motion.div
                  key={val.title}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 rounded-2xl bg-white border border-[#060C16]/10 shadow-sm hover:shadow-md transition-all space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-[#060C16]">
                    {val.title}
                  </h4>
                  <p className="text-xs text-[#555C68] leading-relaxed">
                    {val.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
