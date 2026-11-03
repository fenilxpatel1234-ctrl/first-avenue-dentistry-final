import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Minus,
  HelpCircle,
  Search,
  BookOpen,
} from "lucide-react";
import { BLOG_POSTS } from "../data/servicesData";
import { MOTION_EASE, pageTransitionVariants } from "../lib/animation";

interface FAQPageProps {
  onBookClick: (serviceTitle?: string) => void;
  onNavigate: (page: string) => void;
}

const FAQ_ALL_ITEMS = [
  {
    id: "blog-1",
    category: "Blog",
    question: "Achieve Your Dream Smile with a Cosmetic Smile Transformation in St. Thomas",
    answer:
      "Our cosmetic dentistry services will help enhance the appearance of your teeth and boost your self-confidence. From teeth whitening and porcelain veneers to dental implants, we can do it all. Whether it’s a routine checkup or a smile makeover, we’re here to make your visit easy and stress-free.",
  },
  {
    id: "blog-2",
    category: "Children's Dentistry",
    question: "Essential Oral Health Tips for Kids: Your Guide to Kids Dental Health Advice",
    answer:
      "START HEALTHY DENTAL HABITS EARLY — We offer a wide variety of children’s dentistry services. Let us help your child develop healthy lifelong dental habits. Children are special. A little extra time and attention make a child’s visit to the dentist pleasant and comfortable. Our preventative philosophy includes careful examinations, x-rays (when necessary), use of pit and fissure sealants, regular cleanings with fluoride, and age-appropriate instructions that guide your child toward developing healthy oral habits.",
  },
  {
    id: "blog-3",
    category: "Orthodontics",
    question: "Understanding the Average Cost of Invisalign in Canada",
    answer:
      "Orthodontic treatment can be done with clear aligner which is hardy noticeable. Treatment plans include full records, braces, and retainer. Treatment plans include the mold, model, X-rays, and photos. Free consultations are available and interest-free payment plans can be arranged. Contact us for a free consultation.",
  },
  {
    id: "blog-4",
    category: "Children's Dentistry",
    question: "Top Tips for Children's Dental Care Tips",
    answer:
      "We recommend you bring your children in for their first appointment when their first teeth begin to erupt, usually just before their first birthday. We can spot potential problems before they develop and will help you to understand the development of your child’s healthy smile. Your child’s twenty primary teeth will find their place around the age of three, making this age essential for creating lifelong oral care habits.",
  },
  {
    id: "blog-5",
    category: "Blog",
    question: "Transform Your Look with Cosmetic Smile Enhancements",
    answer:
      "A whiter and brighter smile is on the top of everyone’s list. Our offices can consult you on all the teeth whitening treatments available, and determine which option is best for you. Whether your teeth are discolored or yellow, stained or faded – we can find the best whitening option that fits your lifestyle and needs. Professional teeth whitening can boost your confidence in just one session. When your teeth get 2-6 shades brighter after the first visit, you won’t be able to stop smiling!",
  },
  {
    id: "blog-6",
    category: "General Dentistry",
    question: "The Importance of Regular Dental Checkups",
    answer:
      "Regular dental check up is necessary to identify teeth disease and treat in early stage. Our dental services are tailored to meet the unique needs and requirements of our patients of all ages. From routine checkups to cleanings and preventative treatments, we can handle it all.",
  },
  {
    id: "blog-7",
    category: "Orthodontics",
    question: "Discover Invisalign Treatment Options in St. Thomas",
    answer:
      "Have you been searching for well-trained and highly qualified dentists to get exceptional orthodontic treatments in St. Thomas, ON? Visit First Avenue Family Dentistry today for dental care excellence! We are the top choice for orthodontic treatments in St. Thomas, ON, and take pride in our incomparable expertise and personalized dental care.",
  },
  {
    id: "blog-8",
    category: "Orthodontics",
    question: "Breaking Down Invisalign Costs in Canada: Clear Aligner Pricing Insights",
    answer:
      "Orthodontic treatment helps ensure the proper function of teeth and create healthy smiles. A good bite makes it easier for you to bite, chew and speak. Free consultations are available and interest-free payment plans can be arranged. Contact us for a free consultation.",
  },
  {
    id: "blog-9",
    category: "General Dentistry",
    question: "Welcome to Your Trusted Family Dentist in St. Thomas",
    answer:
      "With a helpful and friendly team, First Avenue Family Dental offers the great community of St. Thomas, Ontario dental care that is attentive and also pleasant. Are you looking for a St. Thomas dentist? Call 519 207 6890 or visit our dental clinic for personalized dental care for patients of all ages. We look forward to treating you and your family and seeing your smiles in our First Avenue Family Dental soon!",
  },
  {
    id: "blog-10",
    category: "Children's Dentistry",
    question: "Essential Oral Health Advice for Children: A Parent’s Guide",
    answer:
      "At First Avenue Dentistry, we believe in nurturing healthy smiles for the whole family. Our family dental care services are designed to meet the needs of patients of all ages, including Child's First Appointment, Orthodontics for Teens, Sealants and Fluoride, and Teeth Cleaning for Kids.",
  },
  {
    id: "blog-11",
    category: "Blog",
    question: "Achieve Your Dream Smile in St. Thomas with Customized Smile Services",
    answer:
      "First Avenue Family Dental team provides family dental care, cosmetic dentistry, dental implants, dentures, sedation, teeth whitening, orthodontics, and so much more. Therefore, with a full range of services, our patients can enjoy quality attention in just one convenient location.",
  },
  {
    id: "blog-12",
    category: "General Dentistry",
    question: "Schedule Your Next Dental Checkup with Ease: Routine Oral Health Checkups Made Simple",
    answer:
      "Schedule Your Visit Today – Call or Book Online! Looking for a dental team that makes your comfort and care a priority? Our friendly professionals provide comprehensive general and cosmetic dentistry in a modern, welcoming environment. Open 6 days a week – Saturday included.",
  },
];

const CATEGORIES = [
  "All",
  "Blog",
  "General Dentistry",
  "Orthodontics",
  "Children's Dentistry",
];

export default function FAQPage({ onBookClick }: FAQPageProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>("blog-1");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredItems = FAQ_ALL_ITEMS.filter((item) => {
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch =
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <motion.div
      ref={containerRef}
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full bg-[#F4F7FF] text-[#060C16]"
    >
      {/* Hero Header */}
      <section className="relative w-full min-h-[45vh] sm:min-h-[55vh] flex items-center bg-[#060C16] text-white pt-28 pb-16 sm:pt-40 sm:pb-24 px-4 sm:px-6 lg:px-12 rounded-b-[28px] sm:rounded-b-[48px]">
        <div className="max-w-[1360px] mx-auto w-full space-y-5 sm:space-y-6">

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] max-w-3xl">
            Blog &amp; Dental Health Guides
          </h1>

          <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl">
            Your health and comfort is our top priority. We offer quality dental services and guidance which will set you on the path for a lifetime of exceptional dental and oral health.
          </p>
        </div>
      </section>

      {/* Interactive Search & Filter Controls */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 lg:px-12 bg-white border-b border-[#E9EDF0]">
        <div className="max-w-[1100px] mx-auto space-y-8 sm:space-y-10">
          {/* Search Input Bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="w-5 h-5 text-[#8E8E93] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blog posts and dental topics..."
              className="w-full pl-12 pr-4 py-3.5 rounded-full border border-[#E9EDF0] bg-[#F8FAFC] text-sm text-[#060C16] placeholder:text-[#8E8E93] focus:outline-none focus:border-[#1E5AFF] focus:ring-2 focus:ring-[#1E5AFF]/20 transition-all shadow-xs"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#1E5AFF] text-white shadow-xs"
                    : "bg-[#F8FAFC] text-[#646464] hover:bg-[#EAF2FF] hover:text-[#060C16] border border-[#E9EDF0]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Accordion List */}
          <div className="space-y-4 pt-2 sm:pt-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 text-sm text-[#646464]">
                No posts found matching &quot;{searchQuery}&quot;. Call 519 207 6890 for assistance.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`transition-all duration-300 rounded-[20px] border ${
                      isOpen
                        ? "bg-[#F8FAFC] border-[#1E5AFF]/40 shadow-sm"
                        : "bg-white border-[#E9EDF0] hover:border-[#1E5AFF]/30"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                      className="w-full text-left py-4 sm:py-5 px-5 sm:px-8 flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="text-[11px] font-semibold text-[#1E5AFF] uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen className="w-3 h-3 shrink-0" />
                          <span>{item.category}</span>
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-[#060C16] tracking-tight leading-snug">
                          {item.question}
                        </h3>
                      </div>

                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                          isOpen
                            ? "bg-[#1E5AFF] text-white rotate-180"
                            : "bg-[#EAF2FF] text-[#1E5AFF]"
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
                          <div className="px-5 sm:px-8 pb-6 pt-3 text-sm sm:text-base text-[#646464] leading-relaxed border-t border-[#E9EDF0]">
                            <p>{item.answer}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Bottom Help Desk */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-12 bg-[#F4F7FF]">
        <div className="max-w-[1100px] mx-auto p-6 sm:p-10 rounded-[24px] sm:rounded-[28px] bg-[#EAF2FF] border border-[#1E5AFF]/20 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-[#1E5AFF] flex items-center justify-center shadow-xs shrink-0">
              <HelpCircle className="w-6 h-6 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-[#060C16]">
                Schedule Your Visit Today – Call or Book Online!
              </h3>
              <p className="text-xs sm:text-sm text-[#646464] break-words">
                308 Wellington street, St. Thomas, ON N5R 2S9 · Or Email - firstavenuedentistry@gmail.com
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 w-full md:w-auto shrink-0">
            <a
              href="tel:5192076890"
              className="w-full sm:w-auto text-center px-5 py-2.5 rounded-full bg-white hover:bg-[#F4F7FF] text-[#060C16] text-xs font-semibold border border-[#C9C9D0] transition-all shadow-xs"
            >
              519 207 6890
            </a>

            <button
              type="button"
              onClick={() => onBookClick()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Request An Appointment Today
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
