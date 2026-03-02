import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { eventService } from "../../services/eventService";
import { categoryService } from "../../services/categoryService";
import { EventSummary, SpringPage, Category } from "../../types/api";
import { Search, MapPin, Calendar, Filter, X, ChevronDown } from "lucide-react";

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
  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    // Reset page to 0 when filters change
    if (key !== "page") {
      newParams.set("page", "0");
    }
    setSearchParams(newParams);
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
    <>
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
                  color: !queryCategory ? "var(--primary)" : "inherit",
                  fontWeight: !queryCategory ? "bold" : "normal",
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
                          ? "var(--primary)"
                          : "inherit",
                      fontWeight:
                        queryCategory === cat.slug ? "bold" : "normal",
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
                <Filter size={18} style={{ marginRight: "8px" }} /> Bộ lọc
              </h3>
              <button
                onClick={clearFilters}
                style={{
                  fontSize: "14px",
                  color: "var(--primary)",
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
                        onClick={() => {
                          updateFilter("city", option.value);
                          setIsCityDropdownOpen(false);
                        }}
                        style={{
                          padding: "10px 16px",
                          cursor: "pointer",
                          fontSize: "14px",
                          background:
                            queryCity === (option.value || "")
                              ? "#f0f0f0"
                              : "transparent",
                          fontWeight:
                            queryCity === (option.value || "")
                              ? "bold"
                              : "normal",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.background = "#f9f9f9")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.background =
                            queryCity === (option.value || "")
                              ? "#f0f0f0"
                              : "transparent")
                        }
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
              <p style={{ color: "var(--text-secondary)" }}>
                {isLoading
                  ? "Đang tìm kiếm..."
                  : `Tìm thấy ${(eventsPage as unknown as SpringPage<EventSummary>)?.totalElements || 0} sự kiện`}
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
                  style={{ fontSize: "14px", color: "var(--text-secondary)" }}
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
                        onClick={() => {
                          updateFilter("sort", option.value);
                          setIsSortDropdownOpen(false);
                        }}
                        style={{
                          padding: "10px 16px",
                          cursor: "pointer",
                          fontSize: "14px",
                          background:
                            querySort === option.value
                              ? "#f0f0f0"
                              : "transparent",
                          fontWeight:
                            querySort === option.value ? "bold" : "normal",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.background = "#f9f9f9")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.background =
                            querySort === option.value
                              ? "#f0f0f0"
                              : "transparent")
                        }
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
                        updateFilter("minPrice", null);
                        updateFilter("maxPrice", null);
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
                        updateFilter("startDate", null);
                        updateFilter("endDate", null);
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
              <div style={{ textAlign: "center", padding: "50px" }}>
                <div className="spinner"></div>{" "}
                {/* Assume there's CSS for this */}
                <p
                  style={{ marginTop: "16px", color: "var(--text-secondary)" }}
                >
                  Đang tải dữ liệu...
                </p>
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
                <div className="event-grid">
                  {eventsPage.content.map((event: EventSummary) => (
                    <Link
                      to={`/event/${event.slug || event.id}`}
                      className="standard-card"
                      key={event.id}
                      style={{
                        background: "white",
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                      }}
                    >
                      <div
                        className="thumb-wrapper"
                        style={{
                          position: "relative",
                          height: "0",
                          paddingBottom: "60%",
                        }}
                      >
                        <img
                          src={
                            event.thumbnailUrl ||
                            event.bannerUrl ||
                            "https://via.placeholder.com/400x250?text=No+Image"
                          }
                          alt={event.title}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                        {event.category && (
                          <span
                            style={{
                              position: "absolute",
                              top: "12px",
                              left: "12px",
                              background: "rgba(0,0,0,0.6)",
                              color: "white",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "500",
                            }}
                          >
                            {event.category.name}
                          </span>
                        )}
                      </div>
                      <div className="card-content" style={{ padding: "16px" }}>
                        <h4
                          className="card-title"
                          style={{
                            fontSize: "16px",
                            fontWeight: "600",
                            marginBottom: "12px",
                            lineHeight: "1.4",
                            height: "44px",
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {event.title}
                        </h4>
                        <p
                          className="card-meta"
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            color: "var(--text-secondary)",
                            fontSize: "13px",
                            marginBottom: "8px",
                          }}
                        >
                          <Calendar
                            size={14}
                            style={{
                              marginRight: "6px",
                              marginTop: "2px",
                              flexShrink: 0,
                            }}
                          />
                          <span>
                            {event.startDatetime
                              ? new Date(event.startDatetime).toLocaleString(
                                  "vi-VN",
                                )
                              : "Đang cập nhật"}
                          </span>
                        </p>
                        <p
                          className="card-meta"
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            color: "var(--text-secondary)",
                            fontSize: "13px",
                            marginBottom: "16px",
                            height: "38px",
                            overflow: "hidden",
                          }}
                        >
                          <MapPin
                            size={14}
                            style={{
                              marginRight: "6px",
                              marginTop: "2px",
                              flexShrink: 0,
                            }}
                          />
                          <span>
                            {event.venueName || event.city
                              ? [event.venueName, event.city]
                                  .filter(Boolean)
                                  .join(", ")
                              : event.venue
                                ? `${event.venue.name}, ${event.venue.city}`
                                : "Đang cập nhật địa điểm"}
                          </span>
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                          }}
                        >
                          <p
                            className="card-price"
                            style={{
                              color: "black",
                              fontWeight: "bold",
                              fontSize: "16px",
                              margin: 0,
                              textAlign: "center",
                            }}
                          >
                            {event.minPrice
                              ? `Từ ${event.minPrice.toLocaleString("vi-VN")} đ`
                              : "Miễn phí"}
                          </p>
                          <button
                            className="btn"
                            style={{
                              padding: "8px 16px",
                              fontSize: "14px",
                              borderRadius: "9999px",
                              background: "#2DC275",
                              color: "white",
                              fontWeight: "600",
                              border: "none",
                              width: "100%",
                              cursor: "pointer",
                              transition: "background 0.2s",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.background = "#25a764")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.background = "#2DC275")
                            }
                          >
                            Mua vé
                          </button>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* PAGINATION */}
                {eventsPage?.totalPages && eventsPage.totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "40px",
                      gap: "8px",
                    }}
                  >
                    <button
                      className="btn btn-outline"
                      disabled={queryPage === 0}
                      onClick={() => handlePageChange(queryPage - 1)}
                      style={{ padding: "8px 16px" }}
                    >
                      Trước
                    </button>

                    {Array.from({
                      length: Math.min(5, eventsPage.totalPages),
                    }).map((_, idx) => {
                      // Hiển thị tối đa 5 trang xung quanh trang hiện tại
                      let pageNum = idx;
                      if (eventsPage.totalPages && eventsPage.totalPages > 5) {
                        if (
                          queryPage > 2 &&
                          queryPage < eventsPage.totalPages - 2
                        ) {
                          pageNum = queryPage - 2 + idx;
                        } else if (queryPage >= eventsPage.totalPages - 2) {
                          pageNum = eventsPage.totalPages - 5 + idx;
                        }
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          style={{
                            padding: "8px 16px",
                            border: "1px solid var(--border)",
                            borderRadius: "4px",
                            background:
                              queryPage === pageNum
                                ? "var(--primary)"
                                : "white",
                            color:
                              queryPage === pageNum
                                ? "white"
                                : "var(--text-primary)",
                            fontWeight:
                              queryPage === pageNum ? "bold" : "normal",
                            cursor: "pointer",
                          }}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}

                    <button
                      className="btn btn-outline"
                      disabled={
                        eventsPage.totalPages
                          ? queryPage >= eventsPage.totalPages - 1
                          : true
                      }
                      onClick={() => handlePageChange(queryPage + 1)}
                      style={{ padding: "8px 16px" }}
                    >
                      Sau
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
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
