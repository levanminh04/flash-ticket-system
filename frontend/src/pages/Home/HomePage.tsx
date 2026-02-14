import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Music, Trophy, MonitorPlay, Ticket, Star, 
  MapPin, Calendar, Heart, ArrowRight, 
  ChevronLeft, ChevronRight, CheckCircle2, ShieldCheck 
} from 'lucide-react';
const categories = [
  { id: 1, name: 'Nhạc Sống', icon: <Music size={24} /> },
  { id: 2, name: 'Sân Khấu', icon: <Star size={24} /> },
  { id: 3, name: 'Thể Thao', icon: <Trophy size={24} /> },
  { id: 4, name: 'Hội Thảo', icon: <MonitorPlay size={24} /> },
  { id: 5, name: 'Khóa Học', icon: <Ticket size={24} /> },
];

const bannerGroups = [
  [
    {
      id: 1,
      image: "https://cdn-media.sforum.vn/storage/app/media/ctv_seo10/anh-trai-vuot-ngan-chong-gai-thumb.jpg",
      title: "Anh Trai Vượt Ngàn Chông Gai",
      date: "15 Thg 8, 2026",
      tag: "SẮP DIỄN RA"
    },
    {
      id: 2,
      image: "https://upload.wikimedia.org/wikipedia/vi/thumb/b/b4/SISTERS_WHO_MAKE_WAVES_VIETNAM_%E2%80%93_Season_2_Logo.jpg/330px-SISTERS_WHO_MAKE_WAVES_VIETNAM_%E2%80%93_Season_2_Logo.jpg",
      title: "Chị Đẹp Đạp Gió Rẽ Sóng",
      date: "20 Thg 8, 2026",
      tag: "HOT"
    }
  ],
  [
    {
      id: 3,
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6kBHsah0_ZFU29kIKU9GU3SiHb-GOwVJUiw&s",
      title: "Lễ Hội Âm Nhạc Gió Mùa",
      date: "02 Thg 9, 2026",
      tag: "MỞ BÁN SỚM"
    },
    {
      id: 4,
      image: "https://www.artsdepot.co.uk/wp-content/uploads/2025/07/TOTE-Poster-NEW.jpg",
      title: "The Eras Tour - Tribute",
      date: "10 Thg 9, 2026",
      tag: "CHÁY VÉ"
    }
  ]
];

const mockEvents = [
  {
    id: 'evt-1',
    title: 'Show Âm Nhạc: Hoàng Hôn Trên Biển',
    image: 'https://i.ytimg.com/vi/OCNE14t-EMo/maxresdefault.jpg',
    date: '19:00 - 25/10/2026',
    location: 'Bãi biển Vũng Tàu',
    price: '500.000đ',
    organizer: 'Sunsets Events',
    category: 'Nhạc Sống'
  },
  {
    id: 'evt-2',
    title: 'Giải Đấu eSports: Liên Minh Huyền Thoại',
    image: 'https://cellphones.com.vn/sforum/wp-content/uploads/2023/02/giai-vlu-1.jpg',
    date: '08:00 - 12/11/2026',
    location: 'Nhà thi đấu Quân Khu 7',
    price: '200.000đ',
    organizer: 'VNG Games',
    category: 'Thể Thao'
  },
  {
    id: 'evt-3',
    title: 'Hội Thảo: AI & Tương Lai Lập Trình',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTyndnxpGi7rXDVbSWiMXoUyOm8nlzgG4bWvA&s',
    date: '09:00 - 05/12/2026',
    location: 'Trung tâm Hội nghị Quốc gia',
    price: 'Miễn phí',
    organizer: 'TechTalk VN',
    category: 'Hội Thảo'
  },
  {
    id: 'evt-4',
    title: 'Vở Kịch: Bí Mật Đêm Chủ Nhật',
    image: 'https://upload.wikimedia.org/wikipedia/vi/b/b5/C%E1%BA%A3nh_t%E1%BB%B1a_%C4%91%E1%BB%81_c%E1%BB%A7a_B%C3%AD_m%E1%BA%ADt_%C4%91%C3%AAm_ch%E1%BB%A7_nh%E1%BA%ADt.jpeg',
    date: '20:00 - 20/12/2026',
    location: 'Nhà hát Kịch Hà Nội',
    price: '350.000đ',
    organizer: 'Nhà Hát Tuổi Trẻ',
    category: 'Sân Khấu'
  }
];

// Component Card Sự kiện dùng chung
const EventCard = ({ event }: { event: any }) => (
  <Link to={`/event/${event.id}`} className="bg-white rounded-2xl shadow-sm hover:shadow-lg border border-slate-200 transition-all duration-300 overflow-hidden flex flex-col group">
    <div className="relative aspect-[4/3] overflow-hidden">
      <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-800 uppercase tracking-wide shadow-sm">
        {event.category}
      </span>
      <button className="absolute top-3 right-3 w-8 h-8 bg-white/95 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white transition-colors shadow-sm" onClick={(e) => e.preventDefault()}>
        <Heart size={16} />
      </button>
    </div>
    
    <div className="p-4 flex flex-col flex-1">
      <div className="flex items-center gap-2 text-sm text-[#2dc275] font-semibold mb-2">
        <Calendar size={16} />
        <span>{event.date}</span>
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-[#2dc275] transition-colors">
        {event.title}
      </h3>
      <div className="flex items-start gap-2 text-sm text-slate-500 mb-4 mt-auto">
        <MapPin size={16} className="mt-0.5 shrink-0" />
        <span className="line-clamp-2">{event.location}</span>
      </div>
      
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
            {event.organizer.charAt(0)}
          </div>
          <span className="text-xs text-slate-500 max-w-[80px] truncate">{event.organizer}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500">Từ</span>
          <span className="text-lg font-bold text-[#2dc275]">{event.price}</span>
        </div>
      </div>
    </div>
  </Link>
);

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-play cho slider
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === bannerGroups.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide(prev => (prev === bannerGroups.length - 1 ? 0 : prev + 1));
  const prevSlide = () => setCurrentSlide(prev => (prev === 0 ? bannerGroups.length - 1 : prev - 1));

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      
      {/* 1. THANH ĐIỀU HƯỚNG DANH MỤC (Dính dưới Navbar chính) */}
      <nav className="bg-white border-b border-slate-200 sticky top-16 z-40 shadow-sm hidden md:block">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex justify-center gap-12 py-3 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <li key={cat.id}>
                <a href="#" className="flex flex-col items-center gap-2 text-slate-600 hover:text-[#2dc275] transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-[#e6f8ee] group-hover:border-[#2dc275]/30 transition-colors">
                    {cat.icon}
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">{cat.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* NỘI DUNG CHÍNH */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* 2. HERO CAROUSEL (Slider 2 ảnh/slide) */}
        <section className="relative rounded-2xl overflow-hidden group">
          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {bannerGroups.map((group, index) => (
                <div key={index} className="min-w-full flex gap-4 px-1">
                  {group.map((banner) => (
                    <div key={banner.id} className="relative flex-1 aspect-[21/9] rounded-2xl overflow-hidden cursor-pointer shadow-sm">
                      <img src={banner.image} alt={banner.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                        <span className="bg-[#2dc275] text-white text-xs font-bold px-3 py-1 rounded-full w-max mb-3 uppercase tracking-wide">
                          {banner.tag}
                        </span>
                        <h2 className="text-white text-2xl md:text-3xl font-bold mb-2 drop-shadow-md">{banner.title}</h2>
                        <p className="text-slate-200 font-medium flex items-center gap-2"><Calendar size={16} /> {banner.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          
          {/* Nút điều khiển Slider */}
          <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 hover:bg-white backdrop-blur rounded-full flex items-center justify-center text-slate-800 shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10">
            <ChevronLeft size={24} />
          </button>
          <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 hover:bg-white backdrop-blur rounded-full flex items-center justify-center text-slate-800 shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10">
            <ChevronRight size={24} />
          </button>
        </section>

        {/* 3. SỰ KIỆN NỔI BẬT */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sự Kiện Nổi Bật <span className="text-xl">🔥</span></h2>
            <Link to="/events" className="text-[#2dc275] font-semibold hover:text-[#1e8a52] flex items-center gap-1 transition-colors">
              Xem tất cả <ArrowRight size={18} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {mockEvents.map(event => <EventCard key={event.id} event={event} />)}
          </div>
        </section>

        {/* 4. SỰ KIỆN SẮP DIỄN RA */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sắp Diễn Ra <span className="text-xl">⏰</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Đảo ngược mảng để nhìn cho khác biệt một chút */}
            {[...mockEvents].reverse().map(event => <EventCard key={event.id + '-upcoming'} event={event} />)}
          </div>
        </section>

        {/* 5. CALL TO ACTION (ĐĂNG CAI SỰ KIỆN) */}
        <section className="bg-gradient-to-r from-[#2dc275] to-[#5ce49b] rounded-3xl p-8 md:p-12 text-white shadow-lg overflow-hidden relative">
          {/* Họa tiết nền */}
          <div className="absolute -right-20 -top-40 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-black/5 rounded-full blur-2xl"></div>

          <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Bạn là nhà tổ chức sự kiện?</h2>
              <p className="text-emerald-50 text-lg mb-8 leading-relaxed">
                Đăng cai sự kiện của bạn trên FlashTicket ngay hôm nay để tiếp cận hàng triệu khách hàng tiềm năng. Hệ thống quản lý chuyên nghiệp, thanh toán nhanh chóng.
              </p>
              <ul className="space-y-3 mb-8">
                {['Thiết lập sự kiện trong 5 phút', 'Quản lý doanh thu Real-time', 'Hỗ trợ check-in bằng QR Code'].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 font-medium text-emerald-50">
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
                src="https://images.unsplash.com/photo-1551818255-e6e10975bc17?auto=format&fit=crop&w=600&q=80" 
                alt="Organizer" 
                className="rounded-2xl shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500 border-4 border-white/20"
              />
            </div>
          </div>
        </section>
      </main>

      {/* 6. FOOTER (Tích hợp từ index.html) */}
      <footer className="bg-[#0f172a] pt-16 pb-8 border-t-4 border-[#2dc275]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <Link to="/" className="flex items-center gap-2 text-white font-bold text-3xl mb-6">
                <Ticket size={32} className="text-[#2dc275]" />
                <span>FlashTicket</span>
              </Link>
              <p className="text-slate-400 leading-relaxed mb-6">
                Nền tảng phân phối vé sự kiện hàng đầu Việt Nam. Nhanh chóng, an toàn và minh bạch.
              </p>
              <div className="flex items-center gap-3 text-slate-400">
                <ShieldCheck className="text-[#2dc275]" /> <span>Bảo mật thanh toán 100%</span>
              </div>
            </div>
            
            <div>
              <h3 className="text-white font-bold text-lg mb-6">Khám Phá</h3>
              <ul className="space-y-4">
                {['Nhạc Sống', 'Sân Khấu & Nghệ Thuật', 'Thể Thao', 'Hội Thảo', 'Khóa Học'].map(item => (
                  <li key={item}><a href="#" className="text-slate-400 hover:text-[#2dc275] transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-white font-bold text-lg mb-6">Về Chúng Tôi</h3>
              <ul className="space-y-4">
                {['Về FlashTicket', 'Quy chế hoạt động', 'Chính sách bảo mật', 'Quy định đổi trả', 'Câu hỏi thường gặp'].map(item => (
                  <li key={item}><a href="#" className="text-slate-400 hover:text-[#2dc275] transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-white font-bold text-lg mb-6">Tải Ứng Dụng</h3>
              <p className="text-slate-400 mb-4">Sắp ra mắt trên nền tảng di động</p>
              <div className="flex flex-col gap-3">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play" className="h-10 cursor-pointer opacity-50 grayscale" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-10 cursor-pointer opacity-50 grayscale" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500">© 2026 FlashTicket. Phát triển bởi Tuyen & Minh.</p>
            <div className="flex items-center gap-4">
              <img src="https://images.dmca.com/Badges/dmca_protected_sml_120n.png?ID=ed1a26d7-1a06-4b8c-8f1d-2b4e9b706533" alt="DMCA" className="h-8" />
              <img src="https://webmedia.com.vn/images/2021/09/logo-da-thong-bao-bo-cong-thuong-mau-xanh.png" alt="Bo Cong Thuong" className="h-8" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}