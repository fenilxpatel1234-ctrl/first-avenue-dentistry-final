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
import { ServiceItem } from "../components/ServiceDetailModal";
import { ORAVO_SERVICES } from "../components/ServicesSection";
import { SERVICE_CATEGORY_COLUMNS } from "../data/servicesData";
import { MOTION_EASE, pageTransitionVariants } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface ServicesPageProps {
  onSelectService: (service: ServiceItem) => void;
  onBookClick: (serviceTitle?: string) => void;
  onNavigate: (page: string, serviceId?: string) => void;
}

export default function ServicesPage({
  onSelectService,
  onBookClick,
  onNavigate,
}: ServicesPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroBgRef = useRef<HTMLImageElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

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

      const cards = gsap.utils.toArray<HTMLElement>(".service-page-card");
      gsap.fromTo(
        cards,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
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
      {/* 1. Services Hero Section */}
      <section className="relative w-full min-h-[82vh] lg:min-h-[92vh] flex items-center bg-[#060C16] text-white overflow-hidden rounded-b-[32px] sm:rounded-b-[48px] lg:rounded-b-[60px]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            ref={heroBgRef}
            src="/src/assets/images/oravo_services_hero_1793347451270.jpg"
            alt="First Avenue Family Dentistry Services"
            className="w-full h-full object-cover object-[center_25%] scale-102 will-change-transform"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060C16]/92 via-[#060C16]/65 to-[#060C16]/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060C16] via-transparent to-[#060C16]/60" />
        </div>

        {/* Content */}
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
                  Comprehensive Dental Care
                  <br className="hidden sm:inline" /> in St. Thomas, ON
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: MOTION_EASE }}
                className="space-y-5 sm:space-y-6 pt-1 sm:pt-2 max-w-xl"
              >
                <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                  Have you been on the lookout for comprehensive dental services in St. Thomas, ON? Head over to the leading family dental care clinic: First Avenue Family Dentistry today. We are the top dental care clinic providing a wide range of dental services to meet the diverse needs of our patients. Our highly skilled team of dental experts has had years of training and is licensed to provide dependable emergency dental care. Here is what you can expect at our family dental care clinic:
                </p>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => onBookClick()}
                    className="group inline-flex items-center gap-3 pl-2 pr-6 py-2 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-xl hover:shadow-[#1E5AFF]/35 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-white text-[#1E5AFF] flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 shadow-xs">
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <span>Book Online</span>
                  </button>

                  <a
                    href="tel:5192076890"
                    className="px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-white hover:bg-white/10 border border-white/20 transition-colors"
                  >
                    Call 519 207 6890
                  </a>
                </div>
              </motion.div>
            </div>

            {/* Right 4 cols: Floating Glass Card */}
            <div className="lg:col-span-4 flex lg:justify-end">
              <div
                onClick={() => onNavigate("service-detail", "teeth-whitening")}
                className="w-full sm:max-w-md lg:max-w-[350px] p-5 rounded-[24px] bg-white/10 backdrop-blur-md border border-white/15 shadow-2xl flex items-center gap-4 cursor-pointer hover:bg-white/15 transition-all group"
              >
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-[16px] overflow-hidden bg-[#060C16] shrink-0">
                  <img
                    src="/src/assets/images/vantage_service_teeth_whitening_1793343974351.jpg"
                    alt="Teeth Whitening"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>

                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-bold text-white group-hover:text-[#A5C8FF] transition-colors">
                    Teeth Whitening
                  </h4>
                  <p className="text-xs text-white/80 leading-snug">
                    A whiter and brighter smile is on the top of everyone’s list.
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4E8FFF]">
                    <span>Request an appointment</span>
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 shrink-0" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. What You Can Expect & 4 Service Categories from Services Page */}
      <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-white border-b border-[#E9EDF0]">
        <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
          {/* 1, 2, 3 Expect Pillars from Services Page */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
            <div className="h-full p-6 sm:p-7 rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col justify-start space-y-3">
              <span className="font-mono text-sm font-bold text-[#1E5AFF]">
                1 — Emergency Dental Care
              </span>
              <h3 className="text-xl font-bold text-[#060C16]">
                Emergency Dental Care
              </h3>
              <p className="text-xs sm:text-sm text-[#646464] leading-relaxed">
                Dental emergencies can happen at any time. This is why our clinic is here to provide prompt and effective dental services at any time of the day.
              </p>
            </div>

            <div className="h-full p-6 sm:p-7 rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col justify-start space-y-3">
              <span className="font-mono text-sm font-bold text-[#1E5AFF]">
                2 — Family Dental Care Services
              </span>
              <h3 className="text-xl font-bold text-[#060C16]">
                Family Dental Care Services
              </h3>
              <p className="text-xs sm:text-sm text-[#646464] leading-relaxed">
                Our dental services are tailored to meet the unique needs and requirements of our patients of all ages. From routine checkups to cleanings and preventative treatments, we can handle it all.
              </p>
            </div>

            <div className="h-full p-6 sm:p-7 rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col justify-start space-y-3">
              <span className="font-mono text-sm font-bold text-[#1E5AFF]">
                3 — Cosmetic Dentistry
              </span>
              <h3 className="text-xl font-bold text-[#060C16]">
                Cosmetic Dentistry
              </h3>
              <p className="text-xs sm:text-sm text-[#646464] leading-relaxed">
                Our dental care experts are also trained to provide expert cosmetic dentistry services. We are well-versed in the most advanced cosmetic dentistry procedures and techniques to deliver natural-looking and aesthetically appealing results. Don’t just take our word for it! Visit our clinic today to learn more about our dental services.
              </p>
            </div>
          </div>

          {/* 4 Category Lists from Services Page — Top-aligned equal height */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {SERVICE_CATEGORY_COLUMNS.map((col) => (
              <div
                key={col.title}
                className="h-full p-6 rounded-[24px] bg-[#F4F7FF] border border-[#E5EDF8] flex flex-col justify-start space-y-4"
              >
                <h3 className="text-base font-bold text-[#060C16] tracking-tight pb-2 border-b border-[#E0ECFC]">
                  {col.title}
                </h3>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#646464]">
                  {col.items.map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1E5AFF] shrink-0 mt-0.5" />
                      <span className="leading-snug">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* All 12 Services Cards */}
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4 sm:space-y-5 pt-4">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#060C16] leading-[1.16]">
              Dental Services
            </h2>

            <p className="text-sm sm:text-base text-[#646464] leading-relaxed max-w-lg">
              First Avenue Family Dental team provides family dental care, cosmetic dentistry, dental implants, dentures, sedation, teeth whitening, orthodontics, and so much more.
            </p>
          </div>

          <div
            ref={cardsContainerRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch"
          >
            {ORAVO_SERVICES.map((service) => (
              <div
                key={service.id}
                className="service-page-card h-full rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] p-5 sm:p-7 flex flex-col justify-between space-y-6 hover:shadow-xl hover:border-[#1E5AFF]/30 transition-all duration-300 group"
              >
                <div className="space-y-5">
                  <div className="relative rounded-[18px] overflow-hidden aspect-[16/10] bg-[#060C16] shrink-0">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108 will-change-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/95 backdrop-blur-md text-[#060C16] shadow-xs">
                      {service.category}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-bold text-[#060C16] tracking-tight group-hover:text-[#1E5AFF] transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#646464] leading-relaxed line-clamp-3">
                      {service.details}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {service.highlights.slice(0, 3).map((hl, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[#060C16]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1E5AFF] shrink-0 mt-0.5" />
                        <span className="leading-snug">{hl}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E9EDF0] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate("service-detail", service.id)}
                    className="oravo-button-small group/btn"
                  >
                    <div className="oravo-arrow-small">
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                    </div>
                    <span className="font-semibold text-xs text-[#060C16]">
                      View Details
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onBookClick(service.title)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#1E5AFF] text-white hover:bg-[#0452FF] transition-colors cursor-pointer shrink-0"
                  >
                    Book Online
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Request Appointment Callout */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-12 bg-[#EAF2FF]">
        <div className="max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-3 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#1E5AFF] text-white">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Join Our Family of Smiles – New Patients Welcome!</span>
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#060C16]">
              Schedule Your Visit Today – Call or Book Online!
            </h3>
            <p className="text-sm text-[#646464] leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Are you looking for a St. Thomas dentist? Call 519 207 6890 or visit our dental clinic at 308 Wellington street, St. Thomas, ON N5R 2S9 for personalized dental care for patients of all ages.
            </p>
          </div>

          <div className="lg:col-span-4 flex justify-center lg:justify-end">
            <button
              type="button"
              onClick={() => onBookClick()}
              className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-[#060C16] hover:bg-[#1E5AFF] text-white text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-md cursor-pointer text-center"
            >
              Request An Appointment Today
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
