import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register GSAP plugins once at module initialization to prevent duplicate registrations
gsap.registerPlugin(ScrollTrigger, useGSAP);

// Configure ScrollTrigger defaults for mobile stability and performance
ScrollTrigger.config({
  ignoreMobileResize: true,
  autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize",
});

export const MOTION_EASE = [0.16, 1, 0.3, 1] as const;

export const pageTransitionVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: MOTION_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: {
      duration: 0.25,
      ease: MOTION_EASE,
    },
  },
};

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (customDelay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      delay: customDelay,
      ease: MOTION_EASE,
    },
  }),
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const staggerCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: MOTION_EASE,
    },
  },
};

export { gsap, ScrollTrigger, useGSAP };

