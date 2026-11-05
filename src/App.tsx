import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ServicesPage from "./pages/ServicesPage";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import WhyChooseUsPage from "./pages/WhyChooseUsPage";
import DoctorsPage from "./pages/DoctorsPage";
import FAQPage from "./pages/FAQPage";
import ContactPage from "./pages/ContactPage";
import EmergencyPage from "./pages/EmergencyPage";
import ServiceDetailModal, { ServiceItem } from "./components/ServiceDetailModal";
import BookingModal from "./components/BookingModal";
import AnimationTestSuite from "./components/AnimationTestSuite";
import { ScrollTrigger } from "./lib/animation";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import DoctorDashboardPage from "./pages/admin/DoctorDashboardPage";
import {
  DeveloperPortalPage,
  MaintenanceView,
  InaugurationCountdownView,
  SiteControlConfig,
  DEFAULT_SITE_CONTROL,
  getStoredDeveloperBypass,
  hasStoredDeveloperSession,
} from "./pages/developer/DeveloperPortalPage";
import { subscribeToRealtimeClinicEvents } from "./lib/firestoreService";
import { useDeviceLayoutEngine } from "./lib/deviceLayoutEngine";
import { Terminal } from "lucide-react";

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>("home");
  const [activeServiceId, setActiveServiceId] = useState<string>("teeth-whitening");
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [selectedModalService, setSelectedModalService] = useState<ServiceItem | null>(null);
  const [prefilledService, setPrefilledService] = useState<string>("");
  const [showTestSuite, setShowTestSuite] = useState(false);
  const [siteControl, setSiteControl] = useState<SiteControlConfig>(DEFAULT_SITE_CONTROL);

  // Automatically calibrate and align layout across all devices, pages, and portals
  useDeviceLayoutEngine(`${currentPage}:${activeServiceId}:${siteControl.mode}`);

  const forceScrollToTop = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const rootEl = document.getElementById("root");
    if (rootEl) {
      rootEl.scrollTop = 0;
    }
  };

  const fetchSiteControl = useCallback(async () => {
    try {
      const res = await fetch("/api/site-control");
      if (res.ok) {
        const data = await res.json();
        if (data && data.mode) {
          setSiteControl(data);
        }
      }
    } catch {
      // Fallback to current state if offline
    }
  }, []);

  // Fetch initial site operational mode & listen to real-time SSE broadcasts
  useEffect(() => {
    fetchSiteControl();
    const unsubscribe = subscribeToRealtimeClinicEvents((event) => {
      if (event.type === "site_control_updated" && event.siteControl) {
        setSiteControl(event.siteControl);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [fetchSiteControl]);

  // Sync state with URL path and hash for browser navigation
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const parseLocation = () => {
      const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
      const hash = window.location.hash.replace(/^#\/?/, "");

      // Check pathname or hash for hidden Developer Portal route
      if (
        pathname === "/developer" ||
        pathname === "/dev" ||
        hash === "developer" ||
        hash === "/developer" ||
        hash === "dev" ||
        hash === "/dev"
      ) {
        setCurrentPage("developer");
        forceScrollToTop();
        return;
      }

      // Check pathname or hash for doctor / admin routes
      if (pathname === "/doctor/login" || hash === "doctor/login" || hash === "/doctor/login") {
        setCurrentPage("doctor-login");
        forceScrollToTop();
        return;
      }
      if (pathname === "/doctor" || hash === "doctor" || hash === "/doctor") {
        setCurrentPage("doctor");
        forceScrollToTop();
        return;
      }
      if (pathname === "/admin/login" || hash === "admin/login" || hash === "/admin/login") {
        setCurrentPage("admin-login");
        forceScrollToTop();
        return;
      }
      if (pathname === "/admin" || hash === "admin" || hash === "/admin") {
        setCurrentPage("admin");
        forceScrollToTop();
        return;
      }

      // Public site routing
      if (!hash || hash === "hero" || hash === "home") {
        setCurrentPage("home");
      } else if (hash.startsWith("service/") || hash.startsWith("services/")) {
        const parts = hash.split("/");
        if (parts[1]) {
          setActiveServiceId(parts[1]);
          setCurrentPage("service-detail");
        } else {
          setCurrentPage("services");
        }
      } else if (
        ["about", "services", "why-us", "doctors", "faq", "contact", "emergency"].includes(hash)
      ) {
        setCurrentPage(hash);
      }
      forceScrollToTop();
    };

    parseLocation();
    window.addEventListener("hashchange", parseLocation);
    window.addEventListener("popstate", parseLocation);
    return () => {
      window.removeEventListener("hashchange", parseLocation);
      window.removeEventListener("popstate", parseLocation);
    };
  }, []);

  // Hidden keyboard shortcut (Ctrl + Shift + D or Alt + Shift + D) to open Developer Portal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        try {
          window.history.pushState({}, "", "/developer");
        } catch {
          window.location.hash = "/developer";
        }
        setCurrentPage("developer");
        forceScrollToTop();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Scroll to top whenever active page or active service changes
  useEffect(() => {
    forceScrollToTop();
    const rafId = window.requestAnimationFrame(() => {
      forceScrollToTop();
    });
    const timer1 = window.setTimeout(() => {
      forceScrollToTop();
      ScrollTrigger.refresh();
    }, 60);
    const timer2 = window.setTimeout(() => {
      forceScrollToTop();
      ScrollTrigger.refresh();
    }, 300);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
  }, [currentPage, activeServiceId]);

  const handleNavigate = (page: string, serviceId?: string) => {
    forceScrollToTop();

    if (page === "developer") {
      try {
        window.history.pushState({}, "", "/developer");
      } catch {
        window.location.hash = "/developer";
      }
      setCurrentPage("developer");
      return;
    }

    if (page === "doctor") {
      try {
        window.history.pushState({}, "", "/doctor");
      } catch {
        window.location.hash = "/doctor";
      }
      setCurrentPage("doctor");
      return;
    }

    if (page === "doctor-login") {
      try {
        window.history.pushState({}, "", "/doctor/login");
      } catch {
        window.location.hash = "/doctor/login";
      }
      setCurrentPage("doctor-login");
      return;
    }

    if (page === "admin") {
      try {
        window.history.pushState({}, "", "/admin");
      } catch {
        window.location.hash = "/admin";
      }
      setCurrentPage("admin");
      return;
    }

    if (page === "admin-login") {
      try {
        window.history.pushState({}, "", "/admin/login");
      } catch {
        window.location.hash = "/admin/login";
      }
      setCurrentPage("admin-login");
      return;
    }

    if (page === "service-detail" && serviceId) {
      setActiveServiceId(serviceId);
      try {
        window.history.pushState({}, "", `/#/service/${serviceId}`);
      } catch {
        window.location.hash = `/service/${serviceId}`;
      }
    } else if (page === "home") {
      try {
        window.history.pushState({}, "", "/");
      } catch {
        window.location.hash = "/";
      }
    } else {
      try {
        window.history.pushState({}, "", `/#/${page}`);
      } catch {
        window.location.hash = `/${page}`;
      }
    }

    setCurrentPage(page);
    forceScrollToTop();
    window.requestAnimationFrame(() => forceScrollToTop());

    // Refresh GSAP ScrollTrigger calculations on page change
    setTimeout(() => {
      forceScrollToTop();
      ScrollTrigger.refresh();
    }, 150);
  };

  const handleOpenBooking = (serviceTitle?: string) => {
    if (serviceTitle) {
      setPrefilledService(serviceTitle);
    }
    setIsBookingOpen(true);
  };

  const handleSelectService = (service: ServiceItem) => {
    handleNavigate("service-detail", service.id);
  };

  // 1. Dedicated Developer Systems & Site Operations Portal (Completely Separate Portal #3)
  if (currentPage === "developer") {
    return (
      <DeveloperPortalPage
        siteControl={siteControl}
        onSiteControlUpdated={(next) => setSiteControl(next)}
        onNavigateToPublic={() => handleNavigate("home")}
      />
    );
  }

  // 2. If in Admin or Doctor Login Route
  if (currentPage === "admin-login" || currentPage === "doctor-login") {
    return (
      <AdminAuthProvider>
        <AdminLoginPage
          initialMode={currentPage === "doctor-login" ? "doctor" : "admin"}
          onNavigateToAdmin={() => handleNavigate("admin")}
          onNavigateToDoctor={() => handleNavigate("doctor")}
          onNavigateToPublic={() => handleNavigate("home")}
        />
      </AdminAuthProvider>
    );
  }

  // 3. If in Protected Doctor Portal Route
  if (currentPage === "doctor") {
    return (
      <AdminAuthProvider>
        <DoctorDashboardPage
          onNavigateToLogin={() => handleNavigate("doctor-login")}
          onNavigateToPublic={() => handleNavigate("home")}
        />
      </AdminAuthProvider>
    );
  }

  // 4. If in Protected Admin Portal Route
  if (currentPage === "admin") {
    return (
      <AdminAuthProvider>
        <AdminDashboardPage
          onNavigateToLogin={() => handleNavigate("admin-login")}
          onNavigateToPublic={() => handleNavigate("home")}
        />
      </AdminAuthProvider>
    );
  }

  // 5. Public Visitor Interception for Maintenance Mode or Inauguration Countdown Mode
  const isDeveloperBypassing =
    hasStoredDeveloperSession() && getStoredDeveloperBypass();

  if (!isDeveloperBypassing && siteControl.mode === "maintenance") {
    return (
      <MaintenanceView
        config={siteControl}
        onOpenDeveloperPortal={() => handleNavigate("developer")}
      />
    );
  }

  if (!isDeveloperBypassing && siteControl.mode === "inauguration") {
    return (
      <InaugurationCountdownView
        config={siteControl}
        onRevealComplete={() => {
          setSiteControl((prev) => ({ ...prev, mode: "live" }));
          fetchSiteControl();
        }}
        onOpenDeveloperPortal={() => handleNavigate("developer")}
      />
    );
  }

  // Test suite view
  if (showTestSuite) {
    return (
      <div className="relative">
        <div className="fixed bottom-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setShowTestSuite(false)}
            className="px-4 py-2 text-xs font-semibold rounded-full bg-[#060C16] text-white shadow-xl hover:bg-[#1E5AFF] transition-colors cursor-pointer"
          >
            ← Return to First Avenue Dentistry
          </button>
        </div>
        <AnimationTestSuite />
      </div>
    );
  }

  // Public First Avenue Dentistry Website
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-[#F4F7FF] text-[#060C16] flex flex-col font-sans selection:bg-[#1E5AFF] selection:text-white">
        {/* Developer Bypass Floating Indicator (Only visible if developer enabled bypass during Maintenance/Inauguration) */}
        {isDeveloperBypassing && siteControl.mode !== "live" && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#080B10] border border-[#F59E0B]/60 text-white shadow-2xl font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            <span>
              DEV BYPASS ACTIVE • Public sees:{" "}
              <strong className="uppercase text-[#FBBF24]">{siteControl.mode}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleNavigate("developer")}
              className="px-2.5 py-1 rounded bg-[#10B981] text-[#04130D] font-bold uppercase text-[10px] hover:bg-[#059669] transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Terminal className="w-3 h-3" />
              Console
            </button>
          </div>
        )}

        {/* Public Navigation Bar (NO admin links exposed) */}
        <Navbar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onBookClick={(svc) => handleOpenBooking(svc)}
          onOpenAI={() => setIsConciergeOpen(true)}
        />

        {/* Main Multi-Page Content Area with AnimatePresence */}
        <main className="flex-1 w-full">
          <AnimatePresence
            mode="wait"
            onExitComplete={() => {
              forceScrollToTop();
              ScrollTrigger.refresh();
            }}
          >
            {currentPage === "home" && (
              <HomePage
                key="home-page"
                onBookClick={handleOpenBooking}
                onSelectService={handleSelectService}
                onNavigate={handleNavigate}
                onOpenAI={() => setIsConciergeOpen(true)}
              />
            )}

            {currentPage === "about" && (
              <AboutPage
                key="about-page"
                onBookClick={handleOpenBooking}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === "emergency" && (
              <EmergencyPage
                key="emergency-page"
                onBookClick={handleOpenBooking}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === "services" && (
              <ServicesPage
                key="services-page"
                onSelectService={handleSelectService}
                onBookClick={handleOpenBooking}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === "service-detail" && (
              <ServiceDetailPage
                key={`service-detail-${activeServiceId}`}
                serviceId={activeServiceId}
                onBookClick={handleOpenBooking}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === "why-us" && (
              <WhyChooseUsPage
                key="why-us-page"
                onBookClick={handleOpenBooking}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === "doctors" && (
              <DoctorsPage
                key="doctors-page"
                onBookClick={handleOpenBooking}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === "faq" && (
              <FAQPage
                key="faq-page"
                onBookClick={handleOpenBooking}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === "contact" && (
              <ContactPage
                key="contact-page"
                onBookClick={handleOpenBooking}
                onNavigate={handleNavigate}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Public Footer (NO admin links exposed) */}
        <Footer
          onBookClick={() => handleOpenBooking()}
          onNavigate={handleNavigate}
        />

        {/* Interactive Service Detail Modal */}
        <ServiceDetailModal
          service={selectedModalService}
          onClose={() => setSelectedModalService(null)}
          onBookService={(name) => handleOpenBooking(name)}
        />

        {/* Interactive Booking Modal wired to Firestore */}
        <BookingModal
          isOpen={isBookingOpen}
          initialService={prefilledService}
          onClose={() => {
            setIsBookingOpen(false);
            setPrefilledService("");
          }}
        />
      </div>
    </AdminAuthProvider>
  );
}
