import { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Shield,
  Smile,
  Zap,
  Heart,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { ServiceItem } from "./ServiceDetailModal";
import { MOTION_EASE } from "../lib/animation";
import { ALL_SERVICES } from "../data/servicesData";

export interface ServicesSectionProps {
  onSelectService: (service: ServiceItem) => void;
  onBookClick?: () => void;
}

export const ORAVO_SERVICES: ServiceItem[] = ALL_SERVICES;

const SERVICE_ICONS = [Shield, Smile, Zap, Heart, Activity, CheckCircle2];

export default function ServicesSection({
  onSelectService,
}: ServicesSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  const maxIndex = ORAVO_SERVICES.length - 1;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
  };

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative w-full py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-[#EAF2FF] text-[#060C16] overflow-hidden"
    >
      <div className="max-w-[1360px] mx-auto space-y-10 sm:space-y-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-4 max-w-2xl">

            {/* Heading */}
            <motion.h2
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: MOTION_EASE }}
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#060C16] tracking-tight leading-[1.16]"
            >
              Dental Services
            </motion.h2>
          </div>

          {/* Slider Navigation Arrows */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous services"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white hover:bg-[#060C16] text-[#060C16] hover:text-white border border-[#C9C9D0] flex items-center justify-center transition-all duration-300 shadow-sm cursor-pointer group"
            >
              <ArrowLeft className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next services"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white hover:bg-[#060C16] text-[#060C16] hover:text-white border border-[#C9C9D0] flex items-center justify-center transition-all duration-300 shadow-sm cursor-pointer group"
            >
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Services Carousel / Cards Grid */}
        <div className="relative overflow-hidden pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
            {[0, 1, 2].map((offset) => {
              const itemIndex = (currentIndex + offset) % ORAVO_SERVICES.length;
              const service = ORAVO_SERVICES[itemIndex];
              const IconComp = SERVICE_ICONS[itemIndex % SERVICE_ICONS.length];

              return (
                <motion.div
                  key={`${service.id}-${itemIndex}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`h-full rounded-[20px] bg-white p-5 sm:p-7 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl transition-all duration-300 group border border-[#060C16]/5 ${
                    offset === 2 ? "md:col-span-2 lg:col-span-1" : ""
                  }`}
                >
                  {/* Top Part: Icon, Heading, Description, View Details Button */}
                  <div className="flex flex-col flex-1 justify-between space-y-5">
                    <div className="space-y-5">
                      <div className="w-12 h-12 rounded-xl bg-[#EAF2FF] text-[#1E5AFF] flex items-center justify-center transition-colors duration-300 group-hover:bg-[#1E5AFF] group-hover:text-white shadow-xs shrink-0">
                        <IconComp className="w-6 h-6 transition-transform duration-300 group-hover:scale-105" />
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-lg sm:text-xl font-bold text-[#060C16] tracking-tight group-hover:text-[#1E5AFF] transition-colors">
                          {service.title}
                        </h3>
                        <p className="text-sm text-[#646464] leading-relaxed line-clamp-3">
                          {service.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectService(service)}
                        className="oravo-button-small group/btn"
                      >
                        <div className="oravo-arrow-small">
                          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                        </div>
                        <span className="font-semibold text-xs text-[#060C16]">
                          View Details
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Bottom Part: Service Image Wrap */}
                  <div className="relative rounded-[16px] overflow-hidden aspect-[16/10] bg-[#060C16] shrink-0 clip-mask-reveal">
                    <img
                      src={service.image}
                      alt={service.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108 will-change-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-8 sm:pt-10">
            {ORAVO_SERVICES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  currentIndex === i
                    ? "w-8 h-2.5 bg-[#1E5AFF]"
                    : "w-2.5 h-2.5 bg-[#C9C9D0] hover:bg-[#060C16]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
