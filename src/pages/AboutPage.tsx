import { useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { MOTION_EASE, pageTransitionVariants } from "../lib/animation";
import CoreValuesSection from "../components/CoreValuesSection";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface AboutPageProps {
  onBookClick: (serviceTitle?: string) => void;
  onNavigate: (page: string) => void;
}

export default function AboutPage({ onBookClick, onNavigate }: AboutPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroBgRef = useRef<HTMLImageElement>(null);
  const storyImageRef = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      if (heroBgRef.current) {
        gsap.to(heroBgRef.current, {
          yPercent: 10,
          scale: 1.04,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (storyImageRef.current) {
        gsap.fromTo(
          storyImageRef.current,
          { scale: 1.12, yPercent: -4 },
          {
            scale: 1,
            yPercent: 4,
            ease: "none",
            scrollTrigger: {
              trigger: storyImageRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      }
    },
    { scope: containerRef }
  );

  return (
    <motion.div
      ref={containerRef}
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full bg-[#F4F7FF] text-[#060C16]"
    >
      {/* 1. About Hero Section */}
      <section className="relative w-full min-h-[82vh] lg:min-h-[92vh] flex items-center bg-[#060C16] text-white overflow-hidden rounded-b-[32px] sm:rounded-b-[48px] lg:rounded-b-[60px]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            ref={heroBgRef}
            src="/src/assets/images/oravo_about_hero_1793347437065.jpg"
            alt="Welcome to First Avenue Family Dentistry"
            className="w-full h-full object-cover object-[center_30%] scale-102 will-change-transform"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060C16]/92 via-[#060C16]/65 to-[#060C16]/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060C16] via-transparent to-[#060C16]/60" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-12 pt-28 pb-16 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-end">
            {/* Left 8 cols */}
            <div className="lg:col-span-8 space-y-5 sm:space-y-7">

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: MOTION_EASE }}
                className="space-y-1"
              >
                <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-white leading-[1.08] text-balance">
                  Welcome to First Avenue
                  <br className="hidden sm:inline" /> Family Dentistry
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: MOTION_EASE }}
                className="space-y-4 pt-1 sm:pt-2 max-w-2xl"
              >
                <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                  Your health and comfort is our top priority. We offer quality dental services and guidance which will set you on the path for a lifetime of exceptional dental and oral health. The foundation of a beautiful smile is a healthy smile.
                </p>
                <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                  First Avenue Family Dental team provides family dental care, cosmetic dentistry, dental implants, dentures, sedation, teeth whitening, orthodontics, and so much more. Therefore, with a full range of services, our patients can enjoy quality attention in just one convenient location. Our team is excited to make your first appointment at our First Avenue Family Dental a wonderful experience for both you and your family.
                </p>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => onBookClick()}
                    className="group inline-flex items-center gap-3 pl-2 pr-6 py-2 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-xl hover:shadow-[#1E5AFF]/35 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-white text-[#1E5AFF] flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 shadow-xs">
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <span>Schedule Your Visit Today</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate("services")}
                    className="px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-white hover:bg-white/10 border border-white/20 transition-colors cursor-pointer"
                  >
                    Dental Services
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Right 4 cols: Floating Glass Card */}
            <div className="lg:col-span-4 flex lg:justify-end">
              <div className="w-full sm:max-w-md lg:max-w-[350px] p-5 rounded-[24px] bg-white/10 backdrop-blur-md border border-white/15 shadow-2xl space-y-4">
                <div className="relative rounded-[16px] overflow-hidden aspect-[16/10] bg-[#060C16]">
                  <img
                    src="/src/assets/images/vantage_about_dentist_consultation_1793342491438.jpg"
                    alt="First Avenue Family Dentistry in St. Thomas"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className="absolute bottom-2.5 left-3 text-[11px] font-semibold text-white/95">
                    308 Wellington street, St. Thomas, ON N5R 2S9
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    First Avenue Family Dental
                  </h4>
                  <p className="text-xs text-white/80 leading-relaxed">
                    With a helpful and friendly team, First Avenue Family Dental offers the great community of St. Thomas, Ontario dental care that is attentive and also pleasant.
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[#A5C8FF] font-medium">
                  <span>Call 519 207 6890</span>
                  <span>New Patients Welcome!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. The Leading Family Dental Care Clinic — Comprehensive care in St. Thomas, ON */}
      <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-white border-b border-[#E9EDF0]">
        <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            {/* Story Text (7 cols) */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-6">
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#060C16] leading-[1.16]">
                Comprehensive care in St. Thomas, ON
              </h2>

              <p className="text-sm sm:text-base text-[#646464] leading-relaxed">
                Are you on the lookout for comprehensive dental care in St. Thomas, ON? Head over to First Avenue Dentistry today where your dental health and comfort are our top priorities.
              </p>

              <p className="text-sm sm:text-base text-[#646464] leading-relaxed">
                As one of the leading dental care clinics in St. Thomas, ON, we take pride in our unparalleled expertise and incomparable experience. We understand the importance of a healthy smile and the peace of mind that comes with knowing you have access to emergency dental services when you need them the most.
              </p>

              <p className="text-sm sm:text-base text-[#646464] leading-relaxed">
                Our team of dental care experts is committed to excellence and goes beyond just emergency care; we offer a wide range of services encompassing family dentistry and cosmetic dentistry to ensure every aspect of your dental health is addressed with compassion.
              </p>

              {/* OUR VALUE — What you can expect from our team */}
              <div className="pt-4 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E5AFF]">
                  OUR VALUE — What you can expect from our team
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
                  <div className="h-full p-4 rounded-xl bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col justify-start space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#060C16]">
                      <CheckCircle2 className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                      <span>Compassionate care</span>
                    </div>
                    <p className="text-xs text-[#646464] leading-relaxed">
                      Every aspect of your dental health is addressed with compassion.
                    </p>
                  </div>

                  <div className="h-full p-4 rounded-xl bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col justify-start space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#060C16]">
                      <CheckCircle2 className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                      <span>Trusted expertise</span>
                    </div>
                    <p className="text-xs text-[#646464] leading-relaxed">
                      Unparalleled expertise and incomparable experience you can rely on.
                    </p>
                  </div>

                  <div className="h-full p-4 rounded-xl bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col justify-start space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#060C16]">
                      <CheckCircle2 className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                      <span>Modern environment</span>
                    </div>
                    <p className="text-xs text-[#646464] leading-relaxed">
                      State-of-the-art equipment in a welcoming, comfortable clinic.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Story Image with Sticky Positioning & Parallax (5 cols) */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 self-start relative">
              <motion.div
                initial={{ clipPath: "inset(10% 0% 10% 0%)", opacity: 0 }}
                whileInView={{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.85, ease: MOTION_EASE }}
                className="relative rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-2xl aspect-[4/4.5] sm:aspect-[4/5] bg-[#060C16]"
              >
                <img
                  ref={storyImageRef}
                  src="/src/assets/images/vantage_about_modern_clinic_1793342492297.jpg"
                  alt="Modern environment at First Avenue Dentistry"
                  className="w-full h-full object-cover will-change-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060C16]/85 via-transparent to-transparent pointer-events-none" />

                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>First Avenue Family Dentistry</span>
                    <ShieldCheck className="w-4 h-4 text-[#4E8FFF]" />
                  </div>
                  <p className="text-[11px] text-white/80 leading-relaxed">
                    Are you looking for a St. Thomas dentist? Call 519 207 6890 or visit our dental clinic for personalized dental care for patients of all ages.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Values Grid */}
      <CoreValuesSection onExploreServices={() => onNavigate("services")} />

      {/* 4. Three Pillars Highlight Strip (01, 02, 03 from About Us / Our Team page) */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-12 bg-[#060C16] text-white">
        <div className="max-w-[1360px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          <div className="h-full p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-start space-y-2">
            <span className="font-mono text-xl sm:text-2xl lg:text-3xl font-bold text-[#4E8FFF]">
              01 — Emergency Dental Care
            </span>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              We offer quick and immediate care services for all kinds of dental emergencies. Our emergency dental clinic is equipped with state-of-the-art equipment and leading-edge technology to handle a variety of urgent dental concerns.
            </p>
          </div>

          <div className="h-full p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-start space-y-2">
            <span className="font-mono text-xl sm:text-2xl lg:text-3xl font-bold text-[#4E8FFF]">
              02 — Family Dental Care
            </span>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              At First Avenue Dentistry, we believe in nurturing healthy smiles for the whole family. Our family dental care services are designed to meet the needs of patients of all ages.
            </p>
          </div>

          <div className="h-full p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-start space-y-2">
            <span className="font-mono text-xl sm:text-2xl lg:text-3xl font-bold text-[#4E8FFF]">
              03 — Cosmetic Dentistry
            </span>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              Our cosmetic dentistry services will help enhance the appearance of your teeth and boost your self-confidence. From teeth whitening and porcelain veneers to dental implants, we can do it all.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Consultation Call to Action */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#F4F7FF]">
        <div className="max-w-[1100px] mx-auto p-6 sm:p-14 rounded-[28px] sm:rounded-[32px] bg-white border border-[#E9EDF0] shadow-xl text-center space-y-5 sm:space-y-6">
          <h3 className="text-2xl sm:text-4xl font-bold text-[#060C16] tracking-tight">
            Schedule Your Visit Today – Call or Book Online!
          </h3>

          <p className="text-sm sm:text-base text-[#646464] max-w-xl mx-auto leading-relaxed">
            We look forward to treating you and your family and seeing your smiles in our First Avenue Family Dental soon!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
            <button
              type="button"
              onClick={() => onBookClick()}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-md cursor-pointer"
            >
              Request An Appointment Today
            </button>

            <a
              href="tel:5192076890"
              className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-white hover:bg-[#F4F7FF] text-[#060C16] text-xs sm:text-sm font-semibold border border-[#C9C9D0] transition-colors"
            >
              Call 519 207 6890
            </a>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
