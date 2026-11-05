import { useRef } from "react";
import { motion } from "motion/react";
import { Heart, Users, MapPin, Calendar, ArrowRight } from "lucide-react";
import { staggerContainerVariants, staggerCardVariants } from "../lib/animation";

const WHY_PATIENTS_CHOOSE_US = [
  {
    id: "comfort-first",
    icon: Heart,
    title: "Comfort-first care",
    desc: "Modern, welcoming environment built around you.",
  },
  {
    id: "family-friendly-ages",
    icon: Users,
    title: "Family-friendly",
    desc: "All ages, from first visits to senior care.",
  },
  {
    id: "family-friendly-location",
    icon: MapPin,
    title: "Family-friendly",
    desc: "General, cosmetic, emergency & more- location",
  },
  {
    id: "open-6-days",
    icon: Calendar,
    title: "Open 6 days a week",
    desc: "Open 6 days a week – Saturday included",
  },
];

interface CoreValuesSectionProps {
  onExploreServices?: () => void;
}

export default function CoreValuesSection({ onExploreServices }: CoreValuesSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      id="values"
      ref={sectionRef}
      className="relative w-full py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-white text-[#060C16] border-t border-[#E9EDF0] overflow-hidden"
    >
      <div className="max-w-[1360px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left Column: 2x2 Grid of 4 Cards — Why Patients choose us (7 cols) */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 items-stretch"
            >
              {WHY_PATIENTS_CHOOSE_US.map((val) => {
                const IconComp = val.icon;
                return (
                  <motion.div
                    key={val.id}
                    variants={staggerCardVariants}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className="h-full p-6 sm:p-8 rounded-[24px] bg-[#F4F7FF] border border-[#E5EDF8] flex flex-col justify-start space-y-5 hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white text-[#1E5AFF] flex items-center justify-center border border-[#E0ECFC] shadow-xs group-hover:scale-105 transition-transform shrink-0">
                      <IconComp className="w-5 h-5 stroke-[2]" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-[#060C16] tracking-tight group-hover:text-[#1E5AFF] transition-colors">
                        {val.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#646464] leading-relaxed">
                        {val.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Right Column: The Leading Family Dental Care Clinic in St. Thomas, ON (5 cols) */}
          <div className="lg:col-span-5 space-y-5 order-1 lg:order-2">
            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#060C16] tracking-tight leading-[1.14]"
              style={{ textWrap: "balance" }}
            >
              The Leading Family Dental Care Clinic in St. Thomas, ON
            </h2>

            <div className="text-sm sm:text-base text-[#646464] leading-relaxed space-y-4">
              <p>
                Are you on the lookout for comprehensive dental care in St. Thomas, ON? Head over to First Avenue Dentistry today where your dental health and comfort are our top priorities.
              </p>
              <p>
                As one of the leading dental care clinics in St. Thomas, ON, we take pride in our unparalleled expertise and incomparable experience. We understand the importance of a healthy smile and the peace of mind that comes with knowing you have access to emergency dental services when you need them the most.
              </p>
              <p>
                Our team of dental care experts is committed to excellence and goes beyond just emergency care; we offer a wide range of services encompassing family dentistry and cosmetic dentistry to ensure every aspect of your dental health is addressed with compassion. So what are you waiting for? Head on over to our family dental clinic today for customized dental treatment.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onExploreServices}
                className="oravo-button-pill"
              >
                <div className="oravo-arrow-gradient">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span>Dental Services</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
