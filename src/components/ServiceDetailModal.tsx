import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle2, ArrowRight, Phone, Calendar } from "lucide-react";

export interface ServiceContentSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface ServiceItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  description: string;
  details: string;
  fullParagraphs?: string[];
  contentSections?: ServiceContentSection[];
  image: string;
  highlights: string[];
}

interface ServiceDetailModalProps {
  service: ServiceItem | null;
  onClose: () => void;
  onBookService: (serviceName: string) => void;
}

export default function ServiceDetailModal({
  service,
  onClose,
  onBookService,
}: ServiceDetailModalProps) {
  if (!service) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#060C16]/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#060C16]/10 z-10 my-8"
        >
          {/* Header Image */}
          <div className="relative h-60 sm:h-72 w-full overflow-hidden bg-[#060C16]">
            <img
              src={service.image}
              alt={service.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060C16]/90 via-[#060C16]/40 to-transparent" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title & Category on Image */}
            <div className="absolute bottom-6 left-6 right-6 text-white space-y-1.5">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-[#1E5AFF] text-white">
                {service.category}
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {service.title}
              </h3>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-3">
              {service.subtitle && (
                <h4 className="text-sm font-bold text-[#060C16] uppercase tracking-wider">
                  {service.subtitle}
                </h4>
              )}
              {(service.fullParagraphs && service.fullParagraphs.length > 0
                ? service.fullParagraphs
                : [service.details]
              ).map((p, idx) => (
                <p key={idx} className="text-base text-[#555C68] leading-relaxed">
                  {p}
                </p>
              ))}
            </div>

            {/* Key Benefits */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[#060C16] uppercase tracking-wider">
                What to Expect
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {service.highlights.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F4F7FF] text-xs font-medium text-[#060C16]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[#060C16]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <a
                href="tel:5192076890"
                className="flex items-center gap-2 text-xs font-semibold text-[#555C68] hover:text-[#060C16]"
              >
                <Phone className="w-4 h-4 text-[#1E5AFF]" />
                <span>Call 519 207 6890</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBookService(service.title);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-[#0452FF] to-[#1E5AFF] text-white text-xs font-semibold hover:shadow-lg hover:shadow-[#0452FF]/30 transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>Book Online</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
