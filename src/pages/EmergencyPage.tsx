import { useRef } from "react";
import { motion } from "motion/react";
import {
  Phone,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import ContactSection from "../components/ContactSection";
import { MOTION_EASE, pageTransitionVariants } from "../lib/animation";

interface EmergencyPageProps {
  onBookClick: (serviceTitle?: string) => void;
  onNavigate: (page: string, serviceId?: string) => void;
}

const EMERGENCY_PILLARS = [
  {
    title: "01 — Emergency Dental Care",
    urgency: "Quick and Immediate Care",
    desc: "We offer quick and immediate care services for all kinds of dental emergencies. Our emergency dental clinic is equipped with state-of-the-art equipment and leading-edge technology to handle a variety of urgent dental concerns.",
    firstAid:
      "Dental emergencies can happen at any time. This is why our clinic is here to provide prompt and effective dental services at any time of the day.",
  },
  {
    title: "02 — Family Dental Care",
    urgency: "Patients of All Ages",
    desc: "At First Avenue Dentistry, we believe in nurturing healthy smiles for the whole family. Our family dental care services are designed to meet the needs of patients of all ages.",
    firstAid:
      "Our dental services are tailored to meet the unique needs and requirements of our patients of all ages. From routine checkups to cleanings and preventative treatments, we can handle it all.",
  },
  {
    title: "03 — Cosmetic & Restorative Care",
    urgency: "State-of-the-Art Equipment",
    desc: "Our cosmetic dentistry services will help enhance the appearance of your teeth and boost your self-confidence. From teeth whitening and porcelain veneers to dental implants, we can do it all.",
    firstAid:
      "Are you looking for a St. Thomas dentist? Call 519 207 6890 or visit our dental clinic at 308 Wellington street, St. Thomas, ON N5R 2S9.",
  },
];

export default function EmergencyPage({
  onBookClick,
  onNavigate,
}: EmergencyPageProps) {
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
      {/* 1. High-Priority Emergency Hero Banner */}
      <section className="relative w-full min-h-[75vh] flex items-center bg-[#060C16] text-white overflow-hidden rounded-b-[32px] sm:rounded-b-[48px] lg:rounded-b-[60px]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src="/src/assets/images/vantage_about_modern_clinic_1793342492297.jpg"
            alt="Emergency Dental Care in St. Thomas, ON"
            className="w-full h-full object-cover object-[center_35%] opacity-30 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060C16] via-[#060C16]/90 to-[#060C16]/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060C16] via-transparent to-[#060C16]/80" />
        </div>

        <div className="relative z-10 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-12 pt-28 pb-16 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-28">
          <div className="max-w-3xl space-y-5 sm:space-y-7">

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: MOTION_EASE }}
              className="space-y-3"
            >
              <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-white leading-[1.08] text-balance">
                Emergency Dental Care
                <br className="hidden sm:inline" /> in St. Thomas, ON
              </h1>
              <p className="text-sm sm:text-lg text-white/85 leading-relaxed max-w-2xl">
                We offer quick and immediate care services for all kinds of dental emergencies. Our emergency dental clinic is equipped with state-of-the-art equipment and leading-edge technology to handle a variety of urgent dental concerns.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: MOTION_EASE }}
              className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2"
            >
              <a
                href="tel:5192076890"
                className="group inline-flex items-center gap-3 pl-2 pr-6 py-2.5 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-sm font-bold tracking-wide transition-all shadow-xl hover:shadow-[#1E5AFF]/40"
              >
                <div className="w-9 h-9 rounded-full bg-white text-[#1E5AFF] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <Phone className="w-4 h-4" />
                </div>
                <span>Call 519 207 6890</span>
              </a>

              <button
                type="button"
                onClick={() => onBookClick("Emergency Dental Care")}
                className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/20 transition-colors cursor-pointer"
              >
                Request An Appointment Today
              </button>
            </motion.div>

            <div className="pt-4 border-t border-white/15 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-white/75">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#4E8FFF] shrink-0" />
                <span>308 Wellington street, St. Thomas, ON N5R 2S9</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#4E8FFF] shrink-0" />
                <span>Mon. to Fri: 9am to 6pm · Saturdays: 9 am to 5 pm</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Emergency Dental Care Pillars */}
      <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-white border-b border-[#E9EDF0]">
        <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#060C16]">
              Get in Touch
            </h2>
            <p className="text-sm sm:text-base text-[#646464] leading-relaxed">
              Dental emergencies can happen at any time. This is why our clinic is here to provide prompt and effective dental services at any time of the day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
            {EMERGENCY_PILLARS.map((cond, idx) => (
              <div
                key={idx}
                className="h-full p-6 sm:p-7 rounded-[24px] bg-[#F8FAFC] border border-[#E9EDF0] flex flex-col justify-between space-y-6 hover:shadow-xl hover:border-[#1E5AFF]/30 transition-all duration-300"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#1E5AFF]/10 text-[#1E5AFF]">
                      {cond.urgency}
                    </span>
                    <AlertCircle className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                  </div>

                  <h3 className="text-lg font-bold text-[#060C16]">
                    {cond.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#646464] leading-relaxed">
                    {cond.desc}
                  </p>

                  <div className="pt-3 border-t border-[#E9EDF0] space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#060C16]">
                      First Avenue Family Dentistry:
                    </span>
                    <p className="text-xs text-[#060C16]/80 leading-relaxed bg-white p-3 rounded-xl border border-[#E9EDF0]">
                      {cond.firstAid}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onBookClick("Emergency Dental Care")}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#1E5AFF] hover:bg-[#0452FF] text-white transition-colors cursor-pointer text-center"
                  >
                    Book Online
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Why Choose Us For Urgent Dental Care */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#F4F7FF] border-b border-[#E9EDF0]">
        <div className="max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#060C16] leading-tight">
              Comprehensive care in St. Thomas, ON
            </h2>

            <p className="text-sm sm:text-base text-[#646464] leading-relaxed">
              As one of the leading dental care clinics in St. Thomas, ON, we take pride in our unparalleled expertise and incomparable experience. We understand the importance of a healthy smile and the peace of mind that comes with knowing you have access to emergency dental services when you need them the most.
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#1E5AFF] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[#060C16]">
                    Compassionate care
                  </h4>
                  <p className="text-xs text-[#646464]">
                    Every aspect of your dental health is addressed with compassion.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#1E5AFF] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[#060C16]">
                    Trusted expertise
                  </h4>
                  <p className="text-xs text-[#646464]">
                    Unparalleled expertise and incomparable experience you can rely on.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#1E5AFF] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[#060C16]">
                    Modern environment
                  </h4>
                  <p className="text-xs text-[#646464]">
                    State-of-the-art equipment in a welcoming, comfortable clinic.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <a
                href="tel:5192076890"
                className="px-6 py-3 rounded-full bg-[#060C16] hover:bg-[#1E5AFF] text-white text-xs sm:text-sm font-semibold transition-colors"
              >
                Call 519 207 6890
              </a>
              <button
                type="button"
                onClick={() => onNavigate("services")}
                className="text-xs font-semibold text-[#1E5AFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Dental Services</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-2xl aspect-[4/3] bg-[#060C16]">
              <img
                src="/src/assets/images/vantage_about_dentist_consultation_1793342491438.jpg"
                alt="Emergency Dental Care at First Avenue Dentistry"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060C16]/85 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 p-3.5 sm:p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-between text-xs">
                <span>First Avenue Family Dentistry</span>
                <span className="font-semibold text-[#4E8FFF]">St. Thomas, ON</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Get in Touch Form Section */}
      <ContactSection onBookClick={() => onBookClick("Emergency Dental Care")} />
    </motion.div>
  );
}
