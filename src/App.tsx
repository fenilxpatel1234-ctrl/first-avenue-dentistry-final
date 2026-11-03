import { useState, useEffect } from "react";
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
import { DentalConciergeAI } from "./components/DentalConciergeAI";
import { Sparkles } from "lucide-react";

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>("home");
  const [activeServiceId, setActiveServiceId] = useState<string>("teeth-whitening");
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [selectedModalService, setSelectedModalService] = useState<ServiceItem | null>(null);
  const [prefilledService, setPrefilledService] = useState<string>("");
  const [showTestSuite, setShowTestSuite] = useState(false);

  // Sync state with URL path and hash for browser navigation
  useEffect(() => {
    const parseLocation = () => {
      const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
      const hash = window.location.hash.replace(/^#\/?/, "");

      // Check pathname or hash for admin routes
      if (pathname === "/admin/login" || hash === "admin/login" || hash === "/admin/login") {
        setCurrentPage("admin-login");
        return;
      }
      if (pathname === "/admin" || hash === "admin" || hash === "/admin") {
        setCurrentPage("admin");
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
    };

    parseLocation();
    window.addEventListener("hashchange", parseLocation);
    window.addEventListener("popstate", parseLocation);
    return () => {
      window.removeEventListener("hashchange", parseLocation);
      window.removeEventListener("popstate", parseLocation);
    };
  }, []);

  const handleNavigate = (page: string, serviceId?: string) => {
    if (page === "admin") {
      try {
        window.history.pushState({}, "", "/admin");
      } catch {
        window.location.hash = "/admin";
      }
      setCurrentPage("admin");
      window.scrollTo({ top: 0 });
      return;
    }

    if (page === "admin-login") {
      try {
        window.history.pushState({}, "", "/admin/login");
      } catch {
        window.location.hash = "/admin/login";
      }
      setCurrentPage("admin-login");
      window.scrollTo({ top: 0 });
      return;
    }

    if (page === "service-detail" && serviceId) {
      setActiveServiceId(serviceId);
      window.location.hash = `/service/${serviceId}`;
    } else if (page === "home") {
      try {
        window.history.pushState({}, "", "/");
      } catch {}
      window.location.hash = "/";
    } else {
      window.location.hash = `/${page}`;
    }

    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Refresh GSAP ScrollTrigger calculations on page change
    setTimeout(() => {
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

  // If in Admin Login Route
  if (currentPage === "admin-login") {
    return (
      <AdminAuthProvider>
        <AdminLoginPage
          onNavigateToAdmin={() => handleNavigate("admin")}
          onNavigateToPublic={() => handleNavigate("home")}
        />
      </AdminAuthProvider>
    );
  }

  // If in Protected Admin Portal Route
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
        {/* Public Navigation Bar (NO admin links exposed) */}
        <Navbar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onBookClick={(svc) => handleOpenBooking(svc)}
          onOpenAI={() => setIsConciergeOpen(true)}
        />

        {/* Main Multi-Page Content Area with AnimatePresence */}
        <main className="flex-1 w-full">
          <AnimatePresence mode="wait">
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
