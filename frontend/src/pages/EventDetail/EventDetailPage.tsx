import {
  CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { eventService } from "../../services/eventService";
import { categoryService } from "../../services/categoryService";
import { Category, EventSummary } from "../../types/api";
import { MapPin, Calendar, Ticket } from "lucide-react";

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const heroCardRef = useRef<HTMLElement | null>(null);
  const heroDividerRef = useRef<HTMLDivElement | null>(null);
  const heroMaskId = useId().replace(/:/g, "");
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [heroMask, setHeroMask] = useState<{
    width: number;
    height: number;
    dividerCenterX: number;
  } | null>(null);

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
      .finally(() => {
        setIsLoading(false);
      });
  }, [slug]);

  useLayoutEffect(() => {
    if (!heroCardRef.current || !heroDividerRef.current) return;

    const updateHeroMask = () => {
      if (!heroCardRef.current || !heroDividerRef.current) return;

      const cardRect = heroCardRef.current.getBoundingClientRect();
      const dividerRect = heroDividerRef.current.getBoundingClientRect();

      if (cardRect.width === 0 || cardRect.height === 0) return;

      const nextMask = {
        width: Math.round(cardRect.width),
        height: Math.round(cardRect.height),
        dividerCenterX: Math.round(
          dividerRect.left - cardRect.left + dividerRect.width / 2
        ),
      };

      setHeroMask((currentMask) => {
        if (
          currentMask &&
          currentMask.width === nextMask.width &&
          currentMask.height === nextMask.height &&
          currentMask.dividerCenterX === nextMask.dividerCenterX
        ) {
          return currentMask;
        }

        return nextMask;
      });
    };

    updateHeroMask();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeroMask);
      return () => window.removeEventListener("resize", updateHeroMask);
    }

    const resizeObserver = new ResizeObserver(updateHeroMask);
    resizeObserver.observe(heroCardRef.current);
    resizeObserver.observe(heroDividerRef.current);
    window.addEventListener("resize", updateHeroMask);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeroMask);
    };
  }, [event]);

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
  const totalCapacity = event.statistics?.totalCapacity || event.totalCapacity;
  const ticketsSold = event.statistics?.ticketsSold || event.ticketsSold;
  const detailAddressLine = [venueName, city].filter(Boolean).join(" • ");

  // Find min price from ticketTypes or fallback to minPrice
  const minPrice =
    event.ticketTypes && event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((t: any) => t.price))
      : event.minPrice;

  const bannerUrl =
    event.images?.find((i: any) => i.type === "BANNER")?.url || event.bannerUrl;
  const posterUrl =
    event.images?.find((i: any) => i.type === "POSTER")?.url ||
    event.thumbnailUrl;

  const heroCardStyle = heroMask
    ? ({
        "--event-hero-mask": `url(#${heroMaskId})`,
      } as CSSProperties)
    : undefined;

  return (
    <div className="event-detail-page" style={{ paddingBottom: "60px" }}>
      {heroMask && (
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
              x="0"
              y="0"
              width={heroMask.width}
              height={heroMask.height}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
            >
              <rect
                x="0"
                y="0"
                width={heroMask.width}
                height={heroMask.height}
                rx="30"
                ry="30"
                fill="white"
              />
              <circle cx={heroMask.dividerCenterX} cy="0" r="30" fill="black" />
              <circle
                cx={heroMask.dividerCenterX}
                cy={heroMask.height}
                r="30"
                fill="black"
              />
            </mask>
          </defs>
        </svg>
      )}

      {/* CATEGORY NAV */}
      <nav className="category-nav">
        <div className="container">
          <ul className="category-list">
            <li className="category-item">
              <Link to="/search" className="category-link">
                Tất cả
              </Link>
            </li>
            {allCategories.length > 0 ? (
              allCategories.map((cat) => (
                <li className="category-item" key={cat.id}>
                  <Link
                    to={`/search?category=${cat.slug || cat.id}`}
                    className="category-link"
                  >
                    {cat.name}
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

      {/* BANNER SECTION */}
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
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.1))",
          }}
        ></div>
      </div>

      {/* CONTENT SECTION */}
      <div className="container event-hero-wrap">
        <article
          className="event-hero-card"
          ref={heroCardRef}
          style={heroCardStyle}
        >
          {/* LEFT: Event Info */}
          <section className="event-hero-info">
            {event.categories && event.categories.length > 0 ? (
              <div className="event-hero-tags">
                {event.categories.map((cat: any) => (
                  <span
                    key={cat.id || cat.slug || cat.name}
                    className="event-hero-tag"
                  >
                    {cat.name}
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

              {(totalCapacity !== undefined || ticketsSold !== undefined) && (
                <div className="event-hero-meta-item">
                  <Ticket size={20} className="event-hero-meta-icon" />
                  <div>
                    <p className="event-hero-meta-primary">
                      Số lượng vé: {totalCapacity?.toLocaleString("vi-VN") || "Không giới hạn"}
                    </p>
                    <p className="event-hero-meta-secondary">
                      Đã bán: {ticketsSold?.toLocaleString("vi-VN") || "0"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="event-hero-separator" />

            <div className="event-hero-cta-row">
              <div className="event-hero-price-inline">
                <p className="event-hero-price-label">Giá vé chỉ từ</p>
                <p className="event-hero-price-value">
                  {minPrice ? `${minPrice.toLocaleString("vi-VN")} đ` : "Miễn phí"}
                </p>
              </div>
            </div>

            <button
              className="btn btn-primary event-hero-cta-button"
              onClick={() => navigate(`/events/${slug}/book`)}
            >
              Chọn lịch diễn
            </button>
          </section>

          {/* Decorative divider */}
          <div className="event-hero-divider" aria-hidden="true" ref={heroDividerRef}>
            <span className="event-hero-divider-cap top" />
            <span className="event-hero-divider-line" />
            <span className="event-hero-divider-cap bottom" />
          </div>

          {/* RIGHT: Poster */}
          <section className="event-hero-poster">
            <img
              src={
                posterUrl ||
                bannerUrl ||
                "https://via.placeholder.com/560x720?text=No+Poster"
              }
              alt={event.title}
              className="event-hero-poster-image"
            />
            <div className="event-hero-poster-overlay" />
          </section>
        </article>

        {/* TICKET TYPES SECTION */}
        {event.ticketTypes && event.ticketTypes.length > 0 && (
          <div
            style={{
              marginTop: "40px",
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "24px",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "16px",
              }}
            >
              Thông tin vé
            </h2>
            <div className="ticket-type-list">
              {event.ticketTypes.map((ticket: any) => (
                <div key={ticket.id} className="ticket-type-block">
                  <div>
                    <div className="type-name">{ticket.name}</div>
                    {ticket.description && (
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "14px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {ticket.description}
                      </p>
                    )}
                    {(ticket.status === "SOLD_OUT" ||
                      ticket.quantityAvailable === 0) && (
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "8px",
                          padding: "4px 8px",
                          backgroundColor: "#fee2e2",
                          color: "#ef4444",
                          fontSize: "12px",
                          fontWeight: "bold",
                          borderRadius: "4px",
                        }}
                      >
                        HẾT VÉ
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="type-price">
                      {ticket.price.toLocaleString("vi-VN")} {ticket.currency}
                    </div>
                    {ticket.originalPrice &&
                      ticket.originalPrice > ticket.price && (
                        <div
                          style={{
                            fontSize: "13px",
                            textDecoration: "line-through",
                            color: "var(--text-secondary)",
                            marginTop: "2px",
                          }}
                        >
                          {ticket.originalPrice.toLocaleString("vi-VN")}{" "}
                          {ticket.currency}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DESCRIPTION SECTION */}
        <div
          style={{
            marginTop: "40px",
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "24px",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "16px",
            }}
          >
            Giới thiệu sự kiện
          </h2>
          <div
            style={{ lineHeight: "1.8", color: "var(--text-secondary)" }}
            dangerouslySetInnerHTML={{
              __html:
                event.description ||
                event.shortDescription ||
                "Đang cập nhật thông tin giới thiệu chi tiết cho sự kiện này.",
            }}
          />
        </div>
      </div>
    </div>
  );
}
