import { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  MOTION_EASE,
  staggerContainerVariants,
  staggerCardVariants,
} from "../lib/animation";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const TESTIMONIALS = [
  {
    quote:
      "Replacing fragmented scripts with a unified Motion and GSAP ScrollTrigger pipeline cut our frame drops to zero across mobile Safari and desktop.",
    author: "Elena Rostova",
    role: "VP of Engineering",
    company: "Kinetix Architecture",
    metric: "60 FPS locked across viewports",
  },
  {
    quote:
      "Using Motion for micro-interactions and GSAP timelines for scroll-pinned storytelling gave our product launch page tactile precision.",
    author: "Marcus Vance",
    role: "Principal Product Designer",
    company: "Northstar Atelier",
    metric: "+38% scroll depth completion",
  },
  {
    quote:
      "Automatic cleanup via useGSAP and strict prefers-reduced-motion compliance meant our accessibility audit passed on the first review.",
    author: "David Chen",
    role: "Frontend Architect",
    company: "Fieldwork Systems",
    metric: "100% WCAG AA motion compliance",
  },
];

const FAQ_ITEMS = [
  {
    id: "faq-1",
    question: "How are responsibilities divided between Motion and GSAP?",
    answer:
      "Motion for React handles component-level state transitions: entrance fade-ups, staggered cards, hover/tap feedback, navigation menus, carousels, and accordions. GSAP with ScrollTrigger handles scroll-linked timelines, pinned sections, parallax layers, clip-path image reveals, and scrubbed numeric counters.",
  },
  {
    id: "faq-2",
    question: "How does the architecture prevent memory leaks in React 19?",
    answer:
      "All GSAP animations and ScrollTrigger instances are scoped inside the useGSAP hook with a container ref. When a component unmounts or dependencies change, useGSAP automatically reverts all tweens, timelines, and ScrollTriggers created within its context.",
  },
  {
    id: "faq-3",
    question: "How is prefers-reduced-motion respected across both libraries?",
    answer:
      "Motion components read the useReducedMotion hook (plus an interactive override toggle in this test suite) to bypass spatial translation when reduced motion is active. GSAP animations use gsap.matchMedia() to check (prefers-reduced-motion: no-preference) before binding scrub or parallax transforms.",
  },
];

export default function AnimationTestSuite() {
  const prefersReducedMotionOS = useReducedMotion();
  const [simulateReducedMotion, setSimulateReducedMotion] = useState(false);
  const isReducedMotion = Boolean(prefersReducedMotionOS || simulateReducedMotion);

  // Motion test states
  const [staggerKey, setStaggerKey] = useState(0);
  const [activeNavTab, setActiveNavTab] = useState<"entrance" | "carousel" | "accordion">("entrance");
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [openFaqId, setOpenFaqId] = useState<string | null>("faq-1");
  const [tapCount, setTapCount] = useState(0);

  // GSAP test refs & replay state
  const gsapScopeRef = useRef<HTMLDivElement>(null);
  const counterValueRef = useRef<HTMLSpanElement>(null);
  const [gsapReplayKey, setGsapReplayKey] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 768px)",
          isMobile: "(max-width: 767px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { reduceMotion } = context.conditions as {
            isDesktop: boolean;
            isMobile: boolean;
            reduceMotion: boolean;
          };

          const shouldReduce = reduceMotion || isReducedMotion;

          // 1. Text Reveal Words
          const words = gsap.utils.toArray<HTMLElement>(".gsap-reveal-word");
          if (shouldReduce) {
            gsap.set(words, { yPercent: 0, opacity: 1 });
          } else {
            gsap.fromTo(
              words,
              { yPercent: 110, opacity: 0 },
              {
                yPercent: 0,
                opacity: 1,
                duration: 0.7,
                stagger: 0.06,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: ".gsap-text-trigger",
                  start: "top 85%",
                  toggleActions: "play none none reverse",
                },
              }
            );
          }

          // 2. Image Clip-Path Reveal & Inner Parallax
          const clipContainer = ".gsap-clip-box";
          const parallaxLayer = ".gsap-parallax-layer";

          if (shouldReduce) {
            gsap.set(clipContainer, { clipPath: "inset(0% 0% 0% 0%)" });
            gsap.set(parallaxLayer, { yPercent: 0, scale: 1 });
          } else {
            gsap.fromTo(
              clipContainer,
              { clipPath: "inset(14% 14% 14% 14%)" },
              {
                clipPath: "inset(0% 0% 0% 0%)",
                ease: "power2.out",
                scrollTrigger: {
                  trigger: clipContainer,
                  start: "top 85%",
                  end: "top 35%",
                  scrub: 0.6,
                },
              }
            );

            gsap.fromTo(
              parallaxLayer,
              { yPercent: -10, scale: 1.08 },
              {
                yPercent: 10,
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: clipContainer,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              }
            );
          }

          // 3. Animated Numeric Counter
          const counterObj = { val: 0 };
          if (shouldReduce) {
            if (counterValueRef.current) {
              counterValueRef.current.textContent = "99.8";
            }
          } else {
            gsap.to(counterObj, {
              val: 99.8,
              duration: 1.6,
              ease: "power2.out",
              scrollTrigger: {
                trigger: ".gsap-counter-card",
                start: "top 85%",
                toggleActions: "play none none reverse",
              },
              onUpdate: () => {
                if (counterValueRef.current) {
                  counterValueRef.current.textContent = counterObj.val.toFixed(1);
                }
              },
            });
          }

          // 4. Pinned Timeline Sequence
          const progressFill = ".gsap-pin-progress";
          const pinSteps = gsap.utils.toArray<HTMLElement>(".gsap-pin-step");

          if (shouldReduce) {
            gsap.set(progressFill, { scaleX: 1 });
            gsap.set(pinSteps, { opacity: 1, y: 0 });
          } else {
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: ".gsap-pin-stage",
                start: "top 20%",
                end: "+=420",
                pin: true,
                scrub: 0.5,
              },
            });

            tl.fromTo(
              progressFill,
              { scaleX: 0 },
              { scaleX: 1, ease: "none", duration: 1 },
              0
            );

            tl.fromTo(
              pinSteps,
              { opacity: 0.25, y: 14 },
              {
                opacity: 1,
                y: 0,
                stagger: 0.3,
                 duration: 0.35,
                ease: "power2.out",
              },
              0
            );
          }
        }
      );

      return () => mm.revert();
    },
    { scope: gsapScopeRef, dependencies: [isReducedMotion, gsapReplayKey] }
  );

  const handleNextTestimonial = () => {
    setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  const handlePrevTestimonial = () => {
    setTestimonialIndex(
      (prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length
    );
  };

  const handleReplayAll = () => {
    setStaggerKey((prev) => prev + 1);
    setGsapReplayKey((prev) => prev + 1);
    ScrollTrigger.refresh();
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#141413] selection:bg-[#1B4332] selection:text-white">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 md:px-12 py-4 bg-[#F6F5F0]/90 backdrop-blur-md border-b border-[#141413]/10">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0"
        >
          First Avenue Dentistry
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#575652]">
          <a
            href="#motion-verification"
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
          >
            Motion Suite
          </a>
          <a
            href="#gsap-verification"
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
          >
            GSAP ScrollTrigger
          </a>
          <a
            href="#pin-verification"
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
          >
            Pinned Timeline
          </a>
          <a
            href="#architecture-summary"
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
          >
            Architecture
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleReplayAll}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay Animations</span>
          </button>
        </div>
      </header>

      <main id="top" className="max-w-[1200px] mx-auto px-6 md:px-12 py-12 md:py-20 space-y-24">
        {/* Hero & Diagnostic Toolbar */}
        <section className="space-y-8">
          <motion.div
            key={`hero-${staggerKey}`}
            initial={isReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: MOTION_EASE }}
            className="space-y-5 max-w-3xl"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#575652]">
              <span>Pre-Build Animation Verification</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">motion/react + gsap + @gsap/react</span>
              <span aria-hidden="true">·</span>
              <span>
                {isReducedMotion ? "Reduced Motion Active" : "Standard Motion Active"}
              </span>
            </div>

            <h1
              className="text-4xl md:text-5xl font-bold tracking-tight text-[#141413] leading-[1.1]"
              style={{ textWrap: "balance" }}
            >
              First Avenue Dentistry Animation Architecture &amp; Runtime Verification
            </h1>

            <p className="text-base md:text-lg text-[#575652] leading-relaxed max-w-[68ch]">
              Both animation engines are installed and scoped. Use the interactive tests below
              to confirm component transitions with Motion for React and scroll-driven
              timelines with GSAP ScrollTrigger before proceeding to the full First Avenue Dentistry build.
            </p>
          </motion.div>

          {/* Interactive Accessibility & Verification Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#ECEAE2] rounded-xl border border-[#141413]/10">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#3D3C38]">
              <span className="font-semibold text-[#141413]">Installed Packages:</span>
              <span className="font-mono tabular-nums">motion (motion/react)</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">gsap (ScrollTrigger)</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">@gsap/react (useGSAP)</span>
            </div>

            <button
              type="button"
              onClick={() => setSimulateReducedMotion((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isReducedMotion
                  ? "bg-[#141413] text-white border-[#141413]"
                  : "bg-[#F6F5F0] text-[#141413] border-[#141413]/20 hover:border-[#141413]/50"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>
                {simulateReducedMotion
                  ? "Disable Reduced-Motion Simulation"
                  : "Simulate prefers-reduced-motion"}
              </span>
            </button>
          </div>
        </section>

        {/* SECTION 1: MOTION FOR REACT SUITE */}
        <section id="motion-verification" className="space-y-8 pt-4 border-t border-[#141413]/10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#575652]">
                01. Declarative UI &amp; State Transitions
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#141413]">
                Motion for React Verification
              </h2>
            </div>

            {/* Interactive Navigation Menu Transition Switcher */}
            <div
              role="tablist"
              aria-label="Motion test modes"
              className="inline-flex items-center gap-1 p-1 bg-[#ECEAE2] rounded-lg self-start"
            >
              {(
                [
                  { id: "entrance", label: "Stagger & Micro-Interactions" },
                  { id: "carousel", label: "Testimonials Carousel" },
                  { id: "accordion", label: "FAQ Accordion" },
                ] as const
              ).map((tab) => {
                const isActive = activeNavTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => setActiveNavTab(tab.id)}
                    className={`relative px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive ? "text-[#141413]" : "text-[#575652] hover:text-[#141413]"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="motion-nav-pill"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 34,
                        }}
                        className="absolute inset-0 bg-[#F6F5F0] rounded-md shadow-xs"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Page / Tab Transition Container */}
          <AnimatePresence mode="wait">
            {activeNavTab === "entrance" && (
              <motion.div
                key={`tab-entrance-${staggerKey}`}
                initial={isReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: MOTION_EASE }}
                className="space-y-6"
              >
                <motion.div
                  variants={isReducedMotion ? undefined : staggerContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  {/* Card 1: Entrance & Stagger */}
                  <motion.div
                    variants={isReducedMotion ? undefined : staggerCardVariants}
                    whileHover={isReducedMotion ? undefined : { y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="p-6 bg-white rounded-xl border border-[#141413]/10 flex flex-col justify-between space-y-6"
                  >
                    <div className="space-y-2">
                      <div className="text-xs text-[#575652]">
                        Entrance &amp; Staggered Reveal
                      </div>
                      <h3 className="text-lg font-semibold text-[#141413]">
                        Orchestrated Card Sequence
                      </h3>
                      <p className="text-sm text-[#575652] leading-relaxed">
                        Uses parent-child variants with an80ms stagger interval and custom
                        cubic-bezier settling curve.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-[#141413]/10 flex items-center justify-between text-xs text-[#575652]">
                      <span>Curve: [0.16, 1, 0.3, 1]</span>
                      <button
                        type="button"
                        onClick={() => setStaggerKey((k) => k + 1)}
                        className="font-semibold text-[#1B4332] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Re-trigger Stagger
                      </button>
                    </div>
                  </motion.div>

                  {/* Card 2: Hover & Tap Tactile Feedback */}
                  <motion.div
                    variants={isReducedMotion ? undefined : staggerCardVariants}
                    className="p-6 bg-white rounded-xl border border-[#141413]/10 flex flex-col justify-between space-y-6"
                  >
                    <div className="space-y-2">
                      <div className="text-xs text-[#575652]">
                        Hover &amp; Tap Interactions
                      </div>
                      <h3 className="text-lg font-semibold text-[#141413]">
                        Spring Gesture Response
                      </h3>
                      <p className="text-sm text-[#575652] leading-relaxed">
                        Tests compositor-only scale and elevation transforms on pointer hover
                        and touch press.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#141413]/10 flex items-center justify-between gap-4">
                      <motion.button
                        type="button"
                        whileHover={isReducedMotion ? undefined : { scale: 1.03 }}
                        whileTap={isReducedMotion ? undefined : { scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setTapCount((c) => c + 1)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Test Tap Gesture
                      </motion.button>
                      <span className="text-xs font-mono tabular-nums text-[#575652]">
                        Triggers: {tapCount}
                      </span>
                    </div>
                  </motion.div>

                  {/* Card 3: Staggered Word Entrance */}
                  <motion.div
                    variants={isReducedMotion ? undefined : staggerCardVariants}
                    className="p-6 bg-white rounded-xl border border-[#141413]/10 flex flex-col justify-between space-y-6"
                  >
                    <div className="space-y-3">
                      <div className="text-xs text-[#575652]">
                        Staggered Text Tokens
                      </div>
                      <h3 className="text-lg font-semibold text-[#141413]">
                        Word-by-Word Motion
                      </h3>
                      <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-sm text-[#141413] font-medium pt-1">
                        {[
                          "Precision",
                          "choreography",
                          "built",
                          "for",
                          "First Avenue Dentistry",
                          "interactive",
                          "experiences.",
                        ].map((word, idx) => (
                          <motion.span
                            key={`${word}-${idx}-${staggerKey}`}
                            initial={
                              isReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.35,
                              delay: idx * 0.05,
                              ease: MOTION_EASE,
                            }}
                            className="inline-block"
                          >
                            {word}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 border-t border-[#141413]/10 text-xs text-[#575652] flex items-center justify-between">
                      <span>Transform + Opacity only</span>
                      <span className="font-mono tabular-nums">50ms step</span>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}

            {activeNavTab === "carousel" && (
              <motion.div
                key="tab-carousel"
                initial={isReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: MOTION_EASE }}
                className="p-8 bg-white rounded-xl border border-[#141413]/10"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="max-w-2xl min-h-[140px] flex flex-col justify-between">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={testimonialIndex}
                        initial={
                          isReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20 }
                        }
                        animate={{ opacity: 1, x: 0 }}
                        exit={
                          isReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }
                        }
                        transition={{ duration: 0.3, ease: MOTION_EASE }}
                        className="space-y-4"
                      >
                        <p className="text-lg md:text-xl font-medium text-[#141413] leading-relaxed">
                          &ldquo;{TESTIMONIALS[testimonialIndex].quote}&rdquo;
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#575652]">
                          <span className="font-semibold text-[#141413]">
                            {TESTIMONIALS[testimonialIndex].author}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{TESTIMONIALS[testimonialIndex].role}</span>
                          <span aria-hidden="true">·</span>
                          <span>{TESTIMONIALS[testimonialIndex].company}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-[#1B4332]">
                            {TESTIMONIALS[testimonialIndex].metric}
                          </span>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                    <span className="text-xs font-mono tabular-nums text-[#575652] mr-2">
                      0{testimonialIndex + 1} / 0{TESTIMONIALS.length}
                    </span>
                    <button
                      type="button"
                      onClick={handlePrevTestimonial}
                      aria-label="Previous testimonial"
                      className="p-2.5 rounded-lg border border-[#141413]/15 hover:bg-[#ECEAE2] transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextTestimonial}
                      aria-label="Next testimonial"
                      className="p-2.5 rounded-lg border border-[#141413]/15 hover:bg-[#ECEAE2] transition-colors cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeNavTab === "accordion" && (
              <motion.div
                key="tab-accordion"
                initial={isReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: MOTION_EASE }}
                className="bg-white rounded-xl border border-[#141413]/10 divide-y divide-[#141413]/10"
              >
                {FAQ_ITEMS.map((item) => {
                  const isOpen = openFaqId === item.id;
                  return (
                    <div key={item.id} className="p-6">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaqId(isOpen ? null : item.id)
                        }
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                      >
                        <span className="text-base font-semibold text-[#141413]">
                          {item.question}
                        </span>
                        <motion.span
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-[#575652] shrink-0"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key="content"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: MOTION_EASE }}
                            className="overflow-hidden"
                          >
                            <p className="pt-3 text-sm text-[#575652] leading-relaxed max-w-[70ch]">
                              {item.answer}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* SECTION 2: GSAP + SCROLLTRIGGER SUITE */}
        <div ref={gsapScopeRef} className="space-y-24">
          <section
            id="gsap-verification"
            className="space-y-10 pt-4 border-t border-[#141413]/10"
          >
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#575652]">
                02. Scroll-Linked Timelines &amp; Scrubbing
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#141413]">
                GSAP &amp; ScrollTrigger Verification
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 7 cols: Text Reveal + Counter */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                {/* Masked Scroll Text Reveal */}
                <div className="gsap-text-trigger p-8 bg-white rounded-xl border border-[#141413]/10 space-y-4">
                  <div className="text-xs text-[#575652]">
                    ScrollTrigger Masked Word Reveal
                  </div>
                  <p className="text-2xl md:text-3xl font-semibold tracking-tight text-[#141413] leading-snug flex flex-wrap gap-x-2 gap-y-1">
                    {[
                      "Scroll-driven",
                      "choreography",
                      "synchronizes",
                      "editorial",
                      "typography,",
                      "clip-path",
                      "apertures,",
                      "and",
                      "pinned",
                      "storytelling.",
                    ].map((word, index) => (
                      <span
                        key={index}
                        className="inline-block overflow-hidden py-0.5"
                      >
                        <span className="gsap-reveal-word inline-block will-change-transform">
                          {word}
                        </span>
                      </span>
                    ))}
                  </p>
                </div>

                {/* Animated Counter Card */}
                <div className="gsap-counter-card p-8 bg-white rounded-xl border border-[#141413]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="text-xs text-[#575652]">
                      GSAP Tweened Numeric Counter
                    </div>
                    <h3 className="text-lg font-semibold text-[#141413]">
                      Frame Pacing Consistency
                    </h3>
                    <p className="text-sm text-[#575652]">
                      Interpolated via GSAP object tweening with tabular numerals.
                    </p>
                  </div>

                  <div className="text-4xl md:text-5xl font-bold font-mono tabular-nums text-[#1B4332] shrink-0">
                    <span ref={counterValueRef}>0.0</span>%
                  </div>
                </div>
              </div>

              {/* Right 5 cols: Image Clip-Path & Parallax Visual */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="gsap-clip-box relative flex-1 min-h-[320px] rounded-xl overflow-hidden border border-[#141413]/10 bg-[#1B4332] flex items-end p-8">
                  {/* Architectural SVG Grid Layer for Parallax Verification */}
                  <div
                    aria-hidden="true"
                    className="gsap-parallax-layer absolute inset-0 bg-[radial-gradient(#ffffff22_1px,transparent_1px)] [background-size:20px_20px] will-change-transform"
                  >
                    <svg
                      viewBox="0 0 400 400"
                      className="w-full h-full stroke-white/15 fill-none"
                      strokeWidth="1"
                    >
                      <circle cx="200" cy="200" r="140" />
                      <circle cx="200" cy="200" r="95" />
                      <line x1="0" y1="200" x2="400" y2="200" />
                      <line x1="200" y1="0" x2="200" y2="400" />
                    </svg>
                  </div>

                  <div className="relative z-10 space-y-2 text-white">
                    <div className="text-xs text-white/75">
                      Clip-Path Reveal + Inner Parallax
                    </div>
                    <h3 className="text-xl font-semibold">
                      Scrubbed Viewport Aperture
                    </h3>
                    <p className="text-xs text-white/80 leading-relaxed">
                      Scroll up and down to observe the inset clip-path opening in sync
                      with inner counter-translation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: PINNED SCROLLING TIMELINE */}
          <section
            id="pin-verification"
            className="space-y-8 pt-4 border-t border-[#141413]/10"
          >
            <div className="gsap-pin-stage p-8 md:p-10 bg-[#141413] text-[#F6F5F0] rounded-2xl space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-[#A5A39D]">
                    03. Pinned ScrollTrigger Sequence
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Pinned Timeline &amp; Scrubbed Progress
                  </h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#A5A39D]">
                  pin: true · scrub: 0.5 · end: &quot;+=420&quot;
                </span>
              </div>

              {/* Scrubbed Progress Bar */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="gsap-pin-progress h-full w-full bg-[#52B788] origin-left scale-x-0 will-change-transform" />
              </div>

              {/* 3 Sequential Pinned Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    step: "01. Context Pinning",
                    title: "Viewport Lock",
                    desc: "ScrollTrigger pins the stage smoothly while scroll distance drives timeline progress.",
                  },
                  {
                    step: "02. Staggered Timeline",
                    title: "Sequential Scrubbing",
                    desc: "Cards reveal proportionally to scroll velocity and reverse cleanly when scrolling upward.",
                  },
                  {
                    step: "03. Lifecycle Cleanup",
                    title: "Zero Leak Guarantee",
                    desc: "useGSAP and gsap.matchMedia() revert pin spacers and listeners on component unmount.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="gsap-pin-step p-6 rounded-xl bg-white/5 border border-white/10 space-y-2 will-change-transform"
                  >
                    <div className="text-xs font-mono tabular-nums text-[#52B788]">
                      {item.step}
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#A5A39D] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* SECTION 4: ARCHITECTURE RESPONSIBILITY MATRIX */}
        <section
          id="architecture-summary"
          className="space-y-6 pt-4 border-t border-[#141413]/10"
        >
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#575652]">
              04. Configured Architecture Specification
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#141413]">
              Animation Responsibility Matrix
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-xl border border-[#141413]/10 space-y-4">
              <div className="flex items-center justify-between border-b border-[#141413]/10 pb-3">
                <h3 className="text-base font-semibold text-[#141413]">
                  Motion for React
                </h3>
                <code className="text-xs font-mono text-[#1B4332]">
                  import &#123; motion &#125; from &quot;motion/react&quot;
                </code>
              </div>
              <ul className="space-y-2 text-sm text-[#575652]">
                <li>01. Component entrance, fade-in, and slide-up animations</li>
                <li>02. Staggered text and card container variants</li>
                <li>03. Tactile hover and tap gesture interactions</li>
                <li>04. Navigation menu layout transitions</li>
                <li>05. Testimonials carousel directional transitions</li>
                <li>06. FAQ accordion height and opacity animations</li>
                <li>07. View and page transition wrappers</li>
              </ul>
            </div>

            <div className="p-6 bg-white rounded-xl border border-[#141413]/10 space-y-4">
              <div className="flex items-center justify-between border-b border-[#141413]/10 pb-3">
                <h3 className="text-base font-semibold text-[#141413]">
                  GSAP + ScrollTrigger
                </h3>
                <code className="text-xs font-mono text-[#1B4332]">
                  gsap + ScrollTrigger + useGSAP
                </code>
              </div>
              <ul className="space-y-2 text-sm text-[#575652]">
                <li>01. Advanced scroll-triggered timelines</li>
                <li>02. Parallax layer translation effects</li>
                <li>03. Pinned scrolling storytelling sections</li>
                <li>04. Masked word and line text reveal animations</li>
                <li>05. Inset clip-path image reveal effects</li>
                <li>06. Multi-step scrubbed animation timelines</li>
                <li>07. Scroll-activated numeric counters</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#141413]/10 py-8 px-6 md:px-12 mt-16">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#575652]">
          <span>First Avenue Dentistry Animation Setup Verification</span>
          <span>Ready for full website implementation upon your confirmation</span>
        </div>
      </footer>
    </div>
  );
}
