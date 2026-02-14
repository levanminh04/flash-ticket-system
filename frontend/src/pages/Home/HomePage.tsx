import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Music,
  Trophy,
  MonitorPlay,
  Ticket,
  Star,
  MapPin,
  Calendar,
  Heart,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

const categories = [
  { id: 1, name: "Nhạc sống", icon: null },
  { id: 2, name: "Sân khấu và Nghệ thuật", icon: null },
  { id: 3, name: "Thể Thao", icon: null },
  { id: 4, name: "Hội thảo và Workshop", icon: null },
  { id: 5, name: "Tham quan và Trải nghiệm", icon: null },
  { id: 6, name: "Khác", icon: null },
  { id: 7, name: "Vé bán lại", icon: null },
];

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
      image:
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000",
      title: "Tomorrowland Experience",
      tag: "EDM",
      link: "#",
    },
    {
      id: 4,
      image:
        "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1000",
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
    price: "Từ 700.000 đ",
  },
  {
    id: "lm-2",
    title: "MINISHOW Tăng Phúc: Mã Đáo Thành Công",
    image:
      "https://salt.tkbcdn.com/ts/ds/e6/53/6b/444309056055b331f4fffd2e94dccdb7.jpeg",
    date: "20 tháng 02, 2026",
    price: "Từ 1.500.000 đ",
  },
  {
    id: "lm-3",
    title: "Trung Quân - Chiều Nay Không Có Mưa Bay",
    image: "https://i.ytimg.com/vi/y2mgM-BSong/maxresdefault.jpg",
    date: "21 tháng 02, 2026",
    price: "Từ 800.000 đ",
  },
  {
    id: "lm-4",
    title: "Ca Sĩ Hiền Hồ + Khách Mời Anh Khang",
    image:
      "https://salt.tkbcdn.com/ts/ds/4f/0e/a3/9be7c56aab7635f612fe4f72627d6eeb.png",
    date: "28 tháng 02, 2026",
    price: "Từ 800.000 đ",
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

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-play cho slider
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) =>
        prev === bannerGroups.length - 1 ? 0 : prev + 1,
      );
    }, 5000);
    return () => clearInterval(timer);
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

  return (
    <>
      <nav className="category-nav">
        <div className="container">
          <ul className="category-list">
            {categories.map((cat) => (
              <li className="category-item" key={cat.id}>
                <a href="#" className="category-link">
                  {cat.name}
                </a>
              </li>
            ))}
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
            {mockEvents.map((event) => (
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
            <h3 className="section-title">Nhạc sống</h3>
            <a href="#" className="view-all">
              Xem thêm <ArrowRight className="inline" size={16} />
            </a>
          </div>
          <div className="event-grid">
            {liveMusicEvents.map((event) => (
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
                </div>
                <div className="card-content">
                  <h4 className="card-title">{event.title}</h4>
                  <p className="card-meta">
                    <Calendar size={14} className="inline mr-1" /> {event.date}
                  </p>
                  <p className="card-price">{event.price}</p>
                </div>
              </div>
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

        {/* WORKSHOPS */}
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Workshops Cuối Tuần</h3>
            <a href="#" className="view-all">
              Xem tất cả <ArrowRight className="inline" size={16} />
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
              }}
            >
              <img
                src="https://tuyetkypowerpoint.com/wp-content/uploads/2025/04/lang-gom-bat-trang.jpg"
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
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
              }}
            >
              <img
                src="https://zestart.vn/wp-content/uploads/2022/05/Workshop-ve-tranh-thu-gian-cuoi-tuan-zest-art-bia-bv-scaled.jpg"
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
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
              }}
            >
              <img
                src="https://png.pngtree.com/thumb_back/fw800/background/20251117/pngtree-barista-steaming-coffee-at-cafe-image_20345695.webp"
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
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

        {/* DESTINATIONS (Simplified) */}
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">Khám phá theo địa điểm</h3>
          </div>
          <div className="dest-grid">
            <div className="dest-card">
              <img src="https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=80&w=800" />
              <div className="dest-overlay">TP. HỒ CHÍ MINH</div>
            </div>
            <div className="dest-card">
              <img src="https://images.unsplash.com/photo-1599587401326-40742d4a297e?q=80&w=800" />
              <div className="dest-overlay">HÀ NỘI</div>
            </div>
            <div className="dest-card">
              <img src="https://images.unsplash.com/photo-1557335200-a65f7f032602?q=80&w=800" />
              <div className="dest-overlay">ĐÀ NẴNG</div>
            </div>
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
                style={{ marginBottom: "16px", display: "inline-flex" }}
              >
                FlashTicket
              </Link>
              <p style={{ lineHeight: "1.6" }}>
                Nền tảng đặt vé trực tuyến hàng đầu Việt Nam. Nhanh chóng, an
                toàn, tiện lợi.
              </p>
            </div>
            <div className="footer-col">
              <h4>Về Chúng Tôi</h4>
              <ul className="footer-links">
                <li>
                  <a href="#">Giới thiệu</a>
                </li>
                <li>
                  <a href="#">Tuyển dụng</a>
                </li>
                <li>
                  <a href="#">Liên hệ</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Hỗ Trợ</h4>
              <ul className="footer-links">
                <li>
                  <a href="#">Trung tâm trợ giúp</a>
                </li>
                <li>
                  <a href="#">Quy định sử dụng</a>
                </li>
                <li>
                  <a href="#">Chính sách bảo mật</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Sự Kiện</h4>
              <ul className="footer-links">
                <li>
                  <a href="#">Nhạc Sống</a>
                </li>
                <li>
                  <a href="#">Sân Khấu</a>
                </li>
                <li>
                  <a href="#">Thể Thao</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Kết Nối</h4>
              <div className="social-links">
                <i className="ph-fill ph-facebook-logo"></i>
                <i className="ph-fill ph-instagram-logo"></i>
                <i className="ph-fill ph-youtube-logo"></i>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 FlashTicket. All rights reserved.</p>
            <p>Designed by Tuyen & Minh</p>
          </div>
        </div>
      </footer>
    </>
  );
}
