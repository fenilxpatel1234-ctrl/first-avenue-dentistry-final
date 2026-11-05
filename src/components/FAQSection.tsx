import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Plus,
  Minus,
  HelpCircle,
  Phone,
  ArrowRight,
} from "lucide-react";
import { MOTION_EASE } from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface FAQSectionProps {
  onBookClick?: () => void;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: "why-orthodontics",
    question: "Why Orthodontics?",
    answer:
      "Orthodontic treatment helps ensure the proper function of teeth and create healthy smiles. A good bite makes it easier for you to bite, chew and speak. Teeth that are misaligned are harder to clean and can cause abnormal wearing of tooth enamel, and gums diseases which can lead to extensive and expensive dental procedures. Orthodontic treatment can be done with clear aligner which is hardy noticeable. Treatment plans include full records, braces, and retainer. Treatment plans include the mold, model, X-rays, and photos. Free consultations are available and interest-free payment plans can be arranged.",
    category: "Orthodontics",
  },
  {
    id: "child-first-visit",
    question: "When to Take Your Child to the Dentist",
    answer:
      "We recommend you bring your children in for their first appointment when their first teeth begin to erupt, usually just before their first birthday. We can spot potential problems before they develop and will help you to understand the development of your child’s healthy smile. Your child’s twenty primary teeth will find their place around the age of three, making this age essential for creating lifelong oral care habits.",
    category: "Children's Dentistry",
  },
  {
    id: "oral-surgery-flap",
    question: "How well does Oral Surgery (Flap Procedure) work?",
    answer:
      "You may need surgery for severe gum disease (periodontists) if it cannot be controlled with antibiotics or root planning and scaling. A flap procedure cleans the roots of the tooth and repairs bone damage caused by gum disease. It’s necessary to consistently maintain good dental care after the surgery, both in the office with your dental professional and at home. The flap procedure should allow you to clean your teeth and gums more effectively, and your gums should become pink and healthy again.",
    category: "Oral Surgery",
  },
  {
    id: "dental-implant-info",
    question: "How do Dental Implants replace missing teeth?",
    answer:
      "We can help you replace missing teeth and restore your smile and your confidence with dental implants. An implant is an artificial tooth root placed in your jawbone to secure a replacement tooth, bridge, or denture. Dental implants feel natural and do not affect neighboring teeth. With the dental implant in place, you will be able to chew in a way that is nearly identical to how natural teeth function. Dental implants provide more stability and comfort than other forms of tooth replacement and can help prevent the bone loss that can occur naturally from missing teeth.",
    category: "Dental Implant",
  },
  {
    id: "teeth-whitening-info",
    question: "How does Professional Teeth Whitening work?",
    answer:
      "A whiter and brighter smile is on the top of everyone’s list. Our offices can consult you on all the teeth whitening treatments available, and determine which option is best for you. Whether your teeth are discolored or yellow, stained or faded – we can find the best whitening option that fits your lifestyle and needs. Professional teeth whitening can boost your confidence in just one session. When your teeth get 2-6 shades brighter after the first visit, you won’t be able to stop smiling!",
    category: "Teeth Whitening",
  },
  {
    id: "clinic-hours-location",
    question: "Where is First Avenue Family Dentistry located and what are your hours?",
    answer:
      "308 Wellington street, St. Thomas, ON N5R 2S9. Tel: 519 207 6890, Email: firstavenuedentistry@gmail.com. Open 6 days a week – Saturday included: Mon. to Fri: 9am to 6pm, Saturdays: 9 am to 5 pm.",
    category: "Contact Us",
  },
];

export default function FAQSection({ onBookClick }: FAQSectionProps) {
  const [openId, setOpenId] = useState<string | null>("why-orthodontics");
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>(".faq-accordion-card");
      gsap.fromTo(
        items,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );
    },
    { scope: sectionRef }
  );

  const toggleAccordion = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="faq"
      ref={sectionRef}
      className="relative w-full py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 bg-white text-[#060C16] overflow-hidden border-t border-[#E9EDF0]"
    >
      <div className="max-w-[1100px] mx-auto space-y-12 sm:space-y-16">
        {/* Section Heading */}
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4 sm:space-y-5">

          <h2
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#060C16] tracking-tight leading-[1.16]"
            style={{ textWrap: "balance" }}
          >
            Dental Care Information &amp; Guides
          </h2>

          <p className="text-sm sm:text-base text-[#646464] leading-relaxed max-w-lg">
            Are you looking for a St. Thomas dentist? Call 519 207 6890 or visit our dental clinic for personalized dental care for patients of all ages.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div ref={containerRef} className="space-y-3.5 sm:space-y-4">
          {FAQ_DATA.map((item) => {
            const isOpen = openId === item.id;

            return (
              <div
                key={item.id}
                className={`faq-accordion-card transition-all duration-300 rounded-[20px] border ${
                  isOpen
                    ? "bg-[#F8FAFC] border-[#1E5AFF]/40 shadow-md shadow-[#1E5AFF]/5"
                    : "bg-white border-[#E9EDF0] hover:border-[#1E5AFF]/30 hover:bg-[#FAFBFD]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(item.id)}
                  className="w-full text-left py-4 sm:py-5 px-4 sm:px-8 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-lg font-bold text-[#060C16] tracking-tight leading-snug">
                    {item.question}
                  </span>

                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isOpen
                        ? "bg-[#1E5AFF] text-white rotate-180"
                        : "bg-[#EAF2FF] text-[#1E5AFF] hover:bg-[#1E5AFF] hover:text-white"
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: MOTION_EASE }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-8 pb-5 sm:pb-6 pt-2 text-xs sm:text-base text-[#646464] leading-relaxed border-t border-[#E9EDF0]/60">
                        <p>{item.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Bottom Contact Help Card */}
        <div className="p-6 sm:p-10 rounded-[24px] bg-[#EAF2FF] border border-[#1E5AFF]/20 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-[#1E5AFF] flex items-center justify-center shadow-xs shrink-0">
              <HelpCircle className="w-6 h-6 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-[#060C16]">
                Schedule Your Visit Today – Call or Book Online!
              </h3>
              <p className="text-xs sm:text-sm text-[#646464]">
                Or Email - firstavenuedentistry@gmail.com · Takes 30 seconds — we&apos;ll confirm by phone.
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center justify-center gap-3 shrink-0">
            <a
              href="tel:5192076890"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-[#F4F7FF] text-[#060C16] text-xs font-semibold border border-[#C9C9D0] transition-all shadow-xs"
            >
              <Phone className="w-3.5 h-3.5 text-[#1E5AFF]" />
              <span>519 207 6890</span>
            </a>

            <button
              type="button"
              onClick={onBookClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <span>Request An Appointment Today</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
