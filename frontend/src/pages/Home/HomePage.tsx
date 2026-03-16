import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { eventService } from "../../services/eventService";
import { categoryService } from "../../services/categoryService";
import { Category, EventSummary } from "../../types/api";
import {
  MapPin,
  Calendar,
  Heart,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

const bannerGroups = [
  [
    {
      id: 1,
      image:
        "https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2023/11/16/247724.jpg",
      title: "Ravolution Music Festival 2026",
      tag: "Hot Trend",
      link: "/event/1",
    },
    {
      id: 2,
      image:
        "https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2022/12/23/450B75.jpg",
      title: "Hà Anh Tuấn - Chân Trời Rực Rỡ",
      tag: "Concert",
      link: "#",
    },
  ],
  [
    {
      id: 3,
      image: "https://i.ytimg.com/vi/BG26iYVppy8/maxresdefault.jpg",
      title: "Tomorrowland Experience",
      tag: "EDM",
      link: "#",
    },
    {
      id: 4,
      image:
        "https://www.didongmy.com/vnt_upload/news/03_2024/chi-tiet-ve-taylor-swift-the-eras-tour-didongmy.png",
      title: "Taylor Swift - The Eras Tour",
      tag: "Tour",
      link: "#",
    },
  ],
];

const mockEvents = [
  {
    id: "evt-1",
    title: "The Eras Tour - Taylor Swift",
    image:
      "https://upload.wikimedia.org/wikipedia/vi/3/33/The_Eras_Tour_poster.jpg",
    price: "Từ 2.500.000 đ",
  },
  {
    id: "evt-2",
    title: "Fireworks Festival",
    image:
      "https://static.vecteezy.com/system/resources/previews/008/041/545/non_2x/fireworks-festival-poster-free-vector.jpg",
    price: "Từ 500.000 đ",
  },
  {
    id: "evt-3",
    title: "Tomorrowland Exp",
    image:
      "https://assets.isu.pub/document-structure/240726102139-d62f2aa1efadcb2998ae62f494fbf40e/v1/29338e0e7df2a000594afe0a03f17550.jpeg",
    price: "Từ 1.200.000 đ",
  },
  {
    id: "evt-4",
    title: "Ký ức Hội An",
    image: "https://hoianmemoriesland.com/public/media//cv1.jpg",
    price: "Từ 600.000 đ",
  },
];

const liveMusicEvents = [
  {
    id: "lm-1",
    title: "Quốc Thiên - Hẹn Nhau Trong Giấc Mơ",
    image:
      "https://ticketgo.vn/uploads/images/event-logo/event_logo-2598ec82bc099a803b86f384ecf9a296.jpg",
    date: "28 tháng 02, 2026",
    location: "Sân khấu Trống Đồng",
    price: "Từ 700.000 đ",
  },
  {
    id: "lm-2",
    title: "MINISHOW Tăng Phúc: Mã Đáo Thành Công",
    image:
      "https://salt.tkbcdn.com/ts/ds/e6/53/6b/444309056055b331f4fffd2e94dccdb7.jpeg",
    date: "20 tháng 02, 2026",
    location: "Mây Lang Thang",
    price: "Từ 1.500.000 đ",
  },
  {
    id: "lm-3",
    title: "Trung Quân - Chiều Nay Không Có Mưa Bay",
    image: "https://i.ytimg.com/vi/y2mgM-BSong/maxresdefault.jpg",
    date: "21 tháng 02, 2026",
    location: "Nhà hát Hòa Bình",
    price: "Từ 800.000 đ",
  },
  {
    id: "lm-4",
    title: "Ca Sĩ Hiền Hồ + Khách Mời Anh Khang",
    image:
      "https://salt.tkbcdn.com/ts/ds/4f/0e/a3/9be7c56aab7635f612fe4f72627d6eeb.png",
    date: "28 tháng 02, 2026",
    location: "Phòng trà Đồng Dao",
    price: "Từ 800.000 đ",
  },
];

const stageArtsEvents = [
  {
    id: "sa-1",
    title: "Kẹp Hạt Dẻ - Ballet",
    image: "https://bvhttdl.mediacdn.vn/documents/491975/908037/kep+hat+de.jpg",
    price: "Từ 400.000 đ",
  },
  {
    id: "sa-2",
    title: "Triển lãm Van Gogh",
    image:
      "https://cdn3.ivivu.com/2023/12/tri%E1%BB%83n-l%C3%A3m-Van-Gogh-ivivu.jpg",
    price: "Từ 300.000 đ",
  },
  {
    id: "sa-3",
    title: "Kịch: Hồn Trương Ba",
    image:
      "https://hanoigrapevine.com/wp-content/uploads/2024/07/Hon-Truong-Ba-Da-Hang-Thit.jpg",
    price: "Từ 250.000 đ",
  },
  {
    id: "sa-4",
    title: "Nhạc Kịch: Chicago",
    image:
      "https://res.klook.com/image/upload/c_crop,h_1080,w_1920,x_-1,y_0,z_0.2/w_750,h_469,c_fill,q_85/w_80,x_15,y_15,g_south_west,l_Klook_water_br_trans_yhcmh3/activities/qzbtc7rtf3d9vxi2874x.jpg",
    price: "Từ 900.000 đ",
  },
];

const experienceEvents = [
  {
    id: "exp-1",
    title: "Vé Trải Nghiệm KidZania Hà Nội",
    image:
      "https://kidzania.com.vn/wp-content/uploads/2026/01/Invitation-4-Hours_Child-ticket-Front.jpg",
    date: "24 tháng 01, 2026",
    location: "Lotte Mall West Lake",
    price: "Từ 50.000 đ",
  },
  {
    id: "exp-2",
    title: "STAY IN THE TEMPLE - Mừng Xuân 2026",
    image:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg9jzq9CaBc3uKsOQkYZD5kgZr0IUpQ0rRKv3VqjQkqJ0BltWDy4GK2kRJIRvZI6BeBKieU5-7wdgtVz3LG_1RZxofVxBZSN3go4TdomKQ7df9es0s4fM6utX1PPo1Q2JtmfoyNURNSquB9Kh3u6AQjd8jkO_tmc5KiCxb_lU6RJy26nsq_e30HwEBJp04/s16000-rw/mung-dang-mung-xuan-2026.jpg",
    date: "27 tháng 01, 2026",
    location: "Chùa Tam Chúc",
    price: "Từ 200.000 đ",
  },
  {
    id: "exp-3",
    title: "Ngắm nhìn bầu trời đêm tuyệt đẹp cùng đài thiên văn Nha Trang",
    image:
      "https://images.tkbcdn.com/2/608/332/ts/ds/47/19/34/ab4d5359e79aa5204c3a8376f0c96747.png",
    date: "01 tháng 02, 2026",
    location: "Hòn Chồng, Nha Trang",
    price: "Từ 30.000 đ",
  },
  {
    id: "exp-4",
    title: "Trải Nghiệm Bay Dù Lượn Hà Nội",
    image: "https://i.ytimg.com/vi/SkIwbZeREhk/sddefault.jpg",
    date: "06 tháng 02, 2026",
    location: "Đồi Bù, Chương Mỹ",
    price: "Từ 1.850.000 đ",
  },
];

const trendingEvents = [
  {
    rank: 1,
    title: "Westlife Tour",
    image:
      "https://kenh14cdn.com/203336854389633024/2023/9/20/photo-6-16952043272871574810145.jpg",
    location: "Sân vận động Mỹ Đình",
    date: "07 Tháng 02, 2026",
  },
  {
    rank: 2,
    title: "Văn Hóa Việt - Nhật",
    image:
      "https://ticketgo.vn/uploads/images/event-gallery/event_gallery-652a8871df176a4d64fc1c4f45971001.jpg",
    location: "Công viên 23/9",
    date: "08 Tháng 02, 2026",
  },
  {
    rank: 3,
    title: "Vũ Cát Tường",
    image:
      "https://salt.tkbcdn.com/ts/ds/23/a1/82/2d03b36411a1c7e4069cefa5c0b09c24.png",
    location: "Nhà thi đấu Phú Thọ",
    date: "09 Tháng 02, 2026",
  },
  {
    rank: 4,
    title: "Winter Night",
    image:
      "https://www.shutterstock.com/image-vector/winter-season-music-event-banner-260nw-1547696636.jpg",
    location: "Phố đi bộ",
    date: "10 Tháng 02, 2026",
  },
];

const paymentPartners = [
  {
    id: 1,
    image:
      "https://homepage.momocdn.net/fileuploads/svg/momo-file-240411162904.svg",
    name: "Momo",
  },
  {
    id: 2,
    image: "https://vnpay.vn/assets/images/logo-icon/logo-primary.svg",
    name: "VNPay",
  },
  {
    id: 3,
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/1280px-PayPal.svg.png",
    name: "PayPal",
  },
  {
    id: 4,
    image: "https://upload.wikimedia.org/wikipedia/commons/d/d6/Visa_2021.svg",
    name: "Visa",
  },
  {
    id: 5,
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1200px-Mastercard-logo.svg.png",
    name: "Mastercard",
  },
  {
    id: 6,
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/JCB_logo.svg/1200px-JCB_logo.svg.png",
    name: "JCB",
  },
];

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredEvents, setFeaturedEvents] = useState<EventSummary[]>([]);
  const [otherEvents, setOtherEvents] = useState<EventSummary[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) =>
        prev === bannerGroups.length - 1 ? 0 : prev + 1,
      );
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const catRes = await categoryService.getCategories();
        if (catRes && Array.isArray(catRes)) setCategories(catRes);

        const featRes = await eventService.getFeaturedEvents(4);
        if (featRes && Array.isArray(featRes)) setFeaturedEvents(featRes);

        const evtsRes = await eventService.getEvents({ size: 8 });
        if (evtsRes && evtsRes.content) setOtherEvents(evtsRes.content);
      } catch (err) {
        console.error("Lỗi fetch HomePage API", err);
      }
    };
    loadData();
  }, []);

  const nextSlide = () =>
    setCurrentSlide((prev) =>
      prev === bannerGroups.length - 1 ? 0 : prev + 1,
    );
  const prevSlide = () =>
    setCurrentSlide((prev) =>
      prev === 0 ? bannerGroups.length - 1 : prev - 1,
    );

  const moveSlide = (step: number) => {
    if (step === 1) nextSlide();
    else prevSlide();
  };

  const formatEventLocation = (event: any) => {
    const venueName = event?.venue?.name || event?.venueName || event?.location;
    const cityName = event?.venue?.city || event?.city;

    const parts = [venueName, cityName]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());

    const uniqueParts = Array.from(new Set(parts));
    return uniqueParts.join(", ") || "Đang cập nhật địa điểm";
  };

  return (
    <div className="home-page">
      <nav className="category-nav">
        <div className="container">
          <ul className="category-list">
            <li className="category-item">
              <Link to="/search" className="category-link">
                Tất cả
              </Link>
            </li>
            {categories.length > 0 ? (
              categories.map((cat) => (
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

      <main className="container">
        {/* HERO SECTION */}
        <section className="hero-section">
          <button className="nav-arrow prev" onClick={() => moveSlide(-1)}>
            <ChevronLeft size={24} />
          </button>
          <button className="nav-arrow next" onClick={() => moveSlide(1)}>
            <ChevronRight size={24} />
          </button>

          <div
            className="hero-track"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {bannerGroups.map((group, groupIndex) => (
              <div className="hero-slide-group" key={groupIndex}>
                {group.map((banner) => (
                  <div
                    className="hero-banner-item"
                    key={banner.id}
                    style={{ backgroundImage: `url(${banner.image})` }}
                  >
                    <div className="banner-overlay-content">
                      <span className="banner-tag">{banner.tag}</span>
                      <h2 className="banner-title">{banner.title}</h2>
                      <Link to={banner.link} className="btn btn-primary">
                        {banner.link.includes("event")
                          ? "Mua vé ngay"
                          : "Xem chi tiết"}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* SỰ KIỆN NỔI BẬT */}
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Sự kiện nổi bật tháng này</h3>
            <a href="#" className="view-all">
              Xem tất cả
            </a>
          </div>
          <div className="event-grid">
            {(featuredEvents.length > 0
              ? featuredEvents
              : (mockEvents as any[])
            )
              .slice(0, 4)
              .map((event) => (
                <Link
                  to={`/event/${event.slug || event.id}`}
                  className="poster-card"
                  key={event.id}
                >
                  <img
                    src={event.bannerUrl || event.thumbnailUrl || event.image}
                    alt={event.title}
                  />
                  <div className="overlay">
                    <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>
                      {event.title}
                    </h3>
                    <p
                      style={{ color: "var(--primary-light)", fontWeight: 700 }}
                    >
                      {event.minPrice
                        ? `Từ ${event.minPrice.toLocaleString("vi-VN")} đ`
                        : event.price || "Miễn phí"}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        </section>

        {/* TRENDING */}
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Trending - Top Ranking</h3>
          </div>
          <div className="trending-grid">
            {trendingEvents.map((event) => (
              <div className="trending-card" key={event.rank}>
                <div className="trending-content">
                  <div className="trending-thumb-wrapper">
                    <span className="rank-idx">{event.rank}</span>
                    <img
                      src={event.image}
                      className="trending-thumb"
                      alt={event.title}
                    />
                  </div>
                  <div>
                    <h4 style={{ fontSize: "16px" }}>{event.title}</h4>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <MapPin size={14} className="inline mr-1" />{" "}
                      {event.location}
                    </p>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <Calendar size={14} className="inline mr-1" />{" "}
                      {event.date}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PROMO BANNER */}
        <div
          className="promo-banner"
          style={{
            marginBottom: "24px",
            height: "250px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: "30px",
            textAlign: "center",
            borderRadius: "var(--radius-lg)",
            backgroundImage:
              "url(https://cdn.hstatic.net/files/200000726949/collection/1920x700_e5051cd6e8094895a5645d95b988edc3.png)",
            backgroundSize: "cover",
            color: "white",
          }}
        >
          <div>
            <a
              href="#"
              className="btn btn-primary"
              style={{ marginTop: "20px" }}
            >
              Săn vé ngay
            </a>
          </div>
        </div>

        {/* NHẠC SỐNG */}
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Sự kiện giải trí</h3>
            <a href="#" className="view-all">
              Xem thêm
            </a>
          </div>
          <div className="event-grid">
            {(otherEvents.length > 0 ? otherEvents : (liveMusicEvents as any[]))
              .slice(0, 4)
              .map((event) => (
                <Link
                  to={`/event/${event.slug || event.id}`}
                  className="standard-card"
                  key={event.id}
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div className="thumb-wrapper">
                    <img
                      src={event.thumbnailUrl || event.bannerUrl || event.image}
                      alt={event.title}
                    />
                    <button className="card-heart-btn">
                      <Heart size={18} />
                    </button>
                  </div>
                  <div className="card-content">
                    <h4 className="card-title">{event.title}</h4>
                    <p className="card-meta">
                      <Calendar size={14} className="inline mr-1" />{" "}
                      <span className="card-meta-text">
                        {event.startDatetime
                          ? new Date(event.startDatetime).toLocaleDateString(
                              "vi-VN",
                            )
                          : event.date}
                      </span>
                    </p>
                    <p className="card-meta">
                      <MapPin size={14} className="inline mr-1" />{" "}
                      <span className="card-meta-text">
                        {formatEventLocation(event)}
                      </span>
                    </p>
                    <p className="card-price">
                      {event.minPrice
                        ? `Từ ${event.minPrice.toLocaleString("vi-VN")} đ`
                        : event.price || "Miễn phí"}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        </section>

        {/* AD BANNER */}
        <div className="ad-banner" style={{ marginBottom: "24px" }}>
          <img
            src="https://ticketbox.vn/_next/image?url=https%3A%2F%2Fsalt.tkbcdn.com%2Fts%2Fds%2F8e%2F26%2F03%2F13d8763392c25ed2368b25912c5f7eb9.png&w=1920&q=75"
            alt="Advertiser Banner"
            style={{
              width: "100%",
              borderRadius: "var(--radius-lg)",
              display: "block",
            }}
          />
        </div>

        {/* SÂN KHẤU VÀ NGHỆ THUẬT */}
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Sân khấu và nghệ thuật</h3>
            <a href="#" className="view-all">
              Xem tất cả
            </a>
          </div>
          <div className="event-grid">
            {stageArtsEvents.map((event) => (
              <article className="poster-card" key={event.id}>
                <img src={event.image} alt={event.title} />
                <div className="overlay">
                  <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>
                    {event.title}
                  </h3>
                  <p style={{ color: "var(--primary-light)", fontWeight: 700 }}>
                    {event.price}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* THAM QUAN VÀ TRẢI NGHIỆM */}
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Tham quan và trải nghiệm</h3>
            <a href="#" className="view-all">
              Xem thêm
            </a>
          </div>
          <div className="event-grid">
            {experienceEvents.map((event) => (
              <div
                className="standard-card"
                key={event.id}
                style={{
                  background: "white",
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="thumb-wrapper">
                  <img src={event.image} alt={event.title} />
                  <button className="card-heart-btn">
                    <Heart size={18} />
                  </button>
                </div>
                <div className="card-content">
                  <h4 className="card-title">{event.title}</h4>
                  <p className="card-meta">
                    <Calendar size={14} className="inline mr-1" />{" "}
                    <span className="card-meta-text">{event.date}</span>
                  </p>
                  <p className="card-meta">
                    <MapPin size={14} className="inline mr-1" />{" "}
                    <span className="card-meta-text">{event.location}</span>
                  </p>
                  <p className="card-price">{event.price}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="ad-banner" style={{ marginBottom: "24px" }}>
          <img
            src="https://ticketbox.vn/_next/image?url=https%3A%2F%2Fsalt.tkbcdn.com%2Fts%2Fds%2Fd6%2F68%2F62%2F5d554ece345236b494b311a8396c9106.png&w=1920&q=75"
            alt="Advertiser Banner"
            style={{
              width: "100%",
              borderRadius: "var(--radius-lg)",
              display: "block",
            }}
          />
        </div>
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Workshops cuối tuần</h3>
            <a href="#" className="view-all">
              Xem tất cả
            </a>
          </div>
          <div
            className="event-grid"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            <div
              className="standard-card"
              style={{
                background: "white",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid var(--border)",
                position: "relative", // Added for heart positioning
              }}
            >
              <img
                src="https://tuyetkypowerpoint.com/wp-content/uploads/2025/04/lang-gom-bat-trang.jpg"
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
              <button className="card-heart-btn">
                <Heart size={18} />
              </button>
              <div style={{ padding: "16px", color: "var(--text-primary)" }}>
                <h4>Làm gốm Bát Tràng</h4>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    marginTop: "5px",
                  }}
                >
                  Thứ 7, CN hàng tuần
                </p>
              </div>
            </div>
            <div
              className="standard-card"
              style={{
                background: "white",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid var(--border)",
                position: "relative",
              }}
            >
              <img
                src="https://zestart.vn/wp-content/uploads/2022/05/Workshop-ve-tranh-thu-gian-cuoi-tuan-zest-art-bia-bv-scaled.jpg"
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
              <button className="card-heart-btn">
                <Heart size={18} />
              </button>
              <div style={{ padding: "16px", color: "var(--text-primary)" }}>
                <h4>Vẽ tranh Acrylic</h4>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    marginTop: "5px",
                  }}
                >
                  Chủ nhật, 15 Tháng 10
                </p>
              </div>
            </div>
            <div
              className="standard-card"
              style={{
                background: "white",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid var(--border)",
                position: "relative",
              }}
            >
              <img
                src="https://png.pngtree.com/thumb_back/fw800/background/20251117/pngtree-barista-steaming-coffee-at-cafe-image_20345695.webp"
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
              <button className="card-heart-btn">
                <Heart size={18} />
              </button>
              <div style={{ padding: "16px", color: "var(--text-primary)" }}>
                <h4>Pha chế Coffee</h4>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    marginTop: "5px",
                  }}
                >
                  Thứ 7, 21 Tháng 10
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-gradient-to-r from-[#2dc275] to-[#5ce49b] rounded-3xl p-8 md:p-12 text-white shadow-lg overflow-hidden relative mb-8">
          <div className="absolute -right-20 -top-40 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-black/5 rounded-full blur-2xl"></div>

          <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
                Bạn là nhà tổ chức sự kiện ?
              </h2>
              <p className="text-emerald-50 text-lg mb-8 leading-relaxed">
                Đăng cai sự kiện của bạn trên FlashTicket ngay hôm nay để tiếp
                cận hàng triệu khách hàng tiềm năng. Hệ thống quản lý chuyên
                nghiệp, thanh toán nhanh chóng.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Thiết lập sự kiện trong 5 phút",
                  "Quản lý doanh thu Real-time",
                  "Hỗ trợ check-in bằng QR Code",
                ].map((text, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 font-medium text-emerald-50"
                  >
                    <CheckCircle2 size={20} className="text-white" /> {text}
                  </li>
                ))}
              </ul>
              <button className="bg-white text-[#2dc275] px-8 py-3.5 rounded-full font-bold shadow-md hover:shadow-xl hover:-translate-y-1 transition-all text-lg">
                Tạo Sự Kiện Ngay
              </button>
            </div>
            <div className="hidden md:flex justify-center">
              <img
                src="https://images.careerviet.vn/content/images/nhan-vien-to-chuc-su-kien-careerbuilder1.png"
                alt="Organizer"
                className="rounded-2xl shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500 border-4 border-white/20"
              />
            </div>
          </div>
        </section>
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Khám phá theo địa điểm</h3>
          </div>
          <div className="dest-grid">
            <div className="dest-card">
              <img src="https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=80&w=800" />
              <div className="dest-overlay">TP. Hồ Chí Minh</div>
            </div>
            <div className="dest-card">
              <img src="https://cellphones.com.vn/sforum/wp-content/uploads/2024/01/dia-diem-du-lich-o-ha-noi-1.jpg" />
              <div className="dest-overlay">Hà Nội</div>
            </div>
            <div className="dest-card">
              <img src="https://images.unsplash.com/photo-1557335200-a65f7f032602?q=80&w=800" />
              <div className="dest-overlay">Đà Nẵng</div>
            </div>
          </div>
        </section>
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Đối tác thanh toán</h3>
          </div>
          <div className="partner-grid">
            {paymentPartners.map((partner) => (
              <div
                className="partner-logo"
                key={partner.id}
                style={{
                  backgroundImage: `url(${partner.image})`,
                }}
                title={partner.name}
              ></div>
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <Link
                to="/"
                className="logo"
                style={{ marginBottom: "24px", display: "inline-block" }}
              >
                FlashTicket
              </Link>
              <p style={{ fontSize: "14px", lineHeight: "1.8" }}>
                Hệ thống phân phối vé sự kiện hàng đầu Việt Nam. Nơi bạn tìm
                thấy mọi cảm xúc âm nhạc và nghệ thuật.
              </p>
            </div>
            <div className="footer-col">
              <h4>Về chúng tôi</h4>
              <ul className="footer-links">
                <li>
                  <a href="#">Giới thiệu</a>
                </li>
                <li>
                  <a href="#">Tin tức</a>
                </li>
                <li>
                  <a href="#">Tuyển dụng</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Hỗ trợ</h4>
              <ul className="footer-links">
                <li>
                  <a href="#">Trung tâm trợ giúp</a>
                </li>
                <li>
                  <a href="#">Chính sách bảo mật</a>
                </li>
                <li>
                  <a href="#">Điều khoản sử dụng</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Liên kết</h4>
              <ul className="footer-links">
                <li>
                  <a href="#">Tạo sự kiện</a>
                </li>
                <li>
                  <a href="#">Bán vé</a>
                </li>
                <li>
                  <a href="#">Hợp tác</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Kết nối</h4>
              <div className="social-links" style={{ marginBottom: "24px" }}>
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/500px-Facebook_Logo_%282019%29.png"
                  alt="facebook"
                  width="32"
                />
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/960px-Instagram_logo_2022.svg.png"
                  alt="instagram"
                  width="32"
                />
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo.png"
                  alt="youtube"
                  width="32"
                />
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 FlashTicket. Phát triển bởi Tuyen & Minh.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
