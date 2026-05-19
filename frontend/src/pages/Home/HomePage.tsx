import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Headset,
  LayoutDashboard,
  MapPin,
  Minus,
  MessageSquareText,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Tickets,
  Wallet,
} from "lucide-react";
import { eventService } from "../../services/eventService";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";
import Blog from "../../components/common/Blog";
import Footer from "../../components/common/Footer";
import { EventSummary } from "../../types/api";
import { partnerLogos } from "../../constants/partners";

const fallbackHeroEvents = [
  {
    id: "hero-1",
    slug: "ravolution-music-festival-2026",
    title: "Ravolution Music Festival 2026",
    startDatetime: "2026-06-15T19:30:00",
    venueName: "The Global City",
    city: "TP. Hồ Chí Minh",
    shortDescription:
      "Đêm nhạc điện tử quy mô lớn với line-up quốc tế và trải nghiệm sân khấu nhập vai.",
    bannerUrl:
      "https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2023/11/16/247724.jpg",
    minPrice: 950000,
  },
  {
    id: "hero-2",
    slug: "ha-anh-tuan-chan-troi-ruc-ro",
    title: "Hà Anh Tuấn - Chân Trời Rực Rỡ",
    startDatetime: "2026-07-21T20:00:00",
    venueName: "Nhà hát Hòa Bình",
    city: "TP. Hồ Chí Minh",
    shortDescription:
      "Đêm diễn live concert với trải nghiệm chỗ ngồi đẹp, thanh toán nhanh và nhận vé tức thì.",
    bannerUrl:
      "https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2022/12/23/450B75.jpg",
    minPrice: 1200000,
  },
  {
    id: "hero-3",
    slug: "tomorrowland-experience",
    title: "Tomorrowland Experience",
    startDatetime: "2026-08-09T18:00:00",
    venueName: "Saigon Exhibition Hall",
    city: "TP. Hồ Chí Minh",
    shortDescription:
      "Không gian festival kết hợp visual art, activation zone và trải nghiệm check-in theo thời gian thực.",
    bannerUrl: "https://i.ytimg.com/vi/BG26iYVppy8/maxresdefault.jpg",
    minPrice: 1500000,
  },
];

const featureCards = [
  {
    icon: ShoppingCart,
    title: "Easy Ticket Purchase",
    description:
      "Tìm kiếm, so sánh và chọn chỗ ngồi phù hợp chỉ trong vài thao tác ngắn.",
  },
  {
    icon: Tickets,
    title: "Instant Ticket Delivery",
    description:
      "Nhận vé điện tử ngay sau khi thanh toán thành công, sẵn sàng check-in bằng QR.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    description:
      "Nhiều phương thức thanh toán an toàn với luồng xác nhận rõ ràng, minh bạch.",
  },
  {
    icon: LayoutDashboard,
    title: "Complete Dashboard",
    description:
      "Theo dõi đơn hàng, vé đã mua và trạng thái thanh toán trong cùng một tài khoản.",
  },
  {
    icon: MessageSquareText,
    title: "Trackable Reviews",
    description:
      "Thông tin sự kiện, địa điểm và lịch tổ chức được trình bày rõ, dễ kiểm tra trước khi mua.",
  },
  {
    icon: Headset,
    title: "24/7 Support",
    description:
      "Luồng hỗ trợ được đặt đúng chỗ để người dùng và organizer xử lý vấn đề nhanh hơn.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Go Event Page",
    description:
      "Truy cập trang sự kiện để xem thông tin, lịch diễn, địa điểm và mức giá vé.",
    image:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1200&auto=format&fit=crop",
  },
  {
    step: "02",
    title: "Choose Your Event",
    description:
      "Chọn loại vé, số lượng hoặc chỗ ngồi phù hợp với nhu cầu của bạn.",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
  },
  {
    step: "03",
    title: "Complete Payment",
    description:
      "Thanh toán nhanh và nhận vé điện tử ngay để sẵn sàng check-in tại sự kiện.",
    image: "https://images.pexels.com/photos/7191166/pexels-photo-7191166.jpeg",
  },
];

const pastEventGallery = [
  "https://thumbs.dreamstime.com/b/sydney-australia-february-taylor-swift-promotional-banner-eras-tour-building-facade-striking-monochrome-shot-captures-308589240.jpg",
  "https://static.vecteezy.com/system/resources/previews/008/041/545/non_2x/fireworks-festival-poster-free-vector.jpg",
  "https://assets.isu.pub/document-structure/240726102139-d62f2aa1efadcb2998ae62f494fbf40e/v1/29338e0e7df2a000594afe0a03f17550.jpeg",
  "https://hoianmemoriesland.com/public/media//cv1.jpg",
  "https://i.scdn.co/image/ab67616d00001e02bca435448e93887771358103",
  "https://cdn2.tuoitre.vn/471584752817336320/data/teen360/pictures/2020/12/16/1608055329_poster-s-n-t-ng.jpg",
  "https://cdn2.tuoitre.vn/thumb_w/480/471584752817336320/2025/7/18/ha-anh-tuan-1752807552879793430941.jpg",
  "https://cdn3.ivivu.com/2023/12/tri%E1%BB%83n-l%C3%A3m-Van-Gogh-ivivu.jpg",
];

const faqItems = [
  {
    question: "How to buy event tickets?",
    answer:
      "Tìm sự kiện phù hợp, mở trang chi tiết, chọn loại vé hoặc chỗ ngồi rồi hoàn tất thanh toán để nhận vé điện tử.",
  },
  {
    question: "Can I get refund after purchase?",
    answer:
      "Chính sách hoàn tiền phụ thuộc từng sự kiện. Trang chi tiết sẽ hiển thị rõ thông tin để người mua kiểm tra trước khi đặt vé.",
  },
  {
    question: "Why should I host events here?",
    answer:
      "Organizer có thể quản lý event, media, layout, ticket type, seat map và quy trình check-in trong cùng một workspace.",
  },
  {
    question: "How do subscriptions and ticket plans work?",
    answer:
      "Nền tảng tập trung vào mô hình phí giao dịch minh bạch, giúp người dùng và nhà tổ chức dễ theo dõi chi phí thực tế.",
  },
  {
    question: "Can I transfer my ticket to another person?",
    answer:
      "Tùy vào chính sách của từng sự kiện, bạn có thể được phép chuyển nhượng vé trước giờ diễn. Vui lòng kiểm tra điều khoản trên trang chi tiết sự kiện hoặc liên hệ hỗ trợ để được xác nhận.",
  },
];

const homeNavItems = [
  { label: "Home", to: "#home-hero", isHash: true },
  { label: "Events", to: "/search" },
  { label: "About", to: "#home-features", isHash: true },
  { label: "Blog", to: "#home-blog", isHash: true },
  { label: "Pages", to: "#home-faq", isHash: true },
];

const monthShortNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDate(value?: string) {
  if (!value) return "Đang cập nhật";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(event?: Partial<EventSummary>) {
  const minPrice =
    typeof event?.minPrice === "number"
      ? event.minPrice
      : typeof event?.minPrice === "string"
        ? Number(event.minPrice)
        : undefined;

  if (typeof minPrice === "number" && Number.isFinite(minPrice)) {
    return `Từ ${minPrice.toLocaleString("vi-VN")} đ`;
  }
  return "Đang cập nhật";
}

function getEventImage(event?: Partial<EventSummary>) {
  return (
    event?.bannerUrl ||
    event?.thumbnailUrl ||
    event?.images?.find((image) => image.type === "BANNER")?.url ||
    event?.images?.find((image) => image.type === "THUMBNAIL")?.url ||
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1400&auto=format&fit=crop"
  );
}

function getEventLocation(event?: Partial<EventSummary>) {
  const venueName = event?.venue?.name || event?.venueName;
  const cityName = event?.venue?.city || event?.city;

  const parts = [venueName, cityName]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .map((part) => part.trim());

  return Array.from(new Set(parts)).join(", ") || "Đang cập nhật địa điểm";
}

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [featuredEvents, setFeaturedEvents] = useState<EventSummary[]>([]);
  const [otherEvents, setOtherEvents] = useState<EventSummary[]>([]);
  const [activeFaq, setActiveFaq] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollUpcoming = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 324;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [featRes, eventRes] = await Promise.all([
          eventService.getFeaturedEvents(5),
          eventService.getEvents({ size: 8 }),
        ]);

        if (Array.isArray(featRes)) setFeaturedEvents(featRes);
        if (eventRes?.content) setOtherEvents(eventRes.content);
      } catch (error) {
        console.error("Lỗi fetch HomePage API", error);
      }
    };

    void loadData();
  }, []);

  const heroEvents =
    featuredEvents.length > 0 ? featuredEvents.slice(0, 5) : fallbackHeroEvents;
  const primaryHeroEvent = heroEvents[currentSlide] || heroEvents[0];
  const upcomingEvents = otherEvents.length > 0 ? otherEvents : heroEvents;

  useEffect(() => {
    if (heroEvents.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroEvents.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [heroEvents.length]);

  useEffect(() => {
    if (currentSlide >= heroEvents.length) {
      setCurrentSlide(0);
    }
  }, [currentSlide, heroEvents.length]);

  const moveSlide = (direction: number) => {
    if (!heroEvents.length) return;
    setCurrentSlide((prev) => {
      const next = prev + direction;
      if (next < 0) return heroEvents.length - 1;
      if (next >= heroEvents.length) return 0;
      return next;
    });
  };

  return (
    <div className="home-page">
      <div className="home-topbar">
        <AccountCategoryNav items={homeNavItems} />
      </div>

      <main className="container home-main-shell">
        <section className="home-hero" id="home-hero">
          <div className="home-hero-shell">
            <div className="home-hero-copy">
              <h1>
                <span className="hero-heading-line">Easy to Buy &amp;</span>
                <br />
                <span className="hero-heading-line">
                  Sale your{" "}
                  <span className="hero-heading-highlight">Event</span>
                </span>
                <br />
                <span className="hero-heading-line hero-heading-highlight">
                  Ticket
                </span>
              </h1>
              <p className="home-hero-description">
                It is a long established fact that a reader content of a page
                when Ipsum is that it has a more-or-less normal.
              </p>

              <div className="home-hero-actions">
                <Link
                  to="/search"
                  className="btn btn-primary home-hero-primary-cta"
                >
                  Get Started
                </Link>
              </div>
            </div>

            <div className="home-hero-slider">
              <div
                className="hero-event-stage"
                style={{
                  backgroundImage: `url(${getEventImage(primaryHeroEvent)})`,
                }}
              >
                <article className="hero-event-card">
                  <div className="hero-slider-controls">
                    <button
                      type="button"
                      onClick={() => moveSlide(-1)}
                      aria-label="Previous event"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlide(1)}
                      aria-label="Next event"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div className="hero-event-media">
                    <img
                      src={getEventImage(primaryHeroEvent)}
                      alt={primaryHeroEvent?.title || "Event"}
                    />
                  </div>

                  <div className="hero-event-body">
                    <h2>
                      {primaryHeroEvent?.title || "Sự kiện đang cập nhật"}
                    </h2>

                    <div className="hero-event-footer">
                      <div className="hero-event-meta">
                        <span>
                          <Calendar size={15} />
                          {formatDate(primaryHeroEvent?.startDatetime)}
                        </span>
                        <span>
                          <MapPin size={15} />
                          {getEventLocation(primaryHeroEvent)}
                        </span>
                      </div>
                      <Link
                        to={`/event/${primaryHeroEvent?.slug || primaryHeroEvent?.id || ""}`}
                        className="hero-event-cta"
                      >
                        Get Event Ticket
                      </Link>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="home-trust-strip">
          <p className="home-trust-copy">
            More than 100+ businesses owners across the world trust Counter
          </p>

          <div className="partner-grid home-partner-grid">
            {partnerLogos.map((partner) => (
              <div
                className="partner-logo home-partner-logo"
                key={partner.id}
                title={partner.name}
              >
                <img src={partner.image} alt={partner.name} />
              </div>
            ))}
          </div>
        </section>

        <section className="home-section" id="home-features">
          <div className="section-heading section-heading-center">
            <h2 className="home-features-title">
              Our Core{" "}
              <span className="home-features-title-highlight">Features</span>
            </h2>
            <p>
              It is a long established fact that a reader content of a page when
              Ipsum is that it has a more-or- this is simple less normal .
            </p>
          </div>

          <div className="feature-grid">
            {featureCards.map((feature) => {
              const Icon = feature.icon;

              return (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon">
                    <Icon size={22} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="home-section home-upcoming-section"
          style={{
            backgroundImage: `url("https://images.pexels.com/photos/3122799/pexels-photo-3122799.jpeg")`,
          }}
        >
          <div className="section-heading">
            <div>
              <h2 className="home-upcoming-title">
                Upcoming{" "}
                <span className="home-upcoming-title-highlight">Events</span>
              </h2>
              <p>
                {" "}
                It is a long established fact that a reader content of a page
                when Ipsum is that it has a more-or- this is simple less normal
              </p>
            </div>
            <div className="upcoming-header-actions">
              <Link to="/search" className="section-link home-upcoming-cta">
                View all events
              </Link>
            </div>
          </div>

          <div className="upcoming-carousel-wrapper">
            <button
              className="upcoming-nav-btn is-left"
              onClick={() => scrollUpcoming("left")}
              aria-label="Previous"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="upcoming-cards-container" ref={scrollContainerRef}>
              {upcomingEvents.map((event) => {
                const d = new Date(event.startDatetime || "");
                const isValidDate = !Number.isNaN(d.getTime());
                const dayMonth = isValidDate
                  ? `${d.getDate()} ${monthShortNames[d.getMonth()]}`
                  : "";
                const year = isValidDate ? d.getFullYear() : "";

                return (
                  <article className="upcoming-event-card" key={event.id}>
                    <Link
                      to={`/event/${event.slug || event.id}`}
                      className="upcoming-card-image-wrapper"
                    >
                      <img src={getEventImage(event)} alt={event.title} />
                      {isValidDate && (
                        <div className="upcoming-date-badge">
                          <span className="upcoming-date-day">{dayMonth}</span>
                          <span className="upcoming-date-year">{year}</span>
                        </div>
                      )}
                    </Link>
                    <div className="upcoming-card-content">
                      <h3 className="upcoming-card-title">
                        <Link to={`/event/${event.slug || event.id}`}>
                          {event.title}
                        </Link>
                      </h3>
                      <div className="upcoming-card-location">
                        <MapPin size={16} />
                        <span>{getEventLocation(event)}</span>
                      </div>
                      <div className="upcoming-card-bottom">
                        <span className="upcoming-card-price">
                          {formatPrice(event)}
                        </span>
                        <Link
                          to={`/event/${event.slug || event.id}`}
                          className="upcoming-card-buy-btn"
                        >
                          Buy
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <button
              className="upcoming-nav-btn is-right"
              onClick={() => scrollUpcoming("right")}
              aria-label="Next"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </section>

        <section className="home-section" id="how-it-works-section">
          <div className="section-heading section-heading-center">
            <h2 style={{ fontWeight: 600 }}>How it works</h2>
            <p>
              It is a long established fact that a reader content of a page when
              Ipsum is that it has a more-or- this is simple less normal
            </p>
          </div>

          <div className="how-grid">
            {howItWorks.map((item) => (
              <article className="how-card" key={item.step}>
                <div className="how-card-media">
                  <img src={item.image} alt={item.title} />
                  <span>{item.step}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section home-pricing-section">
          <div className="section-heading section-heading-center">
            <h2 className="home-pricing-title">
              Transparent <span style={{ color: "#cc9900" }}>Pricing</span>
            </h2>
            <p>
              It is a long established fact that a reader content of a page when
              Ipsum is that it has a more-or- this is simple less normal
            </p>
          </div>

          <div className="pricing-cards-row">
            {/* Card 1 – Organization Signup */}
            <div className="pricing-glass-card pricing-glass-card-signup">
              <div className="pricing-glass-header">
                <div className="pricing-glass-icon">
                  <Building2 size={40} />
                </div>
                <span className="pricing-big-value">Free</span>
              </div>
              <h3>Organization Signup</h3>
              <p>
                One-time registration fee to create your organizer account and
                start publishing events.
              </p>
              <div className="pricing-signup-benefits">
                <ul className="pricing-check-list">
                  <li>
                    <Check size={16} /> Unlimited event creation
                  </li>
                  <li>
                    <Check size={16} /> Real-time sales dashboard
                  </li>
                  <li>
                    <Check size={16} /> QR check-in system
                  </li>
                  <li>
                    <Check size={16} /> Attendee management
                  </li>
                </ul>
                <div className="pricing-card-footer">
                  <Link to="/register" className="pricing-cta-btn">
                    Get Started
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 2 – Transaction Fee */}
            <div className="pricing-glass-card">
              <div className="pricing-glass-header">
                <div className="pricing-glass-icon">
                  <Wallet size={40} />
                </div>
                <span className="pricing-big-percent">
                  5<small>%</small>
                </span>
              </div>
              <h3>Transaction Fee</h3>
              <p>
                A small fee applied per ticket sold, covering payment processing
                and platform services.
              </p>

              <div className="pricing-progress-group">
                <div className="pricing-progress-item">
                  <span className="pricing-progress-label">
                    Organizer Payout
                  </span>
                  <div className="pricing-progress-bar">
                    <div
                      className="pricing-progress-fill"
                      style={{ width: "80%" }}
                    />
                  </div>
                  <span className="pricing-progress-value">2%</span>
                </div>
                <div className="pricing-progress-item">
                  <span className="pricing-progress-label">
                    Payment Gateway
                  </span>
                  <div className="pricing-progress-bar">
                    <div
                      className="pricing-progress-fill"
                      style={{ width: "60%" }}
                    />
                  </div>
                  <span className="pricing-progress-value">1.8%</span>
                </div>
                <div className="pricing-progress-item">
                  <span className="pricing-progress-label">Platform Fee</span>
                  <div className="pricing-progress-bar">
                    <div
                      className="pricing-progress-fill"
                      style={{ width: "45%" }}
                    />
                  </div>
                  <span className="pricing-progress-value">1.2%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-section home-past-events-section">
          <div className="section-heading section-heading-center">
            <h2
              style={{
                fontSize: "clamp(2.2rem, 3.6vw, 3.4rem)",
                fontWeight: 800,
              }}
            >
              Some of our <span style={{ color: "#CC9900" }}>Past Events</span>
            </h2>
            <p>
              {" "}
              It is a long established fact that a reader content of a page when
              Ipsum is that it has a more-or- this is simple less normal
            </p>
          </div>

          <div className="past-event-gallery">
            {pastEventGallery.map((image, index) => (
              <article className="past-event-thumb" key={`${image}-${index}`}>
                <img src={image} alt={`Past event ${index + 1}`} />
              </article>
            ))}
          </div>
        </section>

        <section className="home-section faq-section" id="home-faq">
          <div className="faq-layout">
            <div className="faq-copy">
              <h2 className="faq-title">
                Some Important <span className="faq-title-highlight">FAQs</span>{" "}
                for Event & Ticket
              </h2>
              <p>
                Where we address some of the most commonly asked questions about
                our Event services.
              </p>

              <div className="faq-visual">
                <img
                  className="faq-illustration-image"
                  src="https://i.ibb.co/Zz1y0hXk/vecteezy-three-cubes-with-q-and-a-on-transparent-background-faq-18735148.png"
                  alt="Customer support illustration"
                />
              </div>
            </div>

            <div className="faq-accordion">
              {faqItems.map((item, index) => {
                const isOpen = activeFaq === index;

                return (
                  <article
                    className={`faq-item ${isOpen ? "is-open" : ""}`}
                    key={item.question}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaq(isOpen ? -1 : index)}
                    >
                      <span>{item.question}</span>
                      <span className="faq-toggle-icon" aria-hidden="true">
                        {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                      </span>
                    </button>
                    <div className="faq-answer">
                      <p>{item.answer}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

          <Blog />
      </main>

        <Footer />
    </div>
  );
}
