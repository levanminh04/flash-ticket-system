import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { eventService } from "../../services/eventService";
import { categoryService } from "../../services/categoryService";
import { Category, EventSummary } from "../../types/api";
import { MapPin, Calendar, Ticket } from "lucide-react";

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventSummary | null>(null);
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
      .finally(() => {
        setIsLoading(false);
      });
  }, [slug]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p>Đang tải thông tin sự kiện...</p>
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

  return (
    <div className="event-detail-page" style={{ paddingBottom: "60px" }}>
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
                <span className="category-link">Đang tải...</span>
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
      <div
        className="container"
        style={{ marginTop: "-80px", position: "relative", zIndex: 10 }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
            display: "flex",
            gap: "40px",
            flexWrap: "wrap",
          }}
        >
          {/* LEFT: Thumbnail (Optional, if you want a poster look) */}
          <div style={{ width: "240px", flexShrink: 0 }}>
            <img
              src={
                posterUrl ||
                "https://via.placeholder.com/240x320?text=No+Poster"
              }
              alt="Poster"
              style={{
                width: "100%",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
          </div>

          {/* RIGHT: Event Info */}
          <div style={{ flex: 1, minWidth: "300px" }}>
            {event.categories && event.categories.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "16px",
                }}
              >
                {event.categories.map((cat: any) => (
                  <span
                    key={cat.id || cat.slug || cat.name}
                    style={{
                      background: "var(--primary)",
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "9999px",
                      fontSize: "14px",
                      fontWeight: "600",
                      display: "inline-block",
                    }}
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
            ) : (
              event.category && (
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "16px",
                  }}
                >
                  <span
                    style={{
                      background: "var(--primary)",
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "9999px",
                      fontSize: "14px",
                      fontWeight: "600",
                      display: "inline-block",
                    }}
                  >
                    {event.category.name}
                  </span>
                </div>
              )
            )}

            <h1
              style={{
                fontSize: "32px",
                fontWeight: "bold",
                marginBottom: "24px",
                lineHeight: "1.3",
              }}
            >
              {event.title}
            </h1>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  color: "var(--text-secondary)",
                }}
              >
                <Calendar
                  size={20}
                  style={{ color: "var(--primary)", flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: "500",
                      color: "var(--text-primary)",
                    }}
                  >
                    {startDate.toLocaleDateString("vi-VN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px" }}>
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

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  color: "var(--text-secondary)",
                }}
              >
                <MapPin
                  size={20}
                  style={{ color: "var(--primary)", flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: "500",
                      color: "var(--text-primary)",
                    }}
                  >
                    {venueName || "Đang cập nhật địa điểm"}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px" }}>{city || ""}</p>
                </div>
              </div>

              {/* Tickets Capacity */}
              {(totalCapacity !== undefined || ticketsSold !== undefined) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Ticket
                    size={20}
                    style={{ color: "var(--primary)", flexShrink: 0 }}
                  />
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: "500",
                        color: "var(--text-primary)",
                      }}
                    >
                      Số lượng vé:{" "}
                      {totalCapacity?.toLocaleString("vi-VN") ||
                        "Không giới hạn"}
                    </p>
                    <p style={{ margin: 0, fontSize: "14px" }}>
                      Đã bán: {ticketsSold?.toLocaleString("vi-VN") || "0"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                background: "#f9f9f9",
                padding: "24px",
                borderRadius: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    color: "var(--text-secondary)",
                  }}
                >
                  Giá vé từ:
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "28px",
                    fontWeight: "bold",
                    color: "var(--primary)",
                  }}
                >
                  {minPrice
                    ? `${minPrice.toLocaleString("vi-VN")} đ`
                    : "Miễn phí"}
                </p>
              </div>
              <button
                className="btn btn-primary"
                style={{
                  padding: "10px 32px",
                  fontSize: "16px",
                  borderRadius: "9999px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onClick={() => navigate(`/events/${slug}/book`)}
              >
                Mua vé ngay
              </button>
            </div>
          </div>
        </div>

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
