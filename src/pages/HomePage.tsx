import { useRef } from "react";
import { motion } from "motion/react";
import HeroSection from "../components/HeroSection";
import CoreValuesSection from "../components/CoreValuesSection";
import ServicesSection from "../components/ServicesSection";
import WhyChooseUsSection from "../components/WhyChooseUsSection";
import TeamSection from "../components/TeamSection";
import TestimonialsSection from "../components/TestimonialsSection";
import FAQSection from "../components/FAQSection";
import ContactSection from "../components/ContactSection";
import { ServiceItem } from "../components/ServiceDetailModal";
import { pageTransitionVariants } from "../lib/animation";

interface HomePageProps {
  onBookClick: (serviceTitle?: string) => void;
  onSelectService: (service: ServiceItem) => void;
  onNavigate: (page: string, serviceId?: string) => void;
  onOpenAI?: () => void;
}

export default function HomePage({
  onBookClick,
  onSelectService,
  onNavigate,
  onOpenAI,
}: HomePageProps) {
  const pageRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={pageRef}
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full"
    >
      {/* Oravo Signature Hero Section */}
      <HeroSection onBookClick={() => onBookClick()} />

      {/* Core Values Asymmetric Showcase */}
      <CoreValuesSection onExploreServices={() => onNavigate("services")} />

      {/* Services Showcase Carousel */}
      <ServicesSection
        onSelectService={(service) => {
          onSelectService(service);
        }}
        onBookClick={() => onBookClick()}
      />

      {/* Why Choose Us Numbered Accordion & Large Clinic Photo */}
      <WhyChooseUsSection onBookClick={() => onBookClick()} />

      {/* Clinical Team / Divisions */}
      <TeamSection onBookClick={() => onBookClick()} />

      {/* Patient Trust & Experience */}
      <TestimonialsSection onBookClick={() => onBookClick()} />

      {/* Frequently Asked Questions */}
      <FAQSection onBookClick={() => onBookClick()} />

      {/* Contact & Clinic Location */}
      <ContactSection onBookClick={() => onBookClick()} />
    </motion.div>
  );
}
