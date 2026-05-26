import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppPagination from "../../components/common/AppPagination";
import Blog from "../../components/common/Blog";
import Footer from "../../components/common/Footer";
import { eventService } from "../../services/eventService";
import { categoryService } from "../../services/categoryService";
import { EventSummary, SpringPage, Category } from "../../types/api";
import { Search, MapPin, X, ChevronDown, LoaderCircle } from "lucide-react";

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

function getEventImage(event: EventSummary) {
  return (
    event.bannerUrl ||
    event.thumbnailUrl ||
    event.images?.find((image) => image.type === "BANNER")?.url ||
    event.images?.find((image) => image.type === "THUMBNAIL")?.url ||
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1400&auto=format&fit=crop"
  );
}

function getEventLocation(event: EventSummary) {
  const venueName = event.venue?.name || event.venueName;
  const cityName = event.venue?.city || event.city;
  const parts = [venueName, cityName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim());

  return Array.from(new Set(parts)).join(", ") || "Đang cập nhật địa điểm";
}

function formatEventPrice(event: EventSummary) {
  const minPrice =
    typeof event.minPrice === "number"
      ? event.minPrice
      : typeof event.minPrice === "string"
        ? Number(event.minPrice)
        : undefined;

  if (typeof minPrice === "number" && Number.isFinite(minPrice)) {
    return `Từ ${minPrice.toLocaleString("vi-VN")} đ`;
  }
  return "Đang cập nhật";
}

export default function EventSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL State
  const querySearch = searchParams.get("search") || "";
  const queryCategory = searchParams.get("category") || "";
  const queryCity = searchParams.get("city") || "";
  const queryMinPrice = searchParams.get("minPrice") || "";
  const queryMaxPrice = searchParams.get("maxPrice") || "";
  const queryStartDate = searchParams.get("startDate") || "";
  const queryEndDate = searchParams.get("endDate") || "";
  const querySort = searchParams.get("sort") || "startDatetime,asc";
  const queryPage = parseInt(searchParams.get("page") || "0");
  const querySize = parseInt(searchParams.get("size") || "12");

  // Local UI State
  const [searchInput, setSearchInput] = useState(querySearch);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCityDropdownOpen(false);
      }
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSortDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch Categories
  useEffect(() => {
    categoryService
      .getCategories()
      .then((res) => {
        if (res && Array.isArray(res)) setCategories(res);
      })
      .catch((err) => console.error("Failed to load categories", err));
  }, []);

  // Update local search input when URL changes
  useEffect(() => {
    setSearchInput(querySearch);
  }, [querySearch]);

  // Fetch Events based on URL parameters
  const {
    data: eventsPage,
    isLoading,
    isError,
    error,
  } = useQuery<SpringPage<EventSummary>, Error, SpringPage<EventSummary>>({
    queryKey: [
      "events-search",
      querySearch,
      queryCategory,
      queryCity,
      queryMinPrice,
      queryMaxPrice,
      queryStartDate,
      queryEndDate,
      querySort,
      queryPage,
      querySize,
    ],
    queryFn: () => {
      const apiParams: Record<string, any> = {
        page: queryPage,
        size: querySize,
        sort: querySort,
      };

      if (querySearch) apiParams.search = querySearch;
      if (queryCategory) apiParams.category = queryCategory;
      if (queryCity) apiParams.city = queryCity;
      if (queryMinPrice) apiParams.minPrice = queryMinPrice;
      if (queryMaxPrice) apiParams.maxPrice = queryMaxPrice;
      if (queryStartDate) apiParams.startDate = queryStartDate;
      if (queryEndDate) apiParams.endDate = queryEndDate;

      return eventService.getEvents(apiParams);
    },
  });

  // Handlers for updating URL search parameters
  const updateFilters = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });

    if (!("page" in updates)) {
      newParams.set("page", "0");
    }

    setSearchParams(newParams);
  };

  const updateFilter = (key: string, value: string | null) => {
    updateFilters({ [key]: value });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter("search", searchInput);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setSearchInput("");
  };

  const handlePageChange = (newPage: number) => {
    updateFilter("page", newPage.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="event-search-page">
      <nav className="category-nav">
        <div className="container">
          <ul
            className="category-list"
            style={{
              margin: 0,
              padding: 0,
              display: "flex",
              listStyle: "none",
              overflowX: "auto",
            }}
          >
            <li className="category-item">
              <button
                className="category-link"
                onClick={() => updateFilter("category", null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: !queryCategory ? "#CC9900" : "rgba(255, 255, 255, 0.72)",
                  fontWeight: "600",
                }}
              >
                Tất cả
              </button>
            </li>
            {categories.length > 0 ? (
              categories.map((cat) => (
                <li className="category-item" key={cat.id}>
                  <button
                    className="category-link"
                    onClick={() => updateFilter("category", cat.slug)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color:
                        queryCategory === cat.slug
                          ? "#CC9900"
                          : "rgba(255, 255, 255, 0.72)",
                      fontWeight: "600",
                    }}
                  >
                    {cat.name}
                  </button>
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

      <div
        className="container"
        style={{ paddingTop: "30px", paddingBottom: "60px" }}
      >
        <div
          style={{
            display: "flex",
            gap: "30px",
            flexDirection: "row",
            flexWrap: "wrap",
          }}
        >
          {/* SIDEBAR FILTERS */}
          <aside
            className="search-sidebar block"
            style={{
              width: "100%",
              maxWidth: "300px",
              background: "white",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              height: "fit-content",
              position: "sticky",
              top: "24px",
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                Bộ lọc
              </h3>
              <button
                onClick={clearFilters}
                style={{
                  fontSize: "14px",
                  color: "#000000",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Xóa tất cả
              </button>
            </div>

            <form
              onSubmit={handleSearchSubmit}
              style={{ marginBottom: "24px" }}
            >
              <div className="form-group">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px",
                  }}
                >
                  Từ khóa
                </label>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Search
                    size={16}
                    style={{
                      position: "absolute",
                      left: "14px",
                      color: "#999",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    style={{
                      width: "100%",
                      paddingLeft: "40px",
                      paddingRight: searchInput ? "40px" : "16px",
                      borderRadius: "9999px",
                      height: "44px",
                      border: "1px solid #ccc",
                      backgroundColor: "#f9f9f9",
                    }}
                    placeholder="Tên sự kiện, nghệ sĩ..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        updateFilter("search", null);
                      }}
                      style={{
                        position: "absolute",
                        right: "10px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#999",
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                      }}
                      title="Xóa tìm kiếm"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Danh mục
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    checked={!queryCategory}
                    onChange={() => updateFilter("category", null)}
                    style={{ marginRight: "8px" }}
                  />
                  Tất cả danh mục
                </label>
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    <input
                      type="radio"
                      name="category"
                      checked={queryCategory === cat.slug}
                      onChange={() => updateFilter("category", cat.slug)}
                      style={{ marginRight: "8px" }}
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "24px" }} ref={cityDropdownRef}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Địa điểm
              </label>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    borderRadius: "9999px",
                    border: "1px solid var(--border)",
                    background: "white",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: queryCity ? "var(--text-primary)" : "#666",
                  }}
                >
                  {queryCity || "Tất cả địa điểm"}
                  <ChevronDown
                    size={16}
                    style={{
                      transition: "transform 0.2s ease-in-out",
                      transform: isCityDropdownOpen
                        ? "rotate(-180deg)"
                        : "rotate(0deg)",
                    }}
                  />
                </button>
                {isCityDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: "8px",
                      background: "white",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      zIndex: 10,
                      overflow: "hidden",
                    }}
                  >
                    {[
                      { value: null, label: "Tất cả địa điểm" },
                      { value: "Hồ Chí Minh", label: "Hồ Chí Minh" },
                      { value: "Hà Nội", label: "Hà Nội" },
                      { value: "Đà Nẵng", label: "Đà Nẵng" },
                      { value: "Đà Lạt", label: "Đà Lạt" },
                    ].map((option) => (
                      <div
                        key={option.value || "all"}
                        className={`event-search-dropdown-option ${queryCity === (option.value || "") ? "is-selected" : ""}`}
                        onClick={() => {
                          updateFilter("city", option.value);
                          setIsCityDropdownOpen(false);
                        }}
                        style={{
                          padding: "10px 16px",
                          cursor: "pointer",
                          fontSize: "14px",
                        }}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Khoảng giá
              </label>
              <div
                style={{ display: "flex", gap: "10px", alignItems: "center" }}
              >
                <input
                  type="number"
                  className="form-control"
                  placeholder="Từ"
                  value={queryMinPrice}
                  onChange={(e) =>
                    updateFilter("minPrice", e.target.value || null)
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "8px 12px",
                  }}
                />
                <span>-</span>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Đến"
                  value={queryMaxPrice}
                  onChange={(e) =>
                    updateFilter("maxPrice", e.target.value || null)
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "8px 12px",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Thời gian
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div>
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    Từ ngày:
                  </span>
                  <input
                    type="date"
                    className="form-control"
                    value={queryStartDate}
                    onChange={(e) =>
                      updateFilter("startDate", e.target.value || null)
                    }
                    style={{
                      width: "100%",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    Đến ngày:
                  </span>
                  <input
                    type="date"
                    className="form-control"
                    value={queryEndDate}
                    onChange={(e) =>
                      updateFilter("endDate", e.target.value || null)
                    }
                    style={{
                      width: "100%",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT - RESULTS LIST */}
          <main style={{ flex: "1", minWidth: "300px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <p
                className="event-search-results-summary"
                style={{
                  color: "#ffffff",
                  fontWeight: 600,
                }}
              >
                {isLoading
                  ? "Đang tìm kiếm"
                  : `Tìm thấy ${eventsPage?.totalElements || 0} sự kiện`}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  position: "relative",
                }}
                ref={sortDropdownRef}
              >
                <label
                  style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff" }}
                >
                  Sắp xếp:
                </label>
                <button
                  type="button"
                  onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "9999px",
                    border: "1px solid var(--border)",
                    background: "white",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: "13px",
                    minWidth: "120px",
                    gap: "6px",
                  }}
                >
                  {querySort === "startDatetime,asc"
                    ? "Gần đây"
                    : querySort === "startDatetime,desc"
                      ? "Xa nhất"
                      : querySort === "createdAt,desc"
                        ? "Mới nhất"
                        : "A-Z"}
                  <ChevronDown
                    size={16}
                    style={{
                      transition: "transform 0.2s ease-in-out",
                      transform: isSortDropdownOpen
                        ? "rotate(-180deg)"
                        : "rotate(0deg)",
                    }}
                  />
                </button>
                {isSortDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "8px",
                      background: "white",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      zIndex: 10,
                      overflow: "hidden",
                      minWidth: "160px",
                    }}
                  >
                    {[
                      { value: "startDatetime,asc", label: "Gần đây" },
                      { value: "startDatetime,desc", label: "Xa nhất" },
                      { value: "createdAt,desc", label: "Mới nhất" },
                      { value: "title,asc", label: "A-Z" },
                    ].map((option) => (
                      <div
                        key={option.value}
                        className={`event-search-dropdown-option ${querySort === option.value ? "is-selected" : ""}`}
                        onClick={() => {
                          updateFilter("sort", option.value);
                          setIsSortDropdownOpen(false);
                        }}
                        style={{
                          padding: "10px 16px",
                          cursor: "pointer",
                          fontSize: "14px",
                        }}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVE FILTERS CHIPS */}
            {(queryCategory ||
              queryCity ||
              queryMinPrice ||
              queryMaxPrice ||
              queryStartDate ||
              queryEndDate) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "20px",
                }}
              >
                {queryCategory && (
                  <span className="filter-chip" style={chipStyle}>
                    Danh mục:{" "}
                    {categories.find((c) => c.slug === queryCategory)?.name ||
                      queryCategory}
                    <button
                      onClick={() => updateFilter("category", null)}
                      style={chipBtnStyle}
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {queryCity && (
                  <span className="filter-chip" style={chipStyle}>
                    Địa điểm: {queryCity}
                    <button
                      onClick={() => updateFilter("city", null)}
                      style={chipBtnStyle}
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {(queryMinPrice || queryMaxPrice) && (
                  <span className="filter-chip" style={chipStyle}>
                    Giá:{" "}
                    {queryMinPrice
                      ? `${parseInt(queryMinPrice).toLocaleString("vi-VN")}đ`
                      : "0đ"}{" "}
                    -{" "}
                    {queryMaxPrice
                      ? `${parseInt(queryMaxPrice).toLocaleString("vi-VN")}đ`
                      : "Max"}
                    <button
                      onClick={() => {
                        updateFilters({ minPrice: null, maxPrice: null });
                      }}
                      style={chipBtnStyle}
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {(queryStartDate || queryEndDate) && (
                  <span className="filter-chip" style={chipStyle}>
                    Ngày: {queryStartDate || "..."} đến {queryEndDate || "..."}
                    <button
                      onClick={() => {
                        updateFilters({ startDate: null, endDate: null });
                      }}
                      style={chipBtnStyle}
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* EVENTS LIST */}
            {isLoading ? (
              <div className="event-search-loading">
                <LoaderCircle className="event-search-loading-icon" size={22} />
                <span>Loading</span>
              </div>
            ) : isError ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "50px",
                  background: "#ffebee",
                  borderRadius: "8px",
                  color: "#d32f2f",
                }}
              >
                <p>Có lỗi xảy ra khi lấy dữ liệu: {(error as Error).message}</p>
              </div>
            ) : !eventsPage?.content || eventsPage.content.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "80px 20px",
                  background: "white",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                }}
              >
                <Search
                  size={48}
                  style={{ color: "#ccc", margin: "0 auto 16px" }}
                />
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  Không tìm thấy sự kiện nào
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    marginBottom: "24px",
                  }}
                >
                  Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
                </p>
                <button onClick={clearFilters} className="btn btn-outline">
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <>
                <div className="event-grid event-search-grid">
                  {eventsPage.content.map((event: EventSummary) => {
                    const eventDate = event.startDatetime
                      ? new Date(event.startDatetime)
                      : null;
                    const isValidDate =
                      eventDate !== null && !Number.isNaN(eventDate.getTime());
                    const dayMonth = isValidDate
                      ? `${eventDate.getDate()} ${monthShortNames[eventDate.getMonth()]}`
                      : "";
                    const year = isValidDate ? eventDate.getFullYear() : "";

                    return (
                      <article
                        className="upcoming-event-card event-search-card"
                        key={event.id}
                      >
                        <Link
                          to={`/event/${event.slug || event.id}`}
                          className="upcoming-card-image-wrapper"
                        >
                          <img src={getEventImage(event)} alt={event.title} />
                          {isValidDate && (
                            <div className="upcoming-date-badge">
                              <span className="upcoming-date-day">
                                {dayMonth}
                              </span>
                              <span className="upcoming-date-year">{year}</span>
                            </div>
                          )}
                        </Link>

                        <div className="upcoming-card-content event-search-card-content">
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
                              {formatEventPrice(event)}
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

                {/* PAGINATION */}
                <AppPagination
                  currentPage={queryPage}
                  pageCount={eventsPage.totalPages}
                  onPageChange={handlePageChange}
                  pageRangeDisplayed={4}
                  marginPagesDisplayed={1}
                  showPageInfo={false}
                />
              </>
            )}
          </main>
        </div>
      </div>

      <div className="container search-blog-section">
        <Blog />
      </div>

      <Footer />
    </div>
  );
}

// Inline styles for Filter Chips
const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "#f0f0f0",
  padding: "6px 12px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "500",
  color: "var(--text-primary)",
};

const chipBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginLeft: "6px",
  cursor: "pointer",
  padding: "2px",
  borderRadius: "50%",
  color: "#666",
};
