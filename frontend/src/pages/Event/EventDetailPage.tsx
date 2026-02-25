import React, { useState } from "react";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import "../../assets/css/event-ticket.css";

const EventDetailPage = () => {
  const [activeAccordion, setActiveAccordion] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    setActiveAccordion(activeAccordion === index ? null : index);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    // navigate('/booking');
  };

  return (
    <div className="bg-white text-slate-900">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* HERO SECTION */}
        <section className="ticket-hero-container">
          <div className="ticket-stub">
            <div className="ticket-left">
              <div>
                <h1 className="event-title-hero">
                  [The Grand Ho Tram] Stay & Concert: HỒ NGỌC HÀ
                </h1>

                <div className="event-meta-row">
                  <Calendar className="meta-icon" size={24} />
                  <div className="meta-text">
                    <strong>07 tháng 02, 2026</strong>
                    <span>19:30 - 21:00</span>
                  </div>
                </div>

                <div className="event-meta-row">
                  <MapPin className="meta-icon" size={24} />
                  <div className="meta-text">
                    <strong>
                      The Grand Ho Tram (Ấp Hồ Tràm, Xã Hồ Tràm, Thành phố Hồ
                      Chí Minh - mới)
                    </strong>
                    <span>
                      Xa Ho Tram,Thanh Pho Ho Chi Minh, Xã Phước Thuận, Huyện
                      Xuyên Mộc, Tỉnh Bà Rịa - Vũng Tàu
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="ticket-divider"></div>
                <div className="ticket-price-container">
                  <div className="ticket-price-label">Giá vé từ</div>
                  <div className="ticket-price-value">2.500.000 ₫</div>
                </div>
                <button className="btn-buy-ticket" onClick={handleBuyNow}>
                  Mua vé ngay
                </button>
              </div>
            </div>

            <div
              className="ticket-right"
              style={{
                backgroundImage:
                  "url(https://salt.tkbcdn.com/ts/ds/b8/e6/a3/9d3a2c5a55034767ca29d32caa3ac874.jpeg)",
              }}
            ></div>
          </div>
        </section>

        {/* BODY LAYOUT */}
        <div className="event-body-grid grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="main-content lg:col-span-2">
            <div className="content-block">
              <h3 className="block-title">Giới thiệu</h3>
              <div className="description-text">
                <p>
                  ✨ STAY & CONCERT: ĐÁNH THỨC MỌI GIÁC QUAN CÙNG HỒ NGỌC HÀ TẠI
                  THIÊN ĐƯỜNG NGHỈ DƯỠNG ✨ Tháng 2 này, The Grand Ho Tram mời
                  bạn đến với một hành trình cảm xúc trọn vẹn: Nghỉ dưỡng đỉnh
                  cao – Âm nhạc thăng hoa. Một đêm duy nhất để đắm chìm trong
                  những bản Love Songs da diết, và ngay sau đó là sự bùng nổ thị
                  giác cùng Hồ Ngọc Hà và vũ đoàn Hoàng Thông.
                </p>
                <br />
                <p>
                  CHỐT LỊCH HẸN HÒ: ⏰ 19:30 | Thứ Bảy, 07.02.2026 📍 The Grand
                  Ballroom 🎟️ Giá vé ưu đãi: Từ 1.000.000++ VND 👉 Sở hữu tấm vé
                  vàng ngay hôm nay để tận hưởng trải nghiệm thượng lưu!
                  #HoNgocHa #HNH #LiveInConcert #TheGrandHoTram #StayAndConcert
                  #HoTramEvents #HolidayInnHoTram
                </p>
              </div>
            </div>

            <div className="content-block">
              <h3 className="block-title">Lịch trình</h3>
              <div className="schedule-group">
                {/* Session 1 */}
                <div
                  className={`accordion-item ${activeAccordion === 0 ? "active" : ""}`}
                >
                  <div
                    className="accordion-header"
                    onClick={() => toggleAccordion(0)}
                  >
                    <div className="session-info">
                      <ChevronRight className="accordion-arrow" size={20} />
                      <span className="session-time">19:30 - 22:30</span>
                      <span className="session-day-date">
                        Thứ Bảy, 07 Tháng 02, 2026
                      </span>
                    </div>
                    <button className="btn-buy-now" onClick={handleBuyNow}>
                      Mua vé ngay
                    </button>
                  </div>
                  <div className="accordion-content">
                    <h4 className="ticket-info-title">Thông tin vé</h4>
                    <div className="ticket-type-list">
                      <div className="ticket-type-block">
                        <span className="type-name">VÉ VIP</span>
                        <span className="type-price">5.000.000 ₫</span>
                      </div>
                      <div className="ticket-type-block">
                        <span className="type-name">VÉ CƠ BẢN</span>
                        <span className="type-price">3.500.000 ₫</span>
                      </div>
                      <div className="ticket-type-block">
                        <span className="type-name">VÉ TIÊU CHUẨN</span>
                        <span className="type-price">2.500.000 ₫</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session 2 */}
                <div
                  className={`accordion-item ${activeAccordion === 1 ? "active" : ""}`}
                >
                  <div
                    className="accordion-header"
                    onClick={() => toggleAccordion(1)}
                  >
                    <div className="session-info">
                      <ChevronRight className="accordion-arrow" size={20} />
                      <span className="session-time">19:30 - 22:30</span>
                      <span className="session-day-date">
                        Thứ Hai, 09 Tháng 02, 2026
                      </span>
                    </div>
                    <button className="btn-buy-now" onClick={handleBuyNow}>
                      Mua vé ngay
                    </button>
                  </div>
                  <div className="accordion-content">
                    <h4 className="ticket-info-title">Thông tin vé</h4>
                    <div className="ticket-type-list">
                      <div className="ticket-type-block">
                        <span className="type-name">VÉ VIP</span>
                        <span className="type-price">5.000.000 ₫</span>
                      </div>
                      <div className="ticket-type-block">
                        <span className="type-name">VÉ CƠ BẢN</span>
                        <span className="type-price">3.500.000 ₫</span>
                      </div>
                      <div className="ticket-type-block">
                        <span className="type-name">VÉ TIÊU CHUẨN</span>
                        <span className="type-price">2.500.000 ₫</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="content-block">
              <h3 className="block-title">Ban tổ chức</h3>
              <div className="organizer-card">
                <img
                  src="https://salt.tkbcdn.com/ts/ds/51/50/ef/ff96262fcf0e1b448bb8a6994fd41617.jpg"
                  className="org-logo"
                  alt="Organizer"
                />
                <div className="org-info">
                  <div className="org-name">The Grand Ho Tram</div>
                  <div className="org-desc">
                    Đơn vị tổ chức sự kiện hàng đầu
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="sidebar hidden lg:block">
            {/* Sidebar for widgets if any in future */}
          </div>
        </div>

        {/* SUGGESTIONS */}
        <section className="suggestions-section">
          <h3 className="suggestions-title">Có thể bạn cũng thích</h3>
          <div className="suggestion-grid">
            <article className="mini-card">
              <img
                src="https://danangfantasticity.com/wp-content/uploads/2023/04/le-hoi-phao-hoa-quoc-te-da-nang-2023-diff-2023-the-gioai-khong-khoang-canh-tu-02-06-den-08-07-2023-1-scaled.jpg"
                alt="Lễ Hội Pháo Hoa"
              />
              <h4>Lễ Hội Pháo Hoa Đà Nẵng</h4>
              <p className="price-tag">Từ 500.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 01
                tháng 06, 2026
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOCsBdgE-oQR1gT6KGPnGVP1dR3BTHeVXAMw&s"
                alt="Tomorrowland"
              />
              <h4>Tomorrowland Experience</h4>
              <p className="price-tag">Từ 1.200.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 15
                tháng 07, 2026
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://danangfantasticity.com/wp-content/uploads/2018/03/nhieu-ky-luc-xac-lap-trong-show-thuc-canh-ky-uc-hoi-an-01.jpg"
                alt="Ký Ức Hội An"
              />
              <h4>Ký Ức Hội An</h4>
              <p className="price-tag">Từ 600.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> Hằng
                đêm (Trừ thứ 3)
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYNc3938G5TVbuEjLO6u1cOiw_3DOi4I75Nw&s"
                alt="Westlife"
              />
              <h4>Westlife - Wild Dreams</h4>
              <p className="price-tag">Từ 850.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 21
                tháng 11, 2026
              </p>
            </article>

            <article className="mini-card">
              <img
                src="https://i.ytimg.com/vi/nxs0RHpT_Hg/maxresdefault.jpg"
                alt="BlackPink"
              />
              <h4>BlackPink - Born Pink</h4>
              <p className="price-tag">Từ 1.500.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 29
                tháng 07, 2026
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://i.pinimg.com/736x/f3/e2/40/f3e2401a9117da5202a2203162389fc4.jpg"
                alt="EDM Festival"
              />
              <h4>EDM Music Festival</h4>
              <p className="price-tag">Từ 450.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 10
                tháng 08, 2026
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://shoreclubvietnam.com/wp-content/uploads/2025/03/Neon-Waves-Luma-Paint-Party-on-An-Bang-Beach-Banner.jpg"
                alt="Indie Glow"
              />
              <h4>Indie Glow Night</h4>
              <p className="price-tag">Từ 200.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 05
                tháng 09, 2026
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQllzgEpU1iwPiCSJt_qNKYd8PAnCN_VqqtJg&s"
                alt="Jazz Wine"
              />
              <h4>Jazz & Wine Night</h4>
              <p className="price-tag">Từ 750.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 12
                tháng 10, 2026
              </p>
            </article>
          </div>

          <div className="middle-promo-banner flex justify-center">
            <img
              src="https://ticketbox.vn/_next/image?url=https%3A%2F%2Fsalt.tkbcdn.com%2Fts%2Fds%2F2b%2Fb5%2F4f%2F19985a7e64e8f3426c7a74dc67a76aeb.png&w=1920&q=75"
              alt="Promotion"
            />
          </div>

          <div className="suggestion-grid mt-8">
            <article className="mini-card">
              <img
                src="https://static2.vieon.vn/vieplay-image/thumbnail_big_v4/2023/10/19/c9hxtqrq_new-banner_1267_712.jpg"
                alt="Rap Viet"
              />
              <h4>Rap Việt All-Star Concert</h4>
              <p className="price-tag">Từ 800.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 15
                tháng 12, 2026
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2023/03/15/9CA438.jpg"
                alt="Uyen Linh"
              />
              <h4>Lululola Show: Uyên Linh</h4>
              <p className="price-tag">Từ 500.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 20
                tháng 11, 2026
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://cdn.popsww.com/blog/sites/2/2022/03/show-my-tam.jpg"
                alt="Dear My Soul"
              />
              <h4>Dear My Soul - Nhạc Trịnh</h4>
              <p className="price-tag">Từ 400.000 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 05
                tháng 12, 2026
              </p>
            </article>
            <article className="mini-card">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcToURTHY2TGw1tk3fTEmACrFqNZYqi3yQUBgQ&s"
                alt="Countdown"
              />
              <h4>Countdown 2026 Party</h4>
              <p className="price-tag">Từ 0 ₫</p>
              <p className="time-tag">
                <Calendar size={16} className="mr-1 text-emerald-500" /> 31
                tháng 12, 2026
              </p>
            </article>
          </div>

          <div className="view-more-container">
            <button className="btn-view-more">Xem thêm sự kiện</button>
          </div>
        </section>
      </div>

      <footer
        className="dark-footer"
        style={{
          marginTop: "60px",
          padding: "40px 0",
          background: "#1c1c1e",
          borderTop: "1px solid #333",
          textAlign: "center",
          color: "#666",
          fontSize: "14px",
        }}
      >
        <div className="container mx-auto">
          © 2026 FlashTicket Corporation. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default EventDetailPage;
