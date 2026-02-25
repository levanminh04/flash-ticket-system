import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../assets/css/search.css";

// Using lucide-react instead of phosphor, as it's what's in package.json
import {
  Calendar,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const CATEGORIES = [
  "Nhạc sống",
  "Sân khấu và Nghệ thuật",
  "Thể Thao",
  "Hội thảo và Workshop",
  "Tham quan và Trải nghiệm",
  "Khác",
  "Vé bán lại",
];

const MOCK_EVENTS = [
  {
    id: 1,
    title: "The Eras Tour - Taylor Swift",
    price: "Từ 2.500.000 đ",
    date: "15 tháng 03, 2026",
    img: "https://i.pinimg.com/736x/e1/d2/25/e1d225782ae0adf9f4b09839d43d2b5f.jpg",
  },
  {
    id: 2,
    title: "Quốc Thiên - Hẹn Nhau Trong Giấc Mơ",
    price: "Từ 700.000 đ",
    date: "28 tháng 02, 2026",
    img: "https://ticketgo.vn/uploads/images/event-logo/event_logo-2598ec82bc099a803b86f384ecf9a296.jpg",
  },
  {
    id: 3,
    title: "MINISHOW Tăng Phúc: Mã Đáo Thành Công",
    price: "Từ 1.500.000 đ",
    date: "20 tháng 02, 2026",
    img: "https://salt.tkbcdn.com/ts/ds/e6/53/6b/444309056055b331f4fffd2e94dccdb7.jpeg",
  },
  {
    id: 4,
    title: "Tomorrowland Experience Vietnam",
    price: "Từ 1.200.000 đ",
    date: "10 tháng 04, 2026",
    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS0lQE6lHU3WlEw4PE4s8W4257Gb5qlJ1rDzQ&s",
  },
  {
    id: 5,
    title: "Trung Quân - Chiều Nay Không Có Mưa Bay",
    price: "Từ 800.000 đ",
    date: "21 tháng 02, 2026",
    img: "https://ticketbox.vn/_next/image?url=https%3A%2F%2Fsalt.tkbcdn.com%2Fts%2Fds%2F2b%2Fb5%2F4f%2F19985a7e64e8f3426c7a74dc67a76aeb.png&w=1920&q=75",
  }, // Using a different valid image since base64 is too long
  {
    id: 6,
    title: "Ca sĩ Hiền Hồ + Khách mời",
    price: "Từ 800.000 đ",
    date: "28 tháng 02, 2026",
    img: "https://salt.tkbcdn.com/ts/ds/4f/0e/a3/9be7c56aab7635f612fe4f72627d6eeb.png",
  },
  {
    id: 7,
    title: "Westlife - The Wild Dreams Tour",
    price: "Từ 1.800.000 đ",
    date: "05 tháng 05, 2026",
    img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: 8,
    title: "Lễ hội pháo hoa Đà Nẵng 2026",
    price: "Từ 500.000 đ",
    date: "01 tháng 06, 2026",
    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBjiH2yNr3J2R1pPKdaHK-ekfWsTzc0cStJw&s",
  },
  {
    id: 9,
    title: "Ký Ức Hội An - Show Thực Cảnh",
    price: "Từ 600.000 đ",
    date: "15 tháng 03, 2026",
    img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: 10,
    title: "Vũ Cát Tường - Inner Me Concert",
    price: "Từ 1.100.000 đ",
    date: "22 tháng 04, 2026",
    img: "https://salt.tkbcdn.com/ts/ds/23/a1/82/2d03b36411a1c7e4069cefa5c0b09c24.png",
  },
  {
    id: 11,
    title: "Winter Night Music Festival",
    price: "Từ 450.000 đ",
    date: "25 tháng 12, 2026",
    img: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: 12,
    title: "Ravolution Music Festival 2026",
    price: "Từ 950.000 đ",
    date: "18 tháng 07, 2026",
    img: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: 13,
    title: "Kẹp Hạt Dẻ - Vở Ballet Kinh Điển",
    price: "Từ 400.000 đ",
    date: "24 tháng 12, 2026",
    img: "https://bvhttdl.mediacdn.vn/documents/491975/908037/kep+hat+de.jpg",
  },
  {
    id: 14,
    title: "Triển lãm Van Gogh Immersive",
    price: "Từ 300.000 đ",
    date: "01 tháng 03, 2026",
    img: "https://cdn3.ivivu.com/2023/12/tri%E1%BB%83n-l%C3%A3m-Van-Gogh-ivivu.jpg",
  },
  {
    id: 15,
    title: "Kịch: Hồn Trương Ba Da Hàng Thịt",
    price: "Từ 250.000 đ",
    date: "10 tháng 03, 2026",
    img: "https://hanoigrapevine.com/wp-content/uploads/2024/07/Hon-Truong-Ba-Da-Hang-Thit.jpg",
  },
  {
    id: 16,
    title: "Nhạc Kịch: Chicago - Broadway Edition",
    price: "Từ 900.000 đ",
    date: "20 tháng 05, 2026",
    img: "https://res.klook.com/image/upload/c_crop,h_1080,w_1920,x_-1,y_0,z_0.2/w_750,h_469,c_fill,q_85/w_80,x_15,y_15,g_south_west,l_Klook_water_br_trans_yhcmh3/activities/qzbtc7rtf3d9vxi2874x.jpg",
  },
  {
    id: 17,
    title: "Vé Trải Nghiệm KidZania Hà Nội",
    price: "Từ 50.000 đ",
    date: "24 tháng 01, 2026",
    img: "https://ticketbox.vn/_next/image?url=https%3A%2F%2Fsalt.tkbcdn.com%2Fts%2Fds%2F2b%2Fb5%2F4f%2F19985a7e64e8f3426c7a74dc67a76aeb.png&w=1920&q=75",
  },
  {
    id: 18,
    title: "STAY IN THE TEMPLE - Mừng Xuân 2026",
    price: "Từ 200.000 đ",
    date: "27 tháng 01, 2026",
    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR0kcDpd9i5R_voalgKvHP-vvOGEQETO1Opzw&s",
  },
  {
    id: 19,
    title: "Ngắm Bầu Trời Đêm - Đài Thiên Văn Nha Trang",
    price: "Từ 30.000 đ",
    date: "01 tháng 02, 2026",
    img: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1000&auto=format&fit=crop",
  }, // Using fallback image
  {
    id: 20,
    title: "Trải Nghiệm Bay Dù Lượn Hà Nội",
    price: "Từ 1.850.000 đ",
    date: "06 tháng 02, 2026",
    img: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1000&auto=format&fit=crop",
  },
];

const SearchPage = () => {
  const navigate = useNavigate();

  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  const [currentMonth, setCurrentMonth] = useState(1); // Feb
  const [currentYear, setCurrentYear] = useState(2026);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState("all");

  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [isFree, setIsFree] = useState(false);

  // Close modals when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".date-picker-modal") &&
        !target.closest("#date-filter-btn")
      ) {
        setIsDateModalOpen(false);
      }
      if (
        !target.closest(".filter-panel") &&
        !target.closest("#general-filter-btn")
      ) {
        setIsFilterModalOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleNextMonth = () => {
    let nextM = currentMonth + 1;
    let nextY = currentYear;
    if (nextM > 11) {
      nextM = 0;
      nextY++;
    }
    setCurrentMonth(nextM);
    setCurrentYear(nextY);
  };

  const handlePrevMonth = () => {
    let prevM = currentMonth - 1;
    let prevY = currentYear;
    if (prevM < 0) {
      prevM = 11;
      prevY--;
    }
    setCurrentMonth(prevM);
    setCurrentYear(prevY);
  };

  const handlePresetClick = (preset: string) => {
    setActivePreset(preset);
    setSelectedDates([]);
    if (preset === "today") {
      setSelectedDates(["2026-02-07"]);
      setCurrentMonth(1);
      setCurrentYear(2026);
    } else if (preset === "tomorrow") {
      setSelectedDates(["2026-02-08"]);
    }
  };

  const handleDateClick = (dateStr: string) => {
    setActivePreset("");
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter((d) => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr]);
    }
  };

  const resetDateFilter = () => {
    setSelectedDates([]);
    setActivePreset("all");
  };

  const resetGeneralFilter = () => {
    setSelectedLocation("all");
    setIsFree(false);
    setActiveChips([]);
  };

  const renderCalendarDays = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(<div key={`empty-${i}`} className="day-cell empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isSelected = selectedDates.includes(dateStr);
      cells.push(
        <div
          key={dateStr}
          className={`day-cell ${isSelected ? "selected" : ""}`}
          onClick={() => handleDateClick(dateStr)}
        >
          {d}
        </div>,
      );
    }
    return cells;
  };

  const toggleChip = (cat: string) => {
    if (activeChips.includes(cat)) {
      setActiveChips(activeChips.filter((c) => c !== cat));
    } else {
      setActiveChips([...activeChips, cat]);
    }
  };

  // Calculate next month to show 2 calendars
  let nextDisplayMonth = currentMonth + 1;
  let nextDisplayYear = currentYear;
  if (nextDisplayMonth > 11) {
    nextDisplayMonth = 0;
    nextDisplayYear++;
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen text-slate-900 pb-20">
      {/* Category Nav */}
      <nav className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 max-w-7xl">
          <ul className="flex overflow-x-auto whitespace-nowrap gap-8 py-3 no-scrollbar text-[15px] font-medium text-slate-600">
            {CATEGORIES.map((cat, idx) => (
              <li
                key={idx}
                className="cursor-pointer hover:text-emerald-500 transition-colors"
              >
                {cat}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 max-w-7xl mt-8">
        <div className="search-header relative">
          <h1 className="search-result-title">Kết quả tìm kiếm:</h1>

          <div className="filter-group relative">
            {/* Date Filter */}
            <button
              id="date-filter-btn"
              ref={dateBtnRef}
              className={`filter-btn ${isDateModalOpen ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsDateModalOpen(!isDateModalOpen);
                setIsFilterModalOpen(false);
              }}
            >
              <Calendar size={16} />
              Tất cả các ngày
              <ChevronDown size={16} className="ph-caret-down" />
            </button>

            {/* Date Picker Modal */}
            {isDateModalOpen && (
              <div
                className="date-picker-modal show shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                  top: "100%",
                  right: "100px",
                  width: "660px",
                  position: "absolute",
                }}
              >
                <div className="date-presets">
                  {["all", "today", "tomorrow", "weekend", "month"].map(
                    (preset) => (
                      <button
                        key={preset}
                        className={`preset-btn ${activePreset === preset ? "active" : ""}`}
                        onClick={() => handlePresetClick(preset)}
                      >
                        {preset === "all" && "Tất cả các ngày"}
                        {preset === "today" && "Hôm nay"}
                        {preset === "tomorrow" && "Ngày mai"}
                        {preset === "weekend" && "Cuối tuần này"}
                        {preset === "month" && "Tháng này"}
                      </button>
                    ),
                  )}
                </div>

                <div className="calendar-header">
                  <button className="nav-btn" onClick={handlePrevMonth}>
                    <ChevronLeft size={16} />
                  </button>
                  <div className="month-title">
                    Tháng {currentMonth + 1}, {currentYear}
                  </div>
                  <div className="month-title">
                    Tháng {nextDisplayMonth + 1}, {nextDisplayYear}
                  </div>
                  <button className="nav-btn" onClick={handleNextMonth}>
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="calendar-wrapper">
                  <div className="calendar-month">
                    <div className="weekdays-row">
                      <span>T2</span>
                      <span>T3</span>
                      <span>T4</span>
                      <span>T5</span>
                      <span>T6</span>
                      <span>T7</span>
                      <span>CN</span>
                    </div>
                    <div className="days-grid">
                      {renderCalendarDays(currentMonth, currentYear)}
                    </div>
                  </div>
                  <div className="calendar-month">
                    <div className="weekdays-row">
                      <span>T2</span>
                      <span>T3</span>
                      <span>T4</span>
                      <span>T5</span>
                      <span>T6</span>
                      <span>T7</span>
                      <span>CN</span>
                    </div>
                    <div className="days-grid">
                      {renderCalendarDays(nextDisplayMonth, nextDisplayYear)}
                    </div>
                  </div>
                </div>

                <div className="date-actions mt-4 pt-4 border-t border-slate-200 flex justify-between">
                  <button
                    className="text-emerald-500 font-medium hover:bg-emerald-50 px-3 py-2 rounded-lg"
                    onClick={resetDateFilter}
                  >
                    Thiết lập lại
                  </button>
                  <button
                    className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400"
                    disabled={
                      selectedDates.length === 0 && activePreset !== "all"
                    }
                    onClick={() => setIsDateModalOpen(false)}
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}

            {/* General Filter */}
            <button
              id="general-filter-btn"
              ref={filterBtnRef}
              className={`filter-btn ${isFilterModalOpen ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsFilterModalOpen(!isFilterModalOpen);
                setIsDateModalOpen(false);
              }}
            >
              <Filter size={16} />
              Bộ lọc
            </button>

            {/* Filter Modal */}
            {isFilterModalOpen && (
              <div
                className="filter-panel show shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{ top: "100%", right: "0", position: "absolute" }}
              >
                <div className="filter-section">
                  <h3 className="filter-title">Vị trí</h3>
                  <div className="radio-group">
                    {[
                      { val: "all", label: "Toàn quốc" },
                      { val: "hcm", label: "Hồ Chí Minh" },
                      { val: "hanoi", label: "Hà Nội" },
                      { val: "other", label: "Vị trí khác" },
                    ].map((loc) => (
                      <label
                        key={loc.val}
                        className="radio-item flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="location"
                          value={loc.val}
                          checked={selectedLocation === loc.val}
                          onChange={() => setSelectedLocation(loc.val)}
                          className="hidden"
                        />
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedLocation === loc.val ? "border-emerald-500" : "border-slate-300"}`}
                        >
                          {selectedLocation === loc.val && (
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                          )}
                        </div>
                        <span
                          className={
                            selectedLocation === loc.val
                              ? "text-slate-900 font-medium"
                              : "text-slate-600"
                          }
                        >
                          {loc.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="filter-divider"></div>

                <div className="filter-section">
                  <h3 className="filter-title">Giá tiền</h3>
                  <div className="price-toggle-row flex justify-between">
                    <span className="font-medium text-slate-800">Miễn phí</span>
                    <label className="relative inline-block w-11 h-6 cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isFree}
                        onChange={() => setIsFree(!isFree)}
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                <div className="filter-divider"></div>

                <div className="filter-section">
                  <h3 className="filter-title">Thể loại</h3>
                  <div className="category-chips flex flex-wrap gap-2">
                    {[
                      { id: "music", label: "Nhạc sống" },
                      { id: "stage", label: "Sân khấu & Nghệ thuật" },
                      { id: "sports", label: "Thể thao" },
                      { id: "workshop", label: "Hội thảo & Workshop" },
                      { id: "tour", label: "Tham quan & Trải nghiệm" },
                      { id: "other", label: "Khác" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        className={`chip-btn px-4 py-2 rounded-full border text-sm font-medium transition-colors ${activeChips.includes(cat.id) ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                        onClick={() => toggleChip(cat.id)}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="date-actions mt-4 pt-4 border-t border-slate-200 flex justify-between">
                  <button
                    className="text-emerald-500 font-medium hover:bg-emerald-50 px-3 py-2 rounded-lg"
                    onClick={resetGeneralFilter}
                  >
                    Thiết lập lại
                  </button>
                  <button
                    className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600"
                    onClick={() => setIsFilterModalOpen(false)}
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Grid */}
        <div className="search-results-grid">
          {MOCK_EVENTS.map((event) => (
            <article
              key={event.id}
              className="event-card"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              <div className="thumb-wrapper">
                <img src={event.img} alt={event.title} />
              </div>
              <div className="card-content">
                <h4 className="card-title">{event.title}</h4>
                <p className="card-price">{event.price}</p>
                <p className="card-meta">
                  <Calendar size={14} className="text-emerald-500" />{" "}
                  {event.date}
                </p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};

export default SearchPage;
