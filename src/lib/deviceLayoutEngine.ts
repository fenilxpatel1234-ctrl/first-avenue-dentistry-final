import { useEffect, useState } from "react";

export interface DeviceLayoutProfile {
  deviceCategory:
    | "xs-phone"
    | "sm-phone"
    | "tablet-portrait"
    | "tablet-landscape"
    | "laptop"
    | "desktop"
    | "ultrawide";
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
  isTouch: boolean;
  navbarSolidBg: string;
  navbarHeightPx: number;
  containerPaddingPx: number;
  rootFontScale: number;
  cardGapPx: number;
  touchTargetMinPx: number;
  enforceOverflowLock: boolean;
  alignGridCards: boolean;
}

function getLocalFallbackProfile(): DeviceLayoutProfile {
  const width = typeof window !== "undefined" ? window.innerWidth : 1440;
  const height = typeof window !== "undefined" ? window.innerHeight : 900;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const isTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0 || width < 1024);

  let deviceCategory: DeviceLayoutProfile["deviceCategory"] = "desktop";
  let navbarHeightPx = 74;
  let containerPaddingPx = 32;
  let rootFontScale = 1;
  let cardGapPx = 24;

  if (width < 375) {
    deviceCategory = "xs-phone";
    navbarHeightPx = 62;
    containerPaddingPx = 14;
    rootFontScale = 0.95;
    cardGapPx = 14;
  } else if (width < 640) {
    deviceCategory = "sm-phone";
    navbarHeightPx = 64;
    containerPaddingPx = 16;
    rootFontScale = 0.98;
    cardGapPx = 16;
  } else if (width < 900) {
    deviceCategory = "tablet-portrait";
    navbarHeightPx = 68;
    containerPaddingPx = 24;
    rootFontScale = 1;
    cardGapPx = 20;
  } else if (width < 1180) {
    deviceCategory = "tablet-landscape";
    navbarHeightPx = 70;
    containerPaddingPx = 28;
    rootFontScale = 1;
    cardGapPx = 20;
  } else if (width < 1440) {
    deviceCategory = "laptop";
    navbarHeightPx = 72;
    containerPaddingPx = 32;
    rootFontScale = 1;
    cardGapPx = 24;
  } else if (width <= 1920) {
    deviceCategory = "desktop";
    navbarHeightPx = 76;
    containerPaddingPx = 40;
    rootFontScale = 1;
    cardGapPx = 28;
  } else {
    deviceCategory = "ultrawide";
    navbarHeightPx = 78;
    containerPaddingPx = 48;
    rootFontScale = 1.02;
    cardGapPx = 32;
  }

  return {
    deviceCategory,
    viewportWidth: width,
    viewportHeight: height,
    dpr,
    isTouch,
    navbarSolidBg: "#060C16",
    navbarHeightPx,
    containerPaddingPx,
    rootFontScale,
    cardGapPx,
    touchTargetMinPx: isTouch ? 44 : 38,
    enforceOverflowLock: true,
    alignGridCards: true,
  };
}

/**
 * Applies CSS variables and data attributes to <html> and <body>
 * and normalizes any overflowing or misaligned flex/grid/table elements.
 */
export function applyDeviceLayoutCalibration(profile: DeviceLayoutProfile): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.setAttribute("data-device-category", profile.deviceCategory);
  root.setAttribute("data-touch-device", profile.isTouch ? "true" : "false");

  root.style.setProperty("--device-vw", `${profile.viewportWidth}px`);
  root.style.setProperty("--device-vh", `${profile.viewportHeight}px`);
  root.style.setProperty("--navbar-solid-bg", profile.navbarSolidBg || "#060C16");
  root.style.setProperty("--navbar-height", `${profile.navbarHeightPx}px`);
  root.style.setProperty("--container-pad", `${profile.containerPaddingPx}px`);
  root.style.setProperty("--card-gap", `${profile.cardGapPx}px`);
  root.style.setProperty("--touch-target-min", `${profile.touchTargetMinPx}px`);

  // Measure actual public navbar height if present and keep safe offset synchronized
  const publicNavbar = document.querySelector("header[data-public-navbar='true']") as HTMLElement | null;
  if (publicNavbar) {
    publicNavbar.style.backgroundColor = "#060C16";
    publicNavbar.style.opacity = "1";
    const measuredHeight = publicNavbar.offsetHeight;
    if (measuredHeight > 0) {
      root.style.setProperty("--navbar-height", `${measuredHeight}px`);
    }
  }

  // Normalize tables on mobile/tablet so wide portal tables scroll smoothly without breaking layout
  const tables = document.querySelectorAll("table");
  tables.forEach((table) => {
    const parent = table.parentElement;
    if (parent && window.innerWidth < 1024) {
      const computed = window.getComputedStyle(parent);
      if (computed.overflowX === "visible") {
        parent.style.overflowX = "auto";
        parent.style.maxWidth = "100%";
      }
    }
  });

  // Guard against accidental horizontal overflow in sections/cards on mobile & tablet viewports
  if (profile.enforceOverflowLock && window.innerWidth < 1280) {
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const containers = document.querySelectorAll(
      "main, section, footer, header, [role='dialog'] > div"
    );
    containers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.scrollWidth > vw + 2) {
        htmlEl.style.maxWidth = "100%";
        htmlEl.style.boxSizing = "border-box";
      }
    });
  }
}

export function useDeviceLayoutEngine(activeRouteKey?: string): DeviceLayoutProfile {
  const [profile, setProfile] = useState<DeviceLayoutProfile>(() => getLocalFallbackProfile());

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const calibrateWithServer = async () => {
      const local = getLocalFallbackProfile();
      if (!cancelled) {
        setProfile(local);
        applyDeviceLayoutCalibration(local);
      }

      try {
        const res = await fetch("/api/device-layout-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
            touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
          }),
        });
        if (res.ok && !cancelled) {
          const serverProfile: DeviceLayoutProfile = await res.json();
          setProfile(serverProfile);
          applyDeviceLayoutCalibration(serverProfile);
        }
      } catch {
        // Fallback already applied synchronously
      }
    };

    const handleResize = () => {
      const immediate = getLocalFallbackProfile();
      applyDeviceLayoutCalibration(immediate);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        calibrateWithServer();
      }, 150);
    };

    calibrateWithServer();

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize, { passive: true });

    // Observe DOM mutations so dynamically opened modals, portals, and tabs are aligned automatically
    const observer = new MutationObserver(() => {
      applyDeviceLayoutCalibration(getLocalFallbackProfile());
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      observer.disconnect();
    };
  }, [activeRouteKey]);

  return profile;
}
