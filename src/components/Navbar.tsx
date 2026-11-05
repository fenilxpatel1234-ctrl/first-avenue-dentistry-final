import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Menu,
  X,
  Phone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ALL_SERVICES } from "../data/servicesData";

interface NavbarProps {
  currentPage?: string;
  onNavigate?: (page: string, serviceId?: string) => void;
  onBookClick?: (serviceTitle?: string) => void;
  onOpenAI?: () => void;
}

export default function Navbar({
  currentPage = "home",
  onNavigate,
  onBookClick,
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsServicesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavClick = (page: string, serviceId?: string) => {
    setIsMobileMenuOpen(false);
    setIsServicesOpen(false);

    if (onNavigate) {
      onNavigate(page, serviceId);
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    setIsServicesOpen(false);
    setIsMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate("service-detail", serviceId);
    }
  };

  return (
    <>
      {/* Sticky Solid Navigation Bar (100% Opaque across all devices) */}
      <header
        data-public-navbar="true"
        className={`fixed top-0 left-0 right-0 z-50 bg-[#060C16] border-b border-white/10 transition-all duration-200 ease-out ${
          isScrolled
            ? "py-3 shadow-xl shadow-black/35"
            : "py-3.5 sm:py-4 shadow-md shadow-black/20"
        }`}
      >
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          {/* Brand Logo: First Avenue Dentistry */}
          <button
            type="button"
            onClick={() => handleNavClick("home")}
            className="flex items-center shrink-0 cursor-pointer text-left focus:outline-none"
            aria-label="First Avenue Dentistry - Home"
          >
            <img
              src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
              alt="First Avenue Dentistry"
              className="h-7 sm:h-9 md:h-10 w-auto max-w-[148px] sm:max-w-[195px] xl:max-w-[235px] object-contain transition-transform duration-200 hover:scale-[1.02]"
            />
          </button>

          {/* Main Navigation: Home, Services, Book Online, Emergency, About Us, Contact Us, Blog */}
          <nav className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1.5 text-[13px] xl:text-sm font-medium whitespace-nowrap min-w-0">
            <button
              type="button"
              onClick={() => handleNavClick("home")}
              className={`px-3 xl:px-4 py-2 rounded-xl font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                currentPage === "home"
                  ? "bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/30"
                  : "text-white/85 hover:text-white hover:bg-white/10"
              }`}
            >
              Home
            </button>

            {/* Services Dropdown (12 items) */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setIsServicesOpen(true)}
              onMouseLeave={() => setIsServicesOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsServicesOpen(!isServicesOpen)}
                className={`px-2.5 xl:px-3.5 py-2 rounded-xl font-semibold inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  isServicesOpen ||
                  currentPage === "services" ||
                  currentPage === "service-detail"
                    ? "bg-white/15 text-white"
                    : "text-white/85 hover:text-white hover:bg-white/10"
                }`}
                aria-expanded={isServicesOpen}
                aria-haspopup="true"
              >
                <span>Services</span>
                {isServicesOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-white/90" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-white/70" />
                )}
              </button>

              <AnimatePresence>
                {isServicesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute top-full left-0 w-64 sm:w-72 pt-2 z-50"
                  >
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2.5 px-1.5 overflow-hidden">
                      <div className="max-h-[440px] overflow-y-auto space-y-0.5 custom-scrollbar">
                        {ALL_SERVICES.map((srv) => (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => handleServiceSelect(srv.id)}
                            className="w-full text-left px-3.5 py-2 rounded-xl text-[13px] font-medium text-[#1E293B] hover:text-[#1E5AFF] hover:bg-[#F4F7FF] transition-colors flex items-center justify-between cursor-pointer group"
                          >
                            <span className="truncate">{srv.title}</span>
                            <ArrowRight className="w-3 h-3 text-[#1E5AFF] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </button>
                        ))}
                      </div>

                      <div className="pt-2 mt-1 border-t border-slate-100 px-1">
                        <button
                          type="button"
                          onClick={() => handleNavClick("services")}
                          className="w-full text-center px-3 py-1.5 rounded-lg text-xs font-bold text-[#1E5AFF] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                        >
                          All Dental Services →
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => (onBookClick ? onBookClick() : handleNavClick("services"))}
              className="px-2.5 xl:px-3.5 py-2 rounded-xl font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              Book Online
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("emergency")}
              className={`px-2.5 xl:px-3.5 py-2 rounded-xl font-semibold transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                currentPage === "emergency"
                  ? "bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/30"
                  : "text-white/85 hover:text-white hover:bg-white/10"
              }`}
            >
              <span>Emergency</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("about")}
              className={`px-2.5 xl:px-3.5 py-2 rounded-xl font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                currentPage === "about"
                  ? "bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/30"
                  : "text-white/85 hover:text-white hover:bg-white/10"
              }`}
            >
              About Us
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("contact")}
              className={`px-2.5 xl:px-3.5 py-2 rounded-xl font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                currentPage === "contact"
                  ? "bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/30"
                  : "text-white/85 hover:text-white hover:bg-white/10"
              }`}
            >
              Contact Us
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("faq")}
              className={`px-2.5 xl:px-3.5 py-2 rounded-xl font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                currentPage === "faq"
                  ? "bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/30"
                  : "text-white/85 hover:text-white hover:bg-white/10"
              }`}
            >
              Blog
            </button>
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="tel:5192076890"
              className="hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold text-white/85 hover:text-white transition-colors whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5 text-[#4E8FFF]" />
              <span>519 207 6890</span>
            </a>

            <button
              type="button"
              onClick={() => onBookClick && onBookClick()}
              className="group inline-flex items-center gap-2 pl-1.5 pr-3.5 sm:pr-5 py-1.5 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs sm:text-sm font-semibold tracking-wide transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#1E5AFF]/30 cursor-pointer whitespace-nowrap"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-[#1E5AFF] flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5 shadow-xs shrink-0">
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="hidden sm:inline">Book Online</span>
              <span className="sm:hidden">Book</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Toggle navigation"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="lg:hidden bg-[#060C16] border-b border-white/10 px-4 sm:px-6 py-5 text-white space-y-4 shadow-2xl max-h-[calc(100dvh-64px)] overflow-y-auto overscroll-contain"
            >
              <div className="flex flex-col space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleNavClick("home")}
                  className={`text-left text-sm sm:text-base font-semibold py-2.5 px-3 rounded-xl transition-colors cursor-pointer ${
                    currentPage === "home"
                      ? "bg-[#1E5AFF] text-white"
                      : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  Home
                </button>

                <div className="space-y-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => setIsMobileServicesOpen(!isMobileServicesOpen)}
                    className={`w-full text-left text-sm sm:text-base font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                      isMobileServicesOpen ||
                      currentPage === "services" ||
                      currentPage === "service-detail"
                        ? "bg-white/10 text-white"
                        : "text-white/85 hover:bg-white/10"
                    }`}
                    aria-expanded={isMobileServicesOpen}
                  >
                    <span className="flex items-center gap-2">
                      <span>Services</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#1E5AFF]/20 text-[#4E8FFF] font-bold">
                        {ALL_SERVICES.length}
                      </span>
                    </span>
                    <span className="p-1 rounded-lg bg-white/5 text-white/70">
                      {isMobileServicesOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#4E8FFF]" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isMobileServicesOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-white/5 rounded-2xl p-2 border border-white/5 space-y-1"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {ALL_SERVICES.map((srv) => (
                            <button
                              key={srv.id}
                              type="button"
                              onClick={() => handleServiceSelect(srv.id)}
                              className="text-left text-xs py-2 px-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span className="truncate">{srv.title}</span>
                              <ArrowRight className="w-3 h-3 text-[#4E8FFF] opacity-60 shrink-0" />
                            </button>
                          ))}
                        </div>

                        {/* View All button below all services */}
                        <div className="pt-2 mt-1 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => handleNavClick("services")}
                            className="w-full text-center py-2.5 px-3 rounded-xl text-xs font-bold bg-[#1E5AFF]/20 hover:bg-[#1E5AFF]/30 text-[#4E8FFF] hover:text-white border border-[#1E5AFF]/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>View All Services</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onBookClick && onBookClick();
                  }}
                  className="text-left text-sm sm:text-base font-semibold py-2.5 px-3 rounded-xl text-white/85 hover:bg-white/10 cursor-pointer"
                >
                  Book Online
                </button>

                <button
                  type="button"
                  onClick={() => handleNavClick("emergency")}
                  className={`text-left text-sm sm:text-base font-semibold py-2.5 px-3 rounded-xl transition-colors flex items-center justify-between cursor-pointer ${
                    currentPage === "emergency"
                      ? "bg-[#1E5AFF] text-white"
                      : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  <span>Emergency</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavClick("about")}
                  className={`text-left text-sm sm:text-base font-semibold py-2.5 px-3 rounded-xl transition-colors cursor-pointer ${
                    currentPage === "about"
                      ? "bg-[#1E5AFF] text-white"
                      : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  About Us
                </button>

                <button
                  type="button"
                  onClick={() => handleNavClick("contact")}
                  className={`text-left text-sm sm:text-base font-semibold py-2.5 px-3 rounded-xl transition-colors cursor-pointer ${
                    currentPage === "contact"
                      ? "bg-[#1E5AFF] text-white"
                      : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  Contact Us
                </button>

                <button
                  type="button"
                  onClick={() => handleNavClick("faq")}
                  className={`text-left text-sm sm:text-base font-semibold py-2.5 px-3 rounded-xl transition-colors cursor-pointer ${
                    currentPage === "faq"
                      ? "bg-[#1E5AFF] text-white"
                      : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  Blog
                </button>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-2.5 text-xs text-white/70">
                <a
                  href="tel:5192076890"
                  className="flex items-center gap-2 text-white font-semibold hover:text-[#4E8FFF]"
                >
                  <Phone className="w-4 h-4 text-[#4E8FFF]" />
                  <span>519 207 6890</span>
                </a>
                <p>308 Wellington street, St. Thomas, ON N5R 2S9</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
