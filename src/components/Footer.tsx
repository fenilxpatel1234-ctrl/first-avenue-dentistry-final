import {
  Phone,
  Mail,
  MapPin,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Download,
} from "lucide-react";
import {
  PATIENT_FORMS,
  triggerPatientFormDownload,
} from "../data/patientFormsData";

interface FooterProps {
  onBookClick?: () => void;
  onNavigate?: (page: string, serviceId?: string) => void;
}

export default function Footer({
  onBookClick,
  onNavigate,
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  const handleFooterNavigate = (page: string, serviceId?: string) => {
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
    onNavigate?.(page, serviceId);
  };

  const navLinks = [
    { label: "Home", page: "home" },
    { label: "Services", page: "services" },
    { label: "Emergency", page: "emergency" },
    { label: "About Us", page: "about" },
    { label: "Contact Us", page: "contact" },
    { label: "Blog", page: "faq" },
  ];

  const clinicalServices = [
    { name: "Crowns & Bridges", id: "crowns-bridges" },
    { name: "Wisdom Teeth Extraction", id: "wisdom-teeth-extraction" },
    { name: "Oral Surgery", id: "oral-surgery" },
    { name: "Teeth Cleaning", id: "teeth-cleaning" },
    { name: "Root Canals", id: "root-canals" },
    { name: "Orthodontics", id: "orthodontics" },
    { name: "Sedation Sleep Dentistry", id: "sedation-sleep-dentistry" },
    { name: "Children's Dentistry", id: "childrens-dentistry" },
    { name: "Veneers", id: "veneers" },
    { name: "Teeth Whitening", id: "teeth-whitening" },
    { name: "Implant", id: "implant" },
    { name: "Oral Cancer Screening", id: "oral-cancer-screening" },
  ];

  return (
    <footer className="relative w-full bg-[#060C16] text-white pt-16 sm:pt-24 pb-12 sm:pb-14 px-4 sm:px-6 lg:px-12 border-t border-white/10 overflow-hidden">
      <div className="max-w-[1360px] mx-auto space-y-12 sm:space-y-16">
        {/* Top Callout Card */}
        <div className="p-6 sm:p-10 lg:p-12 rounded-[24px] sm:rounded-[28px] bg-gradient-to-r from-[#002156] to-[#0452FF] text-white flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-black/20 blur-xl pointer-events-none" />

          <div className="space-y-3 text-center lg:text-left max-w-xl z-10">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-white/15 backdrop-blur-md text-white border border-white/20">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Join Our Family of Smiles – New Patients Welcome!</span>
            </span>

            <h3 className="text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
              Schedule Your Visit Today – Call or Book Online!
            </h3>

            <p className="text-xs sm:text-sm text-white/80 leading-relaxed break-words">
              Takes 30 seconds — we&apos;ll confirm by phone. Or Email - firstavenuedentistry@gmail.com
            </p>
          </div>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 z-10 shrink-0">
            <a
              href="tel:5192076890"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-[#060C16] text-xs font-semibold hover:bg-white/90 transition-all shadow-md"
            >
              <Phone className="w-3.5 h-3.5 text-[#1E5AFF]" />
              <span>519 207 6890</span>
            </a>

            <button
              type="button"
              onClick={onBookClick}
              className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#060C16] hover:bg-black text-white text-xs font-semibold border border-white/20 hover:border-white/40 transition-all shadow-md cursor-pointer"
            >
              <span>Request An Appointment Today</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#4E8FFF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Multi-Column Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pt-2 sm:pt-6">
          {/* Column 1: Brand & Location (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <button
              type="button"
              onClick={() => handleFooterNavigate("home")}
              className="group inline-block cursor-pointer text-left focus:outline-none"
              aria-label="First Avenue Dentistry - Home"
            >
              <img
                src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
                alt="First Avenue Dentistry"
                className="h-8 sm:h-10 md:h-11 w-auto max-w-[200px] sm:max-w-[260px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </button>

            <p className="text-xs text-white/70 leading-relaxed max-w-sm">
              First Avenue Dentistry / First Avenue Family Dentistry — Your health and comfort is our top priority. We offer quality dental services and guidance which will set you on the path for a lifetime of exceptional dental and oral health.
            </p>

            <div className="space-y-2.5 text-xs text-white/80 pt-2">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#4E8FFF] shrink-0 mt-0.5" />
                <span>308 Wellington street, St. Thomas, ON N5R 2S9</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#4E8FFF] shrink-0" />
                <a
                  href="tel:5192076890"
                  className="hover:text-white transition-colors"
                >
                  519 207 6890
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#4E8FFF] shrink-0" />
                <a
                  href="mailto:firstavenuedentistry@gmail.com"
                  className="hover:text-white transition-colors break-all"
                >
                  firstavenuedentistry@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links & Patient Forms (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-wider font-bold text-white">
                Main Navigation
              </h4>
              <ul className="space-y-2.5 text-xs text-white/70">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={() => handleFooterNavigate(link.page)}
                      className="hover:text-[#4E8FFF] transition-colors inline-block text-left cursor-pointer"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={onBookClick}
                    className="hover:text-[#4E8FFF] transition-colors inline-block text-left cursor-pointer"
                  >
                    Book Online
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <h4 className="text-xs uppercase tracking-wider font-bold text-white">
                Download Patient Forms
              </h4>
              <ul className="space-y-2 text-xs text-white/75">
                {PATIENT_FORMS.map((form) => (
                  <li key={form.id}>
                    <a
                      href={form.fileUrl}
                      download={form.downloadFileName}
                      onClick={(e) => triggerPatientFormDownload(form, e)}
                      className="inline-flex items-center gap-1.5 hover:text-[#4E8FFF] transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#4E8FFF] shrink-0" />
                      <span>{form.shortTitle}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Column 3: Services (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-bold text-white">
              Services
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-xs text-white/70">
              {clinicalServices.map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => handleFooterNavigate("service-detail", service.id)}
                    className="flex items-center gap-2 hover:text-white transition-colors text-left cursor-pointer group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E5AFF] group-hover:scale-125 transition-transform shrink-0" />
                    <span>{service.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Hours & Emergency (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-bold text-white">
              Hours
            </h4>

            <div className="space-y-2 text-xs text-white/75">
              <div className="flex justify-between py-1 border-b border-white/10">
                <span>Mon. to Fri</span>
                <span className="text-white font-medium">9am to 6pm</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span>Saturdays</span>
                <span className="text-white font-medium">9 am to 5 pm</span>
              </div>
              <div className="py-1 text-[#A5C8FF] font-medium">
                Open 6 days a week – Saturday included
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Legal */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50 text-center sm:text-left">
          <p>
            © {currentYear} First Avenue Dentistry / First Avenue Family Dentistry. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6">
            <a
              href="https://www.google.com/maps/search/?api=1&query=First+Avenue+Dentistry+308+Wellington+Street+St+Thomas+ON"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              308 Wellington street, St. Thomas, ON N5R 2S9
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
