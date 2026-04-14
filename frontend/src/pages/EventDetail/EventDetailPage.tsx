import { CSSProperties, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { categoryService } from "../../services/categoryService";
import { eventService } from "../../services/eventService";
import { venueService } from "../../services/venueService";
import Blog from "../../components/common/Blog";
import Footer from "../../components/common/Footer";
import { Category, EventSummary, Venue } from "../../types/api";
import { partnerLogos } from "../../constants/partners";

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoryService
      .getCategories()
      .then((res) => {
        if (res && Array.isArray(res)) setAllCategories(res);
      })
      .catch((err) => console.error("Failed to load categories", err));
  }, []);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    eventService
      .getEventDetails(slug)
      .then((data) => {
        setEvent(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load event details:", err);
        setError("Không thể tải thông tin sự kiện.");
      })
      .finally(() => setIsLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!event?.venue?.id) return;
    venueService
      .getVenues()
      .then((venues) => {
        const selectedVenue = venues.find(
          (v) => v.id === event.venue!.id,
        );
        if (selectedVenue) setVenue(selectedVenue);
      })
      .catch((err) => console.error("Failed to load venue:", err));
  }, [event?.venue?.id]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p>Đang tải thông tin sự kiện</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ textAlign: "center", padding: "100px", color: "red" }}>
        <p>{error || "Không tìm thấy sự kiện"}</p>
        <Link
          to="/"
          style={{ textDecoration: "underline", color: "var(--primary)" }}
        >
          Quay về trang chủ
        </Link>
      </div>
    );
  }

  const startDatetime = event.schedule?.startDatetime || event.startDatetime;
  const endDatetime = event.schedule?.endDatetime || event.endDatetime;
  if (!startDatetime || !endDatetime) {
    return (
      <div style={{ textAlign: "center", padding: "100px", color: "red" }}>
        <p>Sự kiện không có thông tin thời gian hợp lệ</p>
        <Link
          to="/"
          style={{ textDecoration: "underline", color: "var(--primary)" }}
        >
          Quay về trang chủ
        </Link>
      </div>
    );
  }

  const startDate = new Date(startDatetime);
  const endDate = new Date(endDatetime);
  const venueName = event.venue?.name || event.venueName;
  const city = event.venue?.city || event.city;
  const totalCapacity = event.statistics?.totalCapacity ?? event.totalCapacity;
  const ticketsSold = event.statistics?.ticketsSold ?? event.ticketsSold;
  const detailAddressLine = [venueName, city].filter(Boolean).join(" • ");
  const minPrice =
    event.ticketTypes && event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((ticketType) => ticketType.price))
      : event.minPrice;
  const bannerUrl =
    event.images?.find((image) => image.type === "BANNER")?.url ||
    event.bannerUrl ||
    event.images?.[0]?.url;
  const posterUrl =
    event.images?.find((image) => image.type === "POSTER")?.url ||
    event.images?.find((image) => image.type === "THUMBNAIL")?.url ||
    event.thumbnailUrl ||
    event.images?.[0]?.url ||
    event.bannerUrl;
  const fallbackGalleryImages = [
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80",
  ];
  const venueImageUrl =
    venue?.imageUrls?.[0] ||
    "https://images.unsplash.com/photo-1519167758993-b505a9dd0652?auto=format&fit=crop&w=1200&q=80";
  const otherGalleryImages = [
    posterUrl,
    ...(event.images || []).map((image) => image.url),
  ].filter((url): url is string => Boolean(url));
  const uniqueOtherImages = Array.from(new Set(otherGalleryImages));
  const eventGalleryImages = [
    bannerUrl || fallbackGalleryImages[0],
    venueImageUrl,
    ...uniqueOtherImages,
    ...fallbackGalleryImages,
  ]
    .filter((url): url is string => Boolean(url))
    .slice(0, 5);
  const ticketTypes = [...(event.ticketTypes || [])].sort(
    (left, right) => left.price - right.price,
  );
  const hasTotalCapacity = typeof totalCapacity === "number";
  const hasTicketsSold = typeof ticketsSold === "number";
  const eventDescriptionHtml =
    event.description ||
    event.shortDescription ||
    "Đang cập nhật thông tin giới thiệu chi tiết cho sự kiện này.";
  const eventTerms = [
    `Thời gian: ${startDate.toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} lúc ${startDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
    venueName ? `Địa điểm: ${venueName}${city ? `, ${city}` : ""}` : null,
    hasTotalCapacity
      ? `Sức chứa: ${totalCapacity.toLocaleString("vi-VN")} người`
      : null,
    event.tags && event.tags.length > 0
      ? `Chủ đề: ${event.tags.join(", ")}`
      : null,
  ].filter((term): term is string => Boolean(term));
  const organizer = event.organizer;
  const organizerInitials = organizer?.name
    ? organizer.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : "OT";
  const formattedMinPrice =
    typeof minPrice === "number" ? minPrice.toLocaleString("vi-VN") : null;
  const heroMaskId = "event-hero-mask";
  const heroCardStyle = {
    "--event-hero-mask": `url(#${heroMaskId})`,
  } as CSSProperties;

  return (
    <div className="event-detail-page" style={{ paddingBottom: 0 }}>
      <nav className="category-nav">
        <div className="container">
          <ul className="category-list">
            <li className="category-item">
              <Link to="/search" className="category-link">
                Tất cả
              </Link>
            </li>
            {allCategories.length > 0 ? (
              allCategories.map((category) => (
                <li className="category-item" key={category.id}>
                  <Link
                    to={`/search?category=${category.slug || category.id}`}
                    className="category-link"
                  >
                    {category.name}
                  </Link>
                </li>
              ))
            ) : (
              <li className="category-item">
                <span className="category-link">Đang tải</span>
              </li>
            )}
          </ul>
        </div>
      </nav>

      <div
        style={{
          width: "100%",
          height: "400px",
          position: "relative",
          backgroundColor: "#f0f0f0",
        }}
      >
        <img
          src={
            bannerUrl || "https://via.placeholder.com/1200x400?text=No+Banner"
          }
          alt={event.title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.1))",
          }}
        />
      </div>

      <div className="container event-hero-wrap">
        <svg
          aria-hidden="true"
          className="event-hero-mask-defs"
          focusable="false"
          width="0"
          height="0"
        >
          <defs>
            <mask
              id={heroMaskId}
              maskUnits="objectBoundingBox"
              maskContentUnits="objectBoundingBox"
            >
              <rect x="0" y="0" width="1" height="1" fill="white" />
              <ellipse cx="0.466" cy="0" rx="0.022" ry="0.065" fill="black" />
              <ellipse cx="0.466" cy="1" rx="0.022" ry="0.065" fill="black" />
            </mask>
          </defs>
        </svg>

        <article className="event-hero-card" style={heroCardStyle}>
          <section className="event-hero-info">
            {event.categories && event.categories.length > 0 ? (
              <div className="event-hero-tags">
                {event.categories.map((category) => (
                  <span
                    key={category.id || category.slug || category.name}
                    className="event-hero-tag"
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            ) : (
              event.category && (
                <div className="event-hero-tags">
                  <span className="event-hero-tag">{event.category.name}</span>
                </div>
              )
            )}
            <h1 className="event-hero-title">{event.title}</h1>
            <div className="event-hero-meta-list">
              <div className="event-hero-meta-item">
                <Calendar size={20} className="event-hero-meta-icon" />
                <div>
                  <p className="event-hero-meta-primary">
                    {startDate.toLocaleDateString("vi-VN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="event-hero-meta-secondary">
                    {startDate.toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {endDate.toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="event-hero-meta-item">
                <MapPin size={20} className="event-hero-meta-icon" />
                <div>
                  <p className="event-hero-meta-primary">
                    {venueName || "Đang cập nhật địa điểm"}
                  </p>
                  <p className="event-hero-meta-secondary">
                    {detailAddressLine || "Đang cập nhật địa chỉ chi tiết"}
                  </p>
                </div>
              </div>
              {(hasTotalCapacity || hasTicketsSold) && (
                <div className="event-hero-meta-item">
                  <Ticket size={20} className="event-hero-meta-icon" />
                  <div>
                    <p className="event-hero-meta-primary">
                      Số lượng vé:{" "}
                      {hasTotalCapacity
                        ? totalCapacity.toLocaleString("vi-VN")
                        : "Không giới hạn"}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="event-hero-separator" />
            <div className="event-hero-cta-row">
              <div className="event-hero-price-inline">
                <p className="event-hero-price-label">Giá vé chỉ từ</p>
                <p
                  className="event-hero-price-value"
                  style={{ color: "#CC9900" }}
                >
                  {formattedMinPrice ? `${formattedMinPrice} đ` : "Miễn phí"}
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary event-hero-cta-button"
              onClick={() => navigate(`/events/${slug}/book`)}
              style={{ backgroundColor: "#CC9900", borderColor: "#CC9900" }}
            >
              Chọn lịch diễn
            </button>
          </section>

          <div className="event-hero-divider" aria-hidden="true">
            <span className="event-hero-divider-cap top" />
            <span className="event-hero-divider-line" />
            <span className="event-hero-divider-cap bottom" />
          </div>

          <div className="event-hero-poster">
            <img
              src={
                posterUrl ||
                "https://via.placeholder.com/800x1000?text=No+Poster"
              }
              alt={`${event.title} poster`}
              className="event-hero-poster-image"
            />
            <div className="event-hero-poster-overlay" />
          </div>
        </article>

        <section className="event-detail-lower">
          <div className="event-detail-content-grid">
            <article className="event-detail-main-card">
              <div className="event-detail-card-header">
                <h2>Event Details</h2>
              </div>
              <div
                className="event-detail-description"
                dangerouslySetInnerHTML={{ __html: eventDescriptionHtml }}
              />
              <div className="event-detail-card-divider event-detail-card-divider--dashed" />
              <div className="event-detail-terms">
                <div className="event-detail-card-header">
                  <h2>Terms &amp; Conditions</h2>
                </div>
                <ul className="event-detail-terms-list">
                  {eventTerms.map((term) => (
                    <li key={term}>{term}</li>
                  ))}
                </ul>
              </div>
            </article>

            <aside className="event-detail-sidebar">
              <section className="event-detail-side-card">
                <div className="event-detail-card-header">
                  <h2>Ticket Options</h2>
                </div>
                {ticketTypes.length > 0 ? (
                  <div className="event-ticket-list">
                    {ticketTypes.map((ticketType) => (
                      <div className="event-ticket-item" key={ticketType.id}>
                        <div>
                          <div className="event-ticket-item-top">
                            <p
                              className="event-ticket-item-name"
                              style={{
                                color: ticketType.colorCode || undefined,
                              }}
                            >
                              {ticketType.name}
                            </p>
                          </div>
                          <p className="event-ticket-item-meta">
                            {ticketType.description?.trim() ||
                              "Đang cập nhật mô tả vé"}
                          </p>
                        </div>
                        <div className="event-ticket-item-price">
                          {typeof ticketType.price === "number"
                            ? `${ticketType.price.toLocaleString("vi-VN")} đ`
                            : "Đang cập nhật"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="event-ticket-item-meta">
                    Chưa có dữ liệu loại vé.
                  </p>
                )}
              </section>

              <section className="event-detail-side-card">
                <div className="event-detail-card-header">
                  <h2>Organizer</h2>
                </div>
                <div className="event-organizer-header">
                  {organizer?.logoUrl ? (
                    <img
                      src={organizer.logoUrl}
                      alt={organizer.name}
                      className="event-organizer-avatar"
                    />
                  ) : (
                    <div className="event-organizer-avatar event-organizer-avatar-fallback">
                      {organizerInitials}
                    </div>
                  )}
                  <div className="event-organizer-meta">
                    <div className="event-organizer-title-row">
                      <h4>{organizer?.name || "Đang cập nhật"}</h4>
                      {organizer?.isVerified && (
                        <span className="event-organizer-badge">Verified</span>
                      )}
                    </div>
                    <p>
                      {organizer?.description ||
                        "Thông tin nhà tổ chức sẽ được cập nhật sớm."}
                    </p>
                  </div>
                </div>
                <div className="event-organizer-stats event-organizer-stats--list">
                  <div className="event-organizer-stat event-organizer-stat--list">
                    <span>
                      <span className="event-organizer-label">Name:</span>{" "}
                      <span className="event-organizer-value">
                        {organizer?.name || "Đang cập nhật"}
                      </span>
                    </span>
                  </div>
                  <div className="event-organizer-stat event-organizer-stat--list">
                    <span>
                      <span className="event-organizer-label">Describe:</span>{" "}
                      <span className="event-organizer-value">
                        {organizer?.description || "Đang cập nhật"}
                      </span>
                    </span>
                  </div>
                  <div className="event-organizer-stat event-organizer-stat--list">
                    <span>
                      <span className="event-organizer-label">Email:</span>{" "}
                      <span className="event-organizer-value">
                        {organizer?.email || "Đang cập nhật"}
                      </span>
                    </span>
                  </div>
                  <div className="event-organizer-stat event-organizer-stat--list">
                    <span>
                      <span className="event-organizer-label">Phone:</span>{" "}
                      <span className="event-organizer-value">
                        {organizer?.phone || "Đang cập nhật"}
                      </span>
                    </span>
                  </div>
                  <div className="event-organizer-stat event-organizer-stat--list">
                    <span>
                      <span className="event-organizer-label">Web:</span>{" "}
                      <span className="event-organizer-value">
                        {organizer?.websiteUrl ? (
                          <a
                            href={organizer.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {organizer.websiteUrl}
                          </a>
                        ) : (
                          "Đang cập nhật"
                        )}
                      </span>
                    </span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </section>

        <section className="event-gallery-section" aria-label="Event Gallery">
          <header className="event-gallery-header">
            <h2>Event <span className="event-gallery-title-highlight">Gallery</span></h2>
            <p>
              Khoảnh khắc sống động từ đám đông, sân khấu và các hoạt động nổi
              bật tại sự kiện.
            </p>
          </header>

          <div className="event-gallery-grid">
            <div className="event-gallery-row event-gallery-row-top">
              <figure className="event-gallery-item event-gallery-item-large">
                <img
                  src={eventGalleryImages[0]}
                  alt={`${event.title} crowd moment`}
                />
              </figure>
              <figure className="event-gallery-item event-gallery-item-small">
                <img
                  src={eventGalleryImages[1]}
                  alt={`${event.title} activity moment`}
                />
              </figure>
            </div>

            <div className="event-gallery-row event-gallery-row-bottom">
              {eventGalleryImages.slice(2, 5).map((imageUrl, index) => (
                <figure className="event-gallery-item" key={`${imageUrl}-${index}`}>
                  <img
                    src={imageUrl}
                    alt={`${event.title} performance moment ${index + 1}`}
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="event-trust-strip">
          <header className="event-trust-header">
            <h2>We <span className="event-trust-title-highlight">Accepted</span></h2>
          </header>

          <p className="event-trust-copy">
            Thousands of attendees trust FlashTicket for secure event ticketing
          </p>

          <div className="partner-grid event-partner-grid">
            {partnerLogos.map((partner) => (
              <div
                className="partner-logo event-partner-logo"
                key={partner.id}
                title={partner.name}
              >
                <img src={partner.image} alt={partner.name} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 16px",
          boxSizing: "border-box",
        }}
      >
        <Blog />
      </div>
      <Footer />
    </div>
  );
}
