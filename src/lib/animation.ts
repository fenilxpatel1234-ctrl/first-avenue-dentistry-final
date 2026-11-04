import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useGSAP } from "@gsap/react";

// Register GSAP plugins once at module initialization to prevent duplicate registrations
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP);

// Configure ScrollTrigger defaults for mobile stability and performance
ScrollTrigger.config({
  ignoreMobileResize: true,
  autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize",
});

export const MOTION_EASE = [0.16, 1, 0.3, 1] as const;

export const pageTransitionVariants = {
  initial: { opacity: 0, y: 28 },
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
    y: -16,
    transition: {
      duration: 0.22,
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

/**
 * Smoothly scrolls the window to the top with a polished ease-out deceleration.
 * Returns a promise that resolves when the scroll reaches the top.
 */
export function smoothScrollToTop(options?: {
  duration?: number;
  onComplete?: () => void;
}): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      options?.onComplete?.();
      resolve();
      return;
    }

    const currentY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const finalize = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      options?.onComplete?.();
      resolve();
    };

    // If already at or very close to top, complete immediately
    if (currentY <= 25) {
      finalize();
      return;
    }

    // Dynamic duration based on distance (range: ~0.28s to 0.45s)
    const durationSeconds =
      options?.duration ??
      Math.min(0.45, Math.max(0.28, currentY * 0.00014 + 0.22));

    try {
      gsap.killTweensOf(window);
      gsap.to(window, {
        scrollTo: { y: 0, autoKill: false },
        duration: durationSeconds,
        ease: "power3.out",
        onComplete: finalize,
        onInterrupt: finalize,
      });
    } catch {
      // Fallback in case GSAP fails
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      setTimeout(finalize, durationSeconds * 1000);
    }
  });
}

export { gsap, ScrollTrigger, ScrollToPlugin, useGSAP };


