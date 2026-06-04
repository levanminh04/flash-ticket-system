import { useEffect, useState, useRef, useMemo } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { FaMusic } from "react-icons/fa6";
import { FaMapMarkedAlt } from "react-icons/fa";
import { AiFillPicture } from "react-icons/ai";
import { GrWorkshop } from "react-icons/gr";
import {
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Headset,
  LayoutDashboard,
  MapPin,
  Minus,
  MessageSquareText,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Tickets,
  Wallet,
  Type,
  FolderTree,
  ArrowUpDown,
  Image,
  Undo2,
  Save,
  Settings,
  HelpCircle,
  BookOpen,
  X,
} from "lucide-react";
import { eventService } from "../../services/eventService";
import { categoryService } from "../../services/categoryService";
import { venueService } from "../../services/venueService";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";
import Blog from "../../components/common/Blog";
import Footer from "../../components/common/Footer";
import { Category, EventSummary, Venue } from "../../types/api";
import { partnerLogos } from "../../constants/partners";
import { hasAnyRealmRole } from "../../lib/auth";

type EditableHeroEvent = Partial<EventSummary> & {
  id?: string | number;
  slug?: string;
  title?: string;
  bannerUrl?: string;
  venueName?: string;
  city?: string;
};

type HeroEventOverrides = Record<
  string,
  Pick<EditableHeroEvent, "title" | "bannerUrl" | "venueName" | "city">
>;

type HomeSectionKey =
  | "trust"
  | "features"
  | "categories"
  | "upcoming"
  | "venues"
  | "how"
  | "pricing"
  | "past"
  | "faq"
  | "blog";

type HomeContentConfig = {
  heroTitle: string;
  trustTitle: string;
  featuresTitle: string;
  upcomingTitle: string;
  venuesTitle: string;
  howTitle: string;
  pricingTitle: string;
  pastTitle: string;
  faqTitle: string;
  blogTitle: string;
  sectionOrder: HomeSectionKey[];
  titleColors: Record<string, string>;
  categoryOverrides: Record<string, { name: string; order: number; color?: string }>;
};

type CategoryEventSection = {
  category: Category;
  events: EventSummary[];
};

type HomeVenueDestination = {
  title: string;
  to: string;
  images: string[];
};

const HOME_HERO_OVERRIDES_KEY = "flashTicket.homeHeroOverrides";
const HOME_CONTENT_CONFIG_KEY = "flashTicket.homeContentConfig";
const EVENT_MEDIA_CANDIDATE_LIMIT = 20;
const HOME_CATEGORY_BANNER_URL =
  "https://i.ibb.co/tMB8JFfL/60f019b6-5f02-4ae0-8754-963c8785c246.png";
const categoryTitleIcons = [FaMusic, GrWorkshop, AiFillPicture];

const homeSectionLabelKeys: Record<HomeSectionKey, string> = {
  trust: "home.sections.trust",
  categories: "home.sections.categories",
  features: "home.sections.features",
  upcoming: "home.sections.upcoming",
  venues: "home.sections.venues",
  how: "home.sections.how",
  pricing: "home.sections.pricing",
  past: "home.sections.past",
  faq: "home.sections.faq",
  blog: "home.sections.blog",
};

const getDefaultHomeContentConfig = (language: string): HomeContentConfig => {
  const isEnglish = language === "en";
  return {
  heroTitle: isEnglish ? "Easy to Buy &\nSell your Event\nTicket" : "Dễ dàng mua và\nbán vé sự kiện\ncủa bạn",
  trustTitle: isEnglish ? "More than 100+ businesses owners across the world trust FlashTicket" : "Hơn 100+ nhà tổ chức tin dùng FlashTicket",
  featuresTitle: isEnglish ? "Our Core Features" : "Tính năng nổi bật",
  upcomingTitle: isEnglish ? "Upcoming Events" : "Sự kiện sắp diễn ra",
  venuesTitle: isEnglish ? "Interesting Venues" : "Điểm đến thú vị",
  howTitle: isEnglish ? "How it works" : "Cách hoạt động",
  pricingTitle: isEnglish ? "Transparent Pricing" : "Chi phí minh bạch",
  pastTitle: isEnglish ? "Some of our Past Events" : "Một số sự kiện đã diễn ra",
  faqTitle: isEnglish ? "Important FAQs for Event & Ticket" : "Câu hỏi thường gặp về sự kiện và vé",
  blogTitle: isEnglish ? "Our latest Blog" : "Bài viết mới nhất",
  sectionOrder: [
    "trust",
    "categories",
    "features",
    "upcoming",
    "venues",
    "how",
    "pricing",
    "past",
    "faq",
    "blog",
  ],
  titleColors: {},
  categoryOverrides: {},
  };
};

const defaultHomeContentConfig = getDefaultHomeContentConfig("vi");

const fallbackHeroEvents: EditableHeroEvent[] = [
  {
    id: "hero-1",
    slug: "ravolution-music-festival-2026",
    title: "Ravolution Music Festival 2026",
    startDatetime: "2026-06-15T19:30:00",
    venueName: "The Global City",
    city: "TP. Hồ Chí Minh",
    shortDescription:
      "Đêm nhạc điện tử quy mô lớn với line-up quốc tế và trải nghiệm sân khấu nhập vai.",
    bannerUrl:
      "https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2023/11/16/247724.jpg",
    minPrice: 950000,
  },
  {
    id: "hero-2",
    slug: "ha-anh-tuan-chan-troi-ruc-ro",
    title: "Hà Anh Tuấn - Chân Trời Rực Rỡ",
    startDatetime: "2026-07-21T20:00:00",
    venueName: "Nhà hát Hòa Bình",
    city: "TP. Hồ Chí Minh",
    shortDescription:
      "Đêm diễn live concert với trải nghiệm chỗ ngồi đẹp, thanh toán nhanh và nhận vé tức thì.",
    bannerUrl:
      "https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2022/12/23/450B75.jpg",
    minPrice: 1200000,
  },
  {
    id: "hero-3",
    slug: "tomorrowland-experience",
    title: "Tomorrowland Experience",
    startDatetime: "2026-08-09T18:00:00",
    venueName: "Saigon Exhibition Hall",
    city: "TP. Hồ Chí Minh",
    shortDescription:
      "Không gian festival kết hợp visual art, activation zone và trải nghiệm check-in theo thời gian thực.",
    bannerUrl: "https://i.ytimg.com/vi/BG26iYVppy8/maxresdefault.jpg",
    minPrice: 1500000,
  },
];
const featureCards = [
  {
    icon: ShoppingCart,
    titleKey: "home.features.easyPurchase.title",
    descriptionKey: "home.features.easyPurchase.description",
  },
  {
    icon: Tickets,
    titleKey: "home.features.instantDelivery.title",
    descriptionKey: "home.features.instantDelivery.description",
  },
  {
    icon: ShieldCheck,
    titleKey: "home.features.securePayments.title",
    descriptionKey: "home.features.securePayments.description",
  },
  {
    icon: LayoutDashboard,
    titleKey: "home.features.dashboard.title",
    descriptionKey: "home.features.dashboard.description",
  },
  {
    icon: MessageSquareText,
    titleKey: "home.features.eventInfo.title",
    descriptionKey: "home.features.eventInfo.description",
  },
  {
    icon: Headset,
    titleKey: "home.features.support.title",
    descriptionKey: "home.features.support.description",
  },
];

const howItWorks = [
  {
    step: "01",
    titleKey: "home.how.openEvent.title",
    descriptionKey: "home.how.openEvent.description",
    image:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1200&auto=format&fit=crop",
  },
  {
    step: "02",
    titleKey: "home.how.chooseTicket.title",
    descriptionKey: "home.how.chooseTicket.description",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
  },
  {
    step: "03",
    titleKey: "home.how.payment.title",
    descriptionKey: "home.how.payment.description",
    image: "https://images.pexels.com/photos/7191166/pexels-photo-7191166.jpeg",
  },
];

const pastEventGallery = [
  "https://thumbs.dreamstime.com/b/sydney-australia-february-taylor-swift-promotional-banner-eras-tour-building-facade-striking-monochrome-shot-captures-308589240.jpg",
  "https://static.vecteezy.com/system/resources/previews/008/041/545/non_2x/fireworks-festival-poster-free-vector.jpg",
  "https://assets.isu.pub/document-structure/240726102139-d62f2aa1efadcb2998ae62f494fbf40e/v1/29338e0e7df2a000594afe0a03f17550.jpeg",
  "https://hoianmemoriesland.com/public/media//cv1.jpg",
  "https://i.scdn.co/image/ab67616d00001e02bca435448e93887771358103",
  "https://cdn2.tuoitre.vn/471584752817336320/data/teen360/pictures/2020/12/16/1608055329_poster-s-n-t-ng.jpg",
  "https://cdn2.tuoitre.vn/thumb_w/480/471584752817336320/2025/7/18/ha-anh-tuan-1752807552879793430941.jpg",
  "https://cdn3.ivivu.com/2023/12/tri%E1%BB%83n-l%C3%A3m-Van-Gogh-ivivu.jpg",
];

const venueCityFallbackImages: Record<string, string> = {
  "tp. hồ chí minh":
    "https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=80&w=1200&auto=format&fit=crop",
  "hồ chí minh":
    "https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=80&w=1200&auto=format&fit=crop",
  "ha noi":
    "https://images.unsplash.com/photo-1609167830220-7164aa360951?q=80&w=1200&auto=format&fit=crop",
  "hà nội":
    "https://images.unsplash.com/photo-1609167830220-7164aa360951?q=80&w=1200&auto=format&fit=crop",
  "đà lạt":
    "https://images.unsplash.com/photo-1559670978-1332cb79b449?q=80&w=1200&auto=format&fit=crop",
  "da lat":
    "https://images.unsplash.com/photo-1559670978-1332cb79b449?q=80&w=1200&auto=format&fit=crop",
};

const defaultVenueFallbackImage =
  "https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=1200&auto=format&fit=crop";
const otherVenueFallbackImages = [
  "https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1528181304800-259b08848526?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1563492065599-3520f775eeed?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=800&auto=format&fit=crop",
];

const faqItems = [
  {
    questionKey: "home.faq.buy.question",
    answerKey: "home.faq.buy.answer",
  },
  {
    questionKey: "home.faq.refund.question",
    answerKey: "home.faq.refund.answer",
  },
  {
    questionKey: "home.faq.organizer.question",
    answerKey: "home.faq.organizer.answer",
  },
  {
    questionKey: "home.faq.pricing.question",
    answerKey: "home.faq.pricing.answer",
  },
  {
    questionKey: "home.faq.transfer.question",
    answerKey: "home.faq.transfer.answer",
  },
];

const homeNavItems = [
  { labelKey: "nav.home", to: "#home-hero", isHash: true },
  { labelKey: "nav.events", to: "/search" },
  { labelKey: "home.nav.about", to: "#home-features", isHash: true },
  { labelKey: "home.sections.blog", to: "#home-blog", isHash: true },
  { labelKey: "home.nav.pages", to: "#home-faq", isHash: true },
];

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

function formatDate(value?: string) {
  if (!value) return "Đang cập nhật";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCategoryEventDate(value?: string) {
  if (!value) return "Đang cập nhật";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const day = parsed.toLocaleDateString("vi-VN", { day: "2-digit" });
  const month = parsed.toLocaleDateString("vi-VN", { month: "2-digit" });
  const year = parsed.getFullYear();

  return `${day} tháng ${month}, ${year}`;
}

function formatPrice(event?: Partial<EventSummary>) {
  const minPrice =
    typeof event?.minPrice === "number"
      ? event.minPrice
      : typeof event?.minPrice === "string"
        ? Number(event.minPrice)
        : undefined;

  if (typeof minPrice === "number" && Number.isFinite(minPrice)) {
    return `Từ ${minPrice.toLocaleString("vi-VN")} đ`;
  }
  return "Đang cập nhật";
}

function getEventImage(event?: Partial<EventSummary>) {
  return (
    event?.bannerUrl ||
    event?.thumbnailUrl ||
    event?.images?.find((image) => image.type === "BANNER")?.url ||
    event?.images?.find((image) => image.type === "THUMBNAIL")?.url ||
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1400&auto=format&fit=crop"
  );
}

function getEventStartTime(event: Partial<EventSummary>) {
  const parsed = new Date(
    event.schedule?.startDatetime || event.startDatetime || "",
  );
  return Number.isNaN(parsed.getTime())
    ? Number.MAX_SAFE_INTEGER
    : parsed.getTime();
}

function hasEventImageType(event: Partial<EventSummary>, type: string) {
  return Boolean(
    event.images?.some(
      (image) =>
        image.type?.toUpperCase() === type &&
        typeof image.url === "string" &&
        image.url.trim().length > 0,
    ),
  );
}

function hasPosterAndBanner(event: Partial<EventSummary>) {
  return hasEventImageType(event, "POSTER") && hasEventImageType(event, "BANNER");
}

function hasSummaryImage(event: Partial<EventSummary>) {
  return Boolean(
    event.bannerUrl ||
      event.thumbnailUrl ||
      event.images?.some(
        (image) =>
          typeof image.url === "string" && image.url.trim().length > 0,
      ),
  );
}

function getNearestEventsWithPosterAndBanner(
  events: EventSummary[],
  limit: number,
  direction: "asc" | "desc" = "asc",
) {
  const sortByStartTime = (left: EventSummary, right: EventSummary) =>
    direction === "asc"
      ? getEventStartTime(left) - getEventStartTime(right)
      : getEventStartTime(right) - getEventStartTime(left);

  const sortedEvents = [...events].sort(
    sortByStartTime,
  );
  const eventsWithRequiredMedia = sortedEvents.filter(hasPosterAndBanner);

  return (eventsWithRequiredMedia.length > 0
    ? eventsWithRequiredMedia
    : sortedEvents.filter(hasSummaryImage)
  ).slice(0, limit);
}

function normalizeVenueCity(city?: string) {
  return city?.trim() || "Vị trí khác";
}

function getVenueImageUrls(venues: Venue[], city: string) {
  const fallbackImage =
    venueCityFallbackImages[city.toLowerCase()] || defaultVenueFallbackImage;
  const images = venues
    .flatMap((venue) => venue.imageUrls || [])
    .filter((url): url is string => Boolean(url && url.trim()));

  return Array.from(new Set(images)).slice(0, 4).concat(fallbackImage).slice(0, 4);
}

function buildVenueDestinations(venues: Venue[]): HomeVenueDestination[] {
  const cityMap = new Map<string, Venue[]>();

  venues.forEach((venue) => {
    const city = normalizeVenueCity(venue.city);
    cityMap.set(city, [...(cityMap.get(city) || []), venue]);
  });

  const groupedCities = Array.from(cityMap.entries()).sort((left, right) => {
    if (right[1].length !== left[1].length) {
      return right[1].length - left[1].length;
    }
    return left[0].localeCompare(right[0], "vi");
  });

  const primaryCities = groupedCities.slice(0, 3);
  const otherCities = groupedCities.slice(3);
  const destinations = primaryCities.map(([city, cityVenues]) => ({
    title: city,
    to: "/venues",
    images: getVenueImageUrls(cityVenues, city).slice(0, 1),
  }));

  const otherVenues = otherCities.flatMap(([, cityVenues]) => cityVenues);
  destinations.push({
    title: "Vị trí khác",
    to: "/venues",
    images:
      otherVenues.length > 0
        ? getVenueImageUrls(otherVenues, "Vị trí khác")
        : otherVenueFallbackImages,
  });

  return destinations;
}

function getEventLocation(event?: Partial<EventSummary>) {
  const venueName = event?.venue?.name || event?.venueName;
  const cityName = event?.venue?.city || event?.city;

  const parts = [venueName, cityName]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .map((part) => part.trim());

  return Array.from(new Set(parts)).join(", ") || "Đang cập nhật địa điểm";
}

function getHeroEventKey(event?: EditableHeroEvent) {
  if (!event) return "";
  return String(event.id || event.slug || event.title || "");
}

function readHeroOverrides(): HeroEventOverrides {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(HOME_HERO_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Không thể đọc cấu hình hero trang chủ", error);
    return {};
  }
}

function normalizeHomeContentConfig(
  value: unknown,
  defaults: HomeContentConfig = defaultHomeContentConfig,
): HomeContentConfig {
  const source =
    value && typeof value === "object"
      ? (value as Partial<HomeContentConfig>)
      : {};
  const nextOrder = Array.isArray(source.sectionOrder)
    ? source.sectionOrder.filter(
        (key): key is HomeSectionKey =>
          typeof key === "string" && key in homeSectionLabelKeys,
      )
    : [];

  return {
    ...defaults,
    ...source,
    titleColors: source.titleColors || {},
    categoryOverrides: source.categoryOverrides || {},
    sectionOrder: [
      ...nextOrder,
      ...defaults.sectionOrder.filter(
        (key) => !nextOrder.includes(key),
      ),
    ],
  };
}

function readHomeContentConfig(defaults: HomeContentConfig): HomeContentConfig {
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(HOME_CONTENT_CONFIG_KEY);
    return raw
      ? normalizeHomeContentConfig(JSON.parse(raw), defaults)
      : defaults;
  } catch (error) {
    console.warn("Không thể đọc cấu hình giao diện trang chủ", error);
    return defaults;
  }
}

function renderTitleWithHighlight(title: string, highlight: string) {
  const normalizedTitle = title.toLowerCase();
  const normalizedHighlight = highlight.toLowerCase();
  const highlightIndex = normalizedTitle.lastIndexOf(normalizedHighlight);

  if (highlightIndex < 0) return title;

  const beforeHighlight = title.slice(0, highlightIndex);
  const highlightedText = title.slice(
    highlightIndex,
    highlightIndex + highlight.length,
  );
  const afterHighlight = title.slice(highlightIndex + highlight.length);

  return (
    <>
      {beforeHighlight}
      <span className="home-title-accent">{highlightedText}</span>
      {afterHighlight}
    </>
  );
}

export default function HomePage() {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const localizedDefaultHomeContent = useMemo(
    () => getDefaultHomeContentConfig(language),
    [language],
  );
  const { keycloak, initialized } = useKeycloak();
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [featuredEvents, setFeaturedEvents] = useState<EventSummary[]>([]);
  const [otherEvents, setOtherEvents] = useState<EventSummary[]>([]);
  const [pastEvents, setPastEvents] = useState<EventSummary[]>([]);
  const [venueDestinations, setVenueDestinations] = useState<
    HomeVenueDestination[]
  >([]);
  const [rawCategorySections, setRawCategorySections] = useState<
    { category: Category; events: EventSummary[]; totalEvents: number }[]
  >([]);
  const [editorTab, setEditorTab] = useState<"titles" | "categories" | "layout" | "hero">("titles");

  // Venue States
  const [venues, setVenues] = useState<Venue[]>([]);

  const getCityGoogleMapsUrl = (cityTitle: string) => {
    const cityVenues = venues.filter(
      (v) => normalizeVenueCity(v.city).toLowerCase() === cityTitle.toLowerCase()
    );
    if (cityVenues.length > 0) {
      const firstVenue = cityVenues[0];
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        firstVenue.name + ", " + firstVenue.address
      )}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cityTitle)}`;
  };

  const [activeFaq, setActiveFaq] = useState(0);
  const [heroOverrides, setHeroOverrides] = useState<HeroEventOverrides>({});
  const [homeContent, setHomeContent] = useState<HomeContentConfig>(
    localizedDefaultHomeContent,
  );
  const [contentDraft, setContentDraft] = useState<HomeContentConfig>(
    localizedDefaultHomeContent,
  );
  const localizedHomeNavItems = useMemo(
    () => homeNavItems.map((item) => ({ ...item, label: t(item.labelKey) })),
    [t],
  );

  const categoryEventSections: CategoryEventSection[] = useMemo(() => {
    return [...rawCategorySections]
      .sort((left, right) => {
        const leftId = String(left.category.id || "");
        const rightId = String(right.category.id || "");
        const leftOverride = homeContent.categoryOverrides?.[leftId];
        const rightOverride = homeContent.categoryOverrides?.[rightId];

        const leftOrder = leftOverride?.order !== undefined ? leftOverride.order : 999;
        const rightOrder = rightOverride?.order !== undefined ? rightOverride.order : 999;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        if (right.totalEvents !== left.totalEvents) {
          return right.totalEvents - left.totalEvents;
        }
        return left.category.displayOrder - right.category.displayOrder;
      })
      .slice(0, 3)
      .map(({ category, events }) => ({ category, events }));
  }, [rawCategorySections, homeContent.categoryOverrides]);

  const [isHomeEditorOpen, setIsHomeEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState({
    title: "",
    bannerUrl: "",
    venueName: "",
    city: "",
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollUpcoming = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 324;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [heroCandidateRes, eventRes, pastEventRes] = await Promise.all([
          eventService.getEvents({
            size: EVENT_MEDIA_CANDIDATE_LIMIT,
            sort: "startDatetime,asc",
            startDate: today,
          }),
          eventService.getEvents({
            size: EVENT_MEDIA_CANDIDATE_LIMIT,
            sort: "startDatetime,asc",
            startDate: today,
          }),
          eventService.getEvents({
            size: EVENT_MEDIA_CANDIDATE_LIMIT,
            sort: "startDatetime,desc",
            endDate: today,
          }),
        ]);
        const heroEventsWithMedia = getNearestEventsWithPosterAndBanner(
          heroCandidateRes.content || [],
          5,
        );
        const upcomingEventsWithMedia = getNearestEventsWithPosterAndBanner(
          eventRes.content || [],
          8,
        );
        const pastEventsWithMedia = getNearestEventsWithPosterAndBanner(
          pastEventRes.content || [],
          8,
          "desc",
        );

        setFeaturedEvents(heroEventsWithMedia);
        setOtherEvents(upcomingEventsWithMedia);
        setPastEvents(pastEventsWithMedia);
      } catch (error) {
        console.error("Lỗi fetch HomePage API", error);
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    const loadCategoryEvents = async () => {
      try {
        const categories = await categoryService.getCategories();
        const sections = await Promise.all(
          categories.map(async (category) => {
            const today = new Date().toISOString().slice(0, 10);
            const eventsPage = await eventService.getEvents({
              category: category.slug || category.id,
              size: EVENT_MEDIA_CANDIDATE_LIMIT,
              sort: "startDatetime,asc",
              startDate: today,
            });
            const nearestEventsWithMedia =
              getNearestEventsWithPosterAndBanner(
                eventsPage.content || [],
                4,
              );

            return {
              category,
              events: nearestEventsWithMedia,
              totalEvents: eventsPage.totalElements || 0,
            };
          }),
        );

        setRawCategorySections(
          sections
            .filter((section) => section.totalEvents > 0 && section.events.length > 0)
            .sort((left, right) => {
              if (right.totalEvents !== left.totalEvents) {
                return right.totalEvents - left.totalEvents;
              }
              return left.category.displayOrder - right.category.displayOrder;
            })
        );
      } catch (error) {
        console.error("Lỗi fetch event theo danh mục", error);
      }
    };

    void loadCategoryEvents();
  }, []);

  useEffect(() => {
    const loadVenueDestinations = async () => {
      try {
        const data = await venueService.getVenues();
        setVenues(data);
        setVenueDestinations(buildVenueDestinations(data));
      } catch (error) {
        console.error("Lỗi fetch venue cho HomePage", error);
      }
    };

    void loadVenueDestinations();
  }, []);

  useEffect(() => {
    setHeroOverrides(readHeroOverrides());
    const savedContent = readHomeContentConfig(localizedDefaultHomeContent);
    const shouldUseLocalizedDefaults =
      savedContent.trustTitle === "More than 100+ businesses owners across the world trust Counter" ||
      savedContent.featuresTitle === "Our Core Features";
    const nextContent = shouldUseLocalizedDefaults
      ? {
          ...localizedDefaultHomeContent,
          titleColors: savedContent.titleColors || {},
          categoryOverrides: savedContent.categoryOverrides || {},
          sectionOrder: savedContent.sectionOrder || localizedDefaultHomeContent.sectionOrder,
        }
      : savedContent;
    setHomeContent(nextContent);
    setContentDraft(nextContent);
  }, [localizedDefaultHomeContent]);

  const canEditHomeHero =
    initialized &&
    hasAnyRealmRole(keycloak.tokenParsed, ["ADMIN", "ADIM", "ORGANIZER"]);

  const baseHeroEvents: EditableHeroEvent[] =
    featuredEvents.length > 0 ? featuredEvents.slice(0, 5) : fallbackHeroEvents;
  const heroEvents = baseHeroEvents.map((event) => {
    const key = getHeroEventKey(event);
    return key && heroOverrides[key] ? { ...event, ...heroOverrides[key] } : event;
  });
  const primaryHeroEvent = heroEvents[currentSlide] || heroEvents[0];
  const upcomingEvents = otherEvents.length > 0 ? otherEvents : heroEvents;
  const primaryHeroKey = getHeroEventKey(primaryHeroEvent);
  const visiblePastEventGallery =
    pastEvents.length > 0
      ? pastEvents.map((event) => ({
          image: getEventImage(event),
          title: event.title,
          to: `/event/${event.slug || event.id}`,
        }))
      : pastEventGallery.map((image, index) => ({
          image,
          title: `Past event ${index + 1}`,
          to: "",
        }));

  useEffect(() => {
    if (heroEvents.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroEvents.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [heroEvents.length]);

  useEffect(() => {
    if (currentSlide >= heroEvents.length) {
      setCurrentSlide(0);
    }
  }, [currentSlide, heroEvents.length]);

  useEffect(() => {
    setEditorDraft({
      title: primaryHeroEvent?.title || "",
      bannerUrl: getEventImage(primaryHeroEvent),
      venueName: primaryHeroEvent?.venue?.name || primaryHeroEvent?.venueName || "",
      city: primaryHeroEvent?.venue?.city || primaryHeroEvent?.city || "",
    });
  }, [
    primaryHeroKey,
    primaryHeroEvent?.title,
    primaryHeroEvent?.bannerUrl,
    primaryHeroEvent?.thumbnailUrl,
    primaryHeroEvent?.venue?.name,
    primaryHeroEvent?.venue?.city,
    primaryHeroEvent?.venueName,
    primaryHeroEvent?.city,
  ]);

  useEffect(() => {
    if (!canEditHomeHero) return;

    const params = new URLSearchParams(location.search);
    if (params.get("editHome") !== "1") return;

    setIsHomeEditorOpen(true);
  }, [canEditHomeHero, location.key, location.search]);

  const moveSlide = (direction: number) => {
    if (!heroEvents.length) return;
    setCurrentSlide((prev) => {
      const next = prev + direction;
      if (next < 0) return heroEvents.length - 1;
      if (next >= heroEvents.length) return 0;
      return next;
    });
  };

  const saveHeroEditor = () => {
    if (!primaryHeroKey) return;

    const nextOverrides: HeroEventOverrides = {
      ...heroOverrides,
      [primaryHeroKey]: {
        title: editorDraft.title.trim(),
        bannerUrl: editorDraft.bannerUrl.trim(),
        venueName: editorDraft.venueName.trim(),
        city: editorDraft.city.trim(),
      },
    };

    window.localStorage.setItem(
      HOME_HERO_OVERRIDES_KEY,
      JSON.stringify(nextOverrides),
    );
    setHeroOverrides(nextOverrides);
  };

  const resetHeroEditor = () => {
    if (!primaryHeroKey) return;

    const nextOverrides = { ...heroOverrides };
    delete nextOverrides[primaryHeroKey];
    window.localStorage.setItem(
      HOME_HERO_OVERRIDES_KEY,
      JSON.stringify(nextOverrides),
    );
    setHeroOverrides(nextOverrides);
  };

  const getSectionOrder = (key: HomeSectionKey) =>
    homeContent.sectionOrder.indexOf(key) + 2;

  const moveSectionInDraft = (key: HomeSectionKey, direction: -1 | 1) => {
    setContentDraft((current) => {
      const order = [...current.sectionOrder];
      const index = order.indexOf(key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
        return current;
      }

      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return {
        ...current,
        sectionOrder: order,
      };
    });
  };

  const moveCategoryInDraft = (categoryId: string, direction: -1 | 1) => {
    setContentDraft((current) => {
      const categoriesList = rawCategorySections.map((s) => String(s.category.id || ""));
      const nextOverrides = { ...current.categoryOverrides };

      const sortedCategoriesList = [...categoriesList].sort((a, b) => {
        const orderA =
          nextOverrides[a]?.order !== undefined ? nextOverrides[a].order : categoriesList.indexOf(a);
        const orderB =
          nextOverrides[b]?.order !== undefined ? nextOverrides[b].order : categoriesList.indexOf(b);
        return orderA - orderB;
      });

      const index = sortedCategoriesList.indexOf(categoryId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= sortedCategoriesList.length) {
        return current;
      }

      const swappedId = sortedCategoriesList[nextIndex];
      sortedCategoriesList[index] = swappedId;
      sortedCategoriesList[nextIndex] = categoryId;

      sortedCategoriesList.forEach((id, idx) => {
        nextOverrides[id] = {
          ...(nextOverrides[id] || { name: "", color: "" }),
          order: idx,
        };
      });

      return {
        ...current,
        categoryOverrides: nextOverrides,
      };
    });
  };

  const handleRenameCategory = (categoryId: string, name: string) => {
    setContentDraft((current) => {
      const nextOverrides = { ...current.categoryOverrides };
      nextOverrides[categoryId] = {
        ...(nextOverrides[categoryId] || { order: 0, color: "" }),
        name,
      };
      return {
        ...current,
        categoryOverrides: nextOverrides,
      };
    });
  };

  const handleChangeCategoryColor = (categoryId: string, color: string) => {
    setContentDraft((current) => {
      const nextOverrides = { ...current.categoryOverrides };
      nextOverrides[categoryId] = {
        ...(nextOverrides[categoryId] || { order: 0, name: "" }),
        color,
      };
      return {
        ...current,
        categoryOverrides: nextOverrides,
      };
    });
  };

  const saveHomeEditor = () => {
    const normalizedContent = normalizeHomeContentConfig(contentDraft, localizedDefaultHomeContent);
    window.localStorage.setItem(
      HOME_CONTENT_CONFIG_KEY,
      JSON.stringify(normalizedContent),
    );
    setHomeContent(normalizedContent);
    setContentDraft(normalizedContent);
    saveHeroEditor();
    toast.success(t("home.editor.saveSuccess"));
  };

  const resetHomeEditor = () => {
    window.localStorage.removeItem(HOME_CONTENT_CONFIG_KEY);
    setHomeContent(localizedDefaultHomeContent);
    setContentDraft(localizedDefaultHomeContent);
  };

  const renderHeroTitle = () =>
    homeContent.heroTitle.split("\n").map((line, index, lines) => {
      const isLast = index === lines.length - 1;
      return (
        <span
          className={`hero-heading-line${isLast ? " hero-heading-highlight" : ""}`}
          key={`${line}-${index}`}
        >
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      );
    });

  return (
    <div className="home-page">
      <div className="home-topbar">
        <AccountCategoryNav items={localizedHomeNavItems} />
      </div>

      <main className="container home-main-shell">
        <section className="home-hero" id="home-hero" style={{ order: 1 }}>
          <div className="home-hero-shell">
            <div className="home-hero-copy">
              <h1 style={homeContent.titleColors?.hero ? { color: homeContent.titleColors.hero } : undefined}>
                {renderHeroTitle()}
              </h1>
              <p className="home-hero-description">
                {t("home.hero.description")}
              </p>

              <div className="home-hero-actions">
                <Link
                  to="/search"
                  className="btn btn-primary home-hero-primary-cta"
                >
                  {t("home.hero.getStarted")}
                </Link>
              </div>
            </div>

            <div className="home-hero-slider">
              <div
                className="hero-event-stage"
                style={{
                  backgroundImage: `url(${getEventImage(primaryHeroEvent)})`,
                }}
              >
                <article className="hero-event-card">
                  <div className="hero-slider-controls">
                    <button
                      type="button"
                      onClick={() => moveSlide(-1)}
                      aria-label={t("home.hero.previousEvent")}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlide(1)}
                      aria-label={t("home.hero.nextEvent")}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div className="hero-event-media">
                    <img
                      src={getEventImage(primaryHeroEvent)}
                      alt={primaryHeroEvent?.title || t("organizerEvents.events")}
                    />
                  </div>

                  <div className="hero-event-body">
                    <h2>
                      {primaryHeroEvent?.title || t("home.eventUpdating")}
                    </h2>

                    <div className="hero-event-footer">
                      <div className="hero-event-meta">
                        <span>
                          <Calendar size={15} />
                          {formatDate(primaryHeroEvent?.startDatetime)}
                        </span>
                        <span>
                          <MapPin size={15} />
                          {getEventLocation(primaryHeroEvent)}
                        </span>
                      </div>
                      <Link
                        to={`/event/${primaryHeroEvent?.slug || primaryHeroEvent?.id || ""}`}
                        className="hero-event-cta"
                      >
                        {t("home.hero.getEventTicket")}
                      </Link>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>

        </section>

        <section className="home-trust-strip" style={{ order: getSectionOrder("trust") }}>
          <p className="home-trust-copy" style={homeContent.titleColors?.trust ? { color: homeContent.titleColors.trust } : undefined}>
            {homeContent.trustTitle}
          </p>

          <div className="partner-grid home-partner-grid">
            {partnerLogos.map((partner) => (
              <div
                className="partner-logo home-partner-logo"
                key={partner.id}
                title={partner.name}
              >
                <img src={partner.image} alt={partner.name} />
              </div>
            ))}
          </div>
        </section>

        <section className="home-section" id="home-features" style={{ order: getSectionOrder("features") }}>
          <div className="section-heading section-heading-center">
            <h2 className="home-features-title" style={homeContent.titleColors?.features ? { color: homeContent.titleColors.features } : undefined}>
              {renderTitleWithHighlight(
                homeContent.featuresTitle,
                language === "en" ? "Features" : "nổi bật",
              )}
            </h2>
            <p>{t("home.sectionDescriptions.features")}</p>
          </div>

          <div className="feature-grid">
            {featureCards.map((feature) => {
              const Icon = feature.icon;

              return (
                <article className="feature-card" key={feature.titleKey}>
                  <div className="feature-icon">
                    <Icon size={22} />
                  </div>
                  <h3>{t(feature.titleKey)}</h3>
                  <p>{t(feature.descriptionKey)}</p>
                </article>
              );
            })}
          </div>
        </section>

        {categoryEventSections.length > 0 ? (
          <section
            className="home-category-events-section"
            style={{ order: getSectionOrder("categories") }}
          >
            {categoryEventSections.map((section, index) => {
              const categoryId = String(section.category.id || "");
              const displayColor = homeContent.categoryOverrides?.[categoryId]?.color || homeContent.titleColors?.categories;
              const displayName = homeContent.categoryOverrides?.[categoryId]?.name || section.category.name;

              return (
                <div
                  className="home-category-event-group"
                  key={section.category.id || section.category.slug}
                >
                  <div className="home-category-event-block">
                    <div className="home-category-event-header">
                      <h2 style={displayColor ? { color: displayColor } : undefined}>
                        {(() => {
                          const CategoryIcon = categoryTitleIcons[index];
                          return CategoryIcon ? (
                            <CategoryIcon className="home-category-title-icon" />
                          ) : null;
                        })()}
                        <span>{displayName}</span>
                      </h2>
                      <Link
                        to={`/search?category=${section.category.slug || section.category.id}`}
                        className="home-category-event-more"
                      >
                        <span>{t("common.viewMore")}</span>
                        <ChevronRight size={18} />
                      </Link>
                    </div>

                    <div className="home-category-event-grid">
                      {section.events.map((event) => (
                        <article className="home-category-event-card" key={event.id}>
                          <Link
                            to={`/event/${event.slug || event.id}`}
                            className="home-category-event-image"
                          >
                            <img src={getEventImage(event)} alt={event.title} />
                          </Link>

                          <div className="home-category-event-body">
                            <h3>
                              <Link to={`/event/${event.slug || event.id}`}>
                                {event.title}
                              </Link>
                            </h3>
                            <p className="home-category-event-price">
                              {formatPrice(event)}
                            </p>
                            <p className="home-category-event-date">
                              <Calendar size={15} />
                              <span>
                                {formatCategoryEventDate(event.startDatetime)}
                              </span>
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  {index === 0 && categoryEventSections.length > 1 ? (
                    <div className="home-category-events-banner">
                      <img src={HOME_CATEGORY_BANNER_URL} alt="Event banner" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}

        <section
          className="home-section home-upcoming-section"
          style={{
            order: getSectionOrder("upcoming"),
            backgroundImage: `url("https://images.pexels.com/photos/3122799/pexels-photo-3122799.jpeg")`,
          }}
        >
          <div className="section-heading">
            <div>
              <h2 className="home-upcoming-title" style={homeContent.titleColors?.upcoming ? { color: homeContent.titleColors.upcoming } : undefined}>
                {renderTitleWithHighlight(
                  homeContent.upcomingTitle,
                  language === "en" ? "Events" : "sắp diễn ra",
                )}
              </h2>
              <p>{t("home.sectionDescriptions.upcoming")}</p>
            </div>
            <div className="upcoming-header-actions">
              <Link to="/search" className="section-link home-upcoming-cta">
                {t("home.upcoming.viewAll")}
              </Link>
            </div>
          </div>

          <div className="upcoming-carousel-wrapper">
            <button
              className="upcoming-nav-btn is-left"
              onClick={() => scrollUpcoming("left")}
              aria-label={t("home.previous")}
            >
              <ChevronLeft size={24} />
            </button>
            <div className="upcoming-cards-container" ref={scrollContainerRef}>
              {upcomingEvents.map((event) => {
                const d = new Date(event.startDatetime || "");
                const isValidDate = !Number.isNaN(d.getTime());
                const dayMonth = isValidDate
                  ? `${d.getDate()} ${monthShortNames[d.getMonth()]}`
                  : "";
                const year = isValidDate ? d.getFullYear() : "";

                return (
                  <article className="upcoming-event-card" key={event.id}>
                    <Link
                      to={`/event/${event.slug || event.id}`}
                      className="upcoming-card-image-wrapper"
                    >
                      <img src={getEventImage(event)} alt={event.title} />
                      {isValidDate && (
                        <div className="upcoming-date-badge">
                          <span className="upcoming-date-day">{dayMonth}</span>
                          <span className="upcoming-date-year">{year}</span>
                        </div>
                      )}
                    </Link>
                    <div className="upcoming-card-content">
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
                          {formatPrice(event)}
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
            <button
              className="upcoming-nav-btn is-right"
              onClick={() => scrollUpcoming("right")}
              aria-label={t("home.next")}
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </section>

        {venueDestinations.length > 0 ? (
          <section
            className="home-venue-destinations-section"
            style={{ order: getSectionOrder("venues") }}
          >
            <h2 style={homeContent.titleColors?.venues ? { color: homeContent.titleColors.venues } : undefined}>
              <FaMapMarkedAlt className="home-venue-destinations-title-icon" />
              <span>{homeContent.venuesTitle || "Điểm đến thú vị"}</span>
            </h2>
            <div className="home-venue-destination-grid">
              {venueDestinations.map((destination) => {
                const isOther = destination.title === "Vị trí khác";
                const cardClass = `home-venue-destination-card${
                  destination.images.length > 1 ? " is-collage" : ""
                }`;

                if (isOther) {
                  return (
                    <Link
                      to={destination.to}
                      className={cardClass}
                      key={destination.title}
                    >
                      <div className="home-venue-destination-media">
                        {destination.images.map((image, index) => (
                          <img
                            src={image}
                            alt={destination.title}
                            key={`${destination.title}-${index}`}
                          />
                        ))}
                      </div>
                      <div className="home-venue-destination-overlay" />
                      <h3>{destination.title}</h3>
                    </Link>
                  );
                }

                const mapUrl = getCityGoogleMapsUrl(destination.title);
                return (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClass}
                    key={destination.title}
                  >
                    <div className="home-venue-destination-media">
                      {destination.images.map((image, index) => (
                        <img
                          src={image}
                          alt={destination.title}
                          key={`${destination.title}-${index}`}
                        />
                      ))}
                    </div>
                    <div className="home-venue-destination-overlay" />
                    <h3>{destination.title}</h3>
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="home-section" id="how-it-works-section" style={{ order: getSectionOrder("how") }}>
          <div className="section-heading section-heading-center">
            <h2 style={homeContent.titleColors?.how ? { color: homeContent.titleColors.how } : undefined}>{homeContent.howTitle}</h2>
            <p>{t("home.sectionDescriptions.how")}</p>
          </div>

          <div className="how-grid">
            {howItWorks.map((item) => (
              <article className="how-card" key={item.step}>
                <div className="how-card-media">
                  <img src={item.image} alt={t(item.titleKey)} />
                  <span>{item.step}</span>
                </div>
                <h3>{t(item.titleKey)}</h3>
                <p>{t(item.descriptionKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section home-pricing-section" style={{ order: getSectionOrder("pricing") }}>
          <div className="section-heading section-heading-center">
            <h2 className="home-pricing-title" style={homeContent.titleColors?.pricing ? { color: homeContent.titleColors.pricing } : undefined}>
              {renderTitleWithHighlight(
                homeContent.pricingTitle,
                language === "en" ? "Pricing" : "minh bạch",
              )}
            </h2>
            <p>{t("home.sectionDescriptions.pricing")}</p>
          </div>

          <div className="pricing-cards-row">
            {/* Card 1 – Organization Signup */}
            <div className="pricing-glass-card pricing-glass-card-signup">
              <div className="pricing-glass-header">
                <div className="pricing-glass-icon">
                  <Building2 size={40} />
                </div>
                <span className="pricing-big-value">{t("home.pricing.free")}</span>
              </div>
              <h3>{t("home.pricing.signupTitle")}</h3>
              <p>{t("home.pricing.signupDescription")}</p>
              <div className="pricing-signup-benefits">
                <ul className="pricing-check-list">
                  <li>
                    <Check size={16} /> {t("home.pricing.unlimitedEvents")}
                  </li>
                  <li>
                    <Check size={16} /> {t("home.pricing.salesDashboard")}
                  </li>
                  <li>
                    <Check size={16} /> {t("home.pricing.qrCheckIn")}
                  </li>
                  <li>
                    <Check size={16} /> {t("home.pricing.attendeeManagement")}
                  </li>
                </ul>
                <div className="pricing-card-footer">
                  <Link to="/register" className="pricing-cta-btn">
                    {t("home.pricing.getStarted")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 2 – Transaction Fee */}
            <div className="pricing-glass-card">
              <div className="pricing-glass-header">
                <div className="pricing-glass-icon">
                  <Wallet size={40} />
                </div>
                <span className="pricing-big-percent">
                  5<small>%</small>
                </span>
              </div>
              <h3>Transaction Fee</h3>
              <p>
                A small fee applied per ticket sold, covering payment processing
                and platform services.
              </p>

              <div className="pricing-progress-group">
                <div className="pricing-progress-item">
                  <span className="pricing-progress-label">
                    Organizer Payout
                  </span>
                  <div className="pricing-progress-bar">
                    <div
                      className="pricing-progress-fill"
                      style={{ width: "80%" }}
                    />
                  </div>
                  <span className="pricing-progress-value">2%</span>
                </div>
                <div className="pricing-progress-item">
                  <span className="pricing-progress-label">
                    Payment Gateway
                  </span>
                  <div className="pricing-progress-bar">
                    <div
                      className="pricing-progress-fill"
                      style={{ width: "60%" }}
                    />
                  </div>
                  <span className="pricing-progress-value">1.8%</span>
                </div>
                <div className="pricing-progress-item">
                  <span className="pricing-progress-label">{t("home.pricing.platformFee")}</span>
                  <div className="pricing-progress-bar">
                    <div
                      className="pricing-progress-fill"
                      style={{ width: "45%" }}
                    />
                  </div>
                  <span className="pricing-progress-value">1.2%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-section home-past-events-section" style={{ order: getSectionOrder("past") }}>
          <div className="section-heading section-heading-center">
            <h2
              style={{
                fontSize: "clamp(2.2rem, 3.6vw, 3.4rem)",
                fontWeight: 800,
                color: homeContent.titleColors?.past || undefined,
              }}
            >
              {renderTitleWithHighlight(
                homeContent.pastTitle,
                language === "en" ? "Past Events" : "sự kiện đã diễn ra",
              )}
            </h2>
            <p>{t("home.sectionDescriptions.past")}</p>
          </div>

          <div className="past-event-gallery">
            {visiblePastEventGallery.map((item, index) => (
              <article
                className="past-event-thumb"
                key={`${item.image}-${index}`}
              >
                {item.to ? (
                  <Link to={item.to}>
                    <img src={item.image} alt={item.title} />
                  </Link>
                ) : (
                  <img src={item.image} alt={item.title} />
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="home-section faq-section" id="home-faq" style={{ order: getSectionOrder("faq") }}>
          <div className="faq-layout">
            <div className="faq-copy">
              <h2 className="faq-title" style={homeContent.titleColors?.faq ? { color: homeContent.titleColors.faq } : undefined}>
                {renderTitleWithHighlight(
                  homeContent.faqTitle || t("home.defaults.faqTitle"),
                  language === "en" ? "FAQs" : "Câu hỏi thường gặp",
                )}
              </h2>
              <p>{t("home.sectionDescriptions.faq")}</p>

              <div className="faq-visual">
                <img
                  className="faq-illustration-image"
                  src="https://i.ibb.co/Zz1y0hXk/vecteezy-three-cubes-with-q-and-a-on-transparent-background-faq-18735148.png"
                  alt={t("home.faq.illustrationAlt")}
                />
              </div>
            </div>

            <div className="faq-accordion">
              {faqItems.map((item, index) => {
                const isOpen = activeFaq === index;

                return (
                  <article
                    className={`faq-item ${isOpen ? "is-open" : ""}`}
                    key={item.questionKey}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaq(isOpen ? -1 : index)}
                    >
                      <span>{t(item.questionKey)}</span>
                      <span className="faq-toggle-icon" aria-hidden="true">
                        {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                      </span>
                    </button>
                    <div className="faq-answer">
                      <p>{t(item.answerKey)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <div style={{ order: getSectionOrder("blog") }}>
          <Blog
            title={homeContent.blogTitle || t("home.defaults.blogTitle")}
            highlight={language === "en" ? "Blog" : "mới nhất"}
          />
        </div>
      </main>

      {canEditHomeHero && isHomeEditorOpen ? (
        <div className="home-editor-backdrop" role="presentation">
          <section
            className="home-editor-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-editor-title"
          >
            <div className="home-editor-header">
              <div>
                <h2 id="home-editor-title">Sửa giao diện trang chủ</h2>
                <p className="home-editor-subtitle">Tùy biến nội dung, màu sắc và cách sắp xếp trang chủ</p>
              </div>
              <button
                type="button"
                className="home-editor-close"
                onClick={() => setIsHomeEditorOpen(false)}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="home-editor-tabs">
              <button
                type="button"
                className={`home-editor-tab-btn ${editorTab === "titles" ? "active" : ""}`}
                onClick={() => setEditorTab("titles")}
              >
                <Type size={16} />
                <span>Tiêu đề & Màu</span>
              </button>
              <button
                type="button"
                className={`home-editor-tab-btn ${editorTab === "categories" ? "active" : ""}`}
                onClick={() => setEditorTab("categories")}
              >
                <FolderTree size={16} />
                <span>Danh mục</span>
              </button>
              <button
                type="button"
                className={`home-editor-tab-btn ${editorTab === "layout" ? "active" : ""}`}
                onClick={() => setEditorTab("layout")}
              >
                <ArrowUpDown size={16} />
                <span>Bố cục</span>
              </button>
              <button
                type="button"
                className={`home-editor-tab-btn ${editorTab === "hero" ? "active" : ""}`}
                onClick={() => setEditorTab("hero")}
              >
                <Image size={16} />
                <span>Banner Hero</span>
              </button>
            </div>

            <div className="home-editor-body">
              {editorTab === "titles" && (
                <div className="home-editor-tab-content">
                  <div className="home-editor-section-header">
                    <h3>Cấu hình tiêu đề & màu sắc</h3>
                    <p>Nhập tiêu đề hiển thị và chọn màu sắc tương ứng cho từng phần</p>
                  </div>

                  <div className="home-editor-fields-grid">
                    <div className="home-editor-field-card">
                      <div className="home-editor-field-card-header">
                        <span className="field-card-number">01</span>
                        <h4>Hero Section</h4>
                      </div>
                      <div className="home-editor-field-group">
                        <label className="home-editor-label-span">Nội dung tiêu đề (sử dụng \n để xuống dòng)</label>
                        <textarea
                          className="home-editor-textarea"
                          value={contentDraft.heroTitle}
                          rows={3}
                          onChange={(event) =>
                            setContentDraft((current) => ({
                              ...current,
                              heroTitle: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="home-editor-field-group color-group">
                        <label className="home-editor-label-span">Màu chữ tiêu đề</label>
                        <div className="color-picker-wrapper">
                          <input
                            type="color"
                            className="home-editor-color-input"
                            value={contentDraft.titleColors?.hero || "#0f172a"}
                            onChange={(event) =>
                              setContentDraft((current) => ({
                                ...current,
                                titleColors: {
                                  ...current.titleColors,
                                  hero: event.target.value,
                                },
                              }))
                            }
                          />
                          <input
                            type="text"
                            className="home-editor-color-text"
                            value={contentDraft.titleColors?.hero || "#0f172a"}
                            placeholder="#0f172a"
                            onChange={(event) =>
                              setContentDraft((current) => ({
                                ...current,
                                titleColors: {
                                  ...current.titleColors,
                                  hero: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {(
                      [
                        ["trustTitle", "trust", t("home.editor.cards.trust"), t("home.editor.fields.trustTitle")],
                        ["featuresTitle", "features", t("home.editor.cards.features"), t("home.editor.fields.featuresTitle")],
                        ["categories", "categories", t("home.editor.cards.categories"), t("home.editor.fields.categoriesTitleColor")],
                        ["upcomingTitle", "upcoming", t("home.editor.cards.upcoming"), t("home.editor.fields.upcomingTitle")],
                        ["venuesTitle", "venues", t("home.editor.cards.venues"), t("home.editor.fields.venuesTitle")],
                        ["howTitle", "how", t("home.editor.cards.how"), t("home.editor.fields.howTitle")],
                        ["pricingTitle", "pricing", t("home.editor.cards.pricing"), t("home.editor.fields.pricingTitle")],
                        ["pastTitle", "past", t("home.editor.cards.past"), t("home.editor.fields.pastTitle")],
                        ["faqTitle", "faq", t("home.editor.cards.faq"), t("home.editor.fields.faqTitle")],
                        ["blogTitle", "blog", t("home.editor.cards.blog"), t("home.editor.fields.blogTitle")],
                      ] as const
                    ).map(([fieldKey, sectionKey, cardLabel, fieldLabel], index) => (
                      <div className="home-editor-field-card" key={sectionKey}>
                        <div className="home-editor-field-card-header">
                          <span className="field-card-number">{String(index + 2).padStart(2, "0")}</span>
                          <h4>{cardLabel}</h4>
                        </div>
                        {fieldKey !== "categories" && (
                          <div className="home-editor-field-group">
                            <label className="home-editor-label-span">{fieldLabel}</label>
                            <input
                              type="text"
                              className="home-editor-input"
                              value={(contentDraft[fieldKey as keyof HomeContentConfig] as string) || ""}
                              onChange={(event) =>
                                setContentDraft((current) => ({
                                  ...current,
                                  [fieldKey]: event.target.value,
                                }))
                              }
                            />
                          </div>
                        )}
                        <div className="home-editor-field-group color-group">
                          <label className="home-editor-label-span">Màu chữ tiêu đề</label>
                          <div className="color-picker-wrapper">
                            <input
                              type="color"
                              className="home-editor-color-input"
                              value={contentDraft.titleColors?.[sectionKey] || "#0f172a"}
                              onChange={(event) =>
                                setContentDraft((current) => ({
                                  ...current,
                                  titleColors: {
                                    ...current.titleColors,
                                    [sectionKey]: event.target.value,
                                  },
                                }))
                              }
                            />
                            <input
                              type="text"
                              className="home-editor-color-text"
                              value={contentDraft.titleColors?.[sectionKey] || "#0f172a"}
                              placeholder="#0f172a"
                              onChange={(event) =>
                                setContentDraft((current) => ({
                                  ...current,
                                  titleColors: {
                                    ...current.titleColors,
                                    [sectionKey]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editorTab === "categories" && (
                <div className="home-editor-tab-content">
                  <div className="home-editor-section-header">
                    <h3>Quản lý danh mục sự kiện</h3>
                    <p>Thay đổi tên hiển thị, màu sắc tiêu đề và thứ tự các danh mục sự kiện nổi bật</p>
                  </div>

                  {rawCategorySections.length === 0 ? (
                    <div className="home-editor-empty">Không có danh mục sự kiện nào hoạt động.</div>
                  ) : (
                    <div className="home-editor-order-list categories-list">
                      {[...rawCategorySections]
                        .sort((left, right) => {
                          const leftId = String(left.category.id || "");
                          const rightId = String(right.category.id || "");
                          const leftOverride = contentDraft.categoryOverrides?.[leftId];
                          const rightOverride = contentDraft.categoryOverrides?.[rightId];
                          const leftOrder = leftOverride?.order !== undefined ? leftOverride.order : rawCategorySections.indexOf(left);
                          const rightOrder = rightOverride?.order !== undefined ? rightOverride.order : rawCategorySections.indexOf(right);
                          return leftOrder - rightOrder;
                        })
                        .map((section, index, sortedCategories) => {
                          const categoryId = String(section.category.id || "");
                          const displayName = contentDraft.categoryOverrides?.[categoryId]?.name || section.category.name;
                          const displayColor = contentDraft.categoryOverrides?.[categoryId]?.color || "#0f172a";

                          return (
                            <div className="home-editor-category-card" key={categoryId}>
                              <div className="category-card-drag-handle">
                                <span className="category-index">{index + 1}</span>
                              </div>
                              
                              <div className="category-card-details">
                                <div className="home-editor-field-group">
                                  <label className="home-editor-label-span">Tên danh mục hiển thị <em className="original-label-name">({section.category.name})</em></label>
                                  <input
                                    type="text"
                                    className="home-editor-input"
                                    value={displayName}
                                    onChange={(e) => handleRenameCategory(categoryId, e.target.value)}
                                    placeholder={section.category.name}
                                  />
                                </div>

                                <div className="home-editor-field-group color-group">
                                  <label className="home-editor-label-span">Màu tiêu đề</label>
                                  <div className="color-picker-wrapper">
                                    <input
                                      type="color"
                                      className="home-editor-color-input"
                                      value={displayColor}
                                      onChange={(e) => handleChangeCategoryColor(categoryId, e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      className="home-editor-color-text"
                                      value={displayColor}
                                      placeholder="#0f172a"
                                      onChange={(e) => handleChangeCategoryColor(categoryId, e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="category-card-actions">
                                <button
                                  type="button"
                                  className="home-editor-btn-icon"
                                  onClick={() => moveCategoryInDraft(categoryId, -1)}
                                  disabled={index === 0}
                                  title="Di chuyển lên"
                                >
                                  <ChevronLeft size={16} style={{ transform: "rotate(90deg)" }} />
                                </button>
                                <button
                                  type="button"
                                  className="home-editor-btn-icon"
                                  onClick={() => moveCategoryInDraft(categoryId, 1)}
                                  disabled={index === sortedCategories.length - 1}
                                  title="Di chuyển xuống"
                                >
                                  <ChevronLeft size={16} style={{ transform: "rotate(-90deg)" }} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {editorTab === "layout" && (
                <div className="home-editor-tab-content">
                  <div className="home-editor-section-header">
                    <h3>Sắp xếp vị trí bố cục</h3>
                    <p>Thay đổi thứ tự hiển thị các phần nội dung trên Trang chủ từ trên xuống dưới</p>
                  </div>

                  <div className="home-editor-order-list layout-list">
                    {contentDraft.sectionOrder.map((key, index) => {
                      let SectionIcon = Settings;
                      if (key === "trust") SectionIcon = Building2;
                      else if (key === "features") SectionIcon = Check;
                      else if (key === "categories") SectionIcon = FolderTree;
                      else if (key === "upcoming") SectionIcon = Calendar;
                      else if (key === "venues") SectionIcon = MapPin;
                      else if (key === "how") SectionIcon = HelpCircle;
                      else if (key === "pricing") SectionIcon = Wallet;
                      else if (key === "past") SectionIcon = Image;
                      else if (key === "faq") SectionIcon = MessageSquareText;
                      else if (key === "blog") SectionIcon = BookOpen;

                      return (
                        <div className="home-editor-order-item-card" key={key}>
                          <div className="item-card-icon-wrapper">
                            <SectionIcon size={18} className="item-card-icon" />
                          </div>
                          
                          <div className="item-card-label">
                            <span className="item-card-name">{t(homeSectionLabelKeys[key])}</span>
                            <span className="item-card-index">Vị trí {index + 1}</span>
                          </div>

                          <div className="item-card-actions">
                            <button
                              type="button"
                              className="home-editor-btn-icon"
                              onClick={() => moveSectionInDraft(key, -1)}
                              disabled={index === 0}
                            >
                              <ChevronLeft size={16} style={{ transform: "rotate(90deg)" }} />
                            </button>
                            <button
                              type="button"
                              className="home-editor-btn-icon"
                              onClick={() => moveSectionInDraft(key, 1)}
                              disabled={index === contentDraft.sectionOrder.length - 1}
                            >
                              <ChevronLeft size={16} style={{ transform: "rotate(-90deg)" }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {editorTab === "hero" && (
                <div className="home-editor-tab-content">
                  <div className="home-editor-section-header">
                    <h3>Tùy chỉnh Slide Banner Hero</h3>
                    <p>Chỉnh sửa hình ảnh, tiêu đề và địa điểm cho sự kiện đang chọn hiển thị trên Banner đầu trang</p>
                  </div>

                  <div className="home-editor-fields-grid">
                    <div className="home-editor-field-card full-width">
                      <div className="home-editor-field-group">
                        <label className="home-editor-label-span">Tiêu đề sự kiện</label>
                        <input
                          type="text"
                          className="home-editor-input"
                          value={editorDraft.title}
                          onChange={(event) =>
                            setEditorDraft((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="home-editor-field-group">
                        <label className="home-editor-label-span">Đường dẫn ảnh Banner (URL)</label>
                        <input
                          type="text"
                          className="home-editor-input"
                          value={editorDraft.bannerUrl}
                          onChange={(event) =>
                            setEditorDraft((prev) => ({
                              ...prev,
                              bannerUrl: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="home-editor-row-fields">
                        <div className="home-editor-field-group">
                          <label className="home-editor-label-span">Địa điểm tổ chức</label>
                          <input
                            type="text"
                            className="home-editor-input"
                            value={editorDraft.venueName}
                            onChange={(event) =>
                              setEditorDraft((prev) => ({
                                ...prev,
                                venueName: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="home-editor-field-group">
                          <label className="home-editor-label-span">Thành phố</label>
                          <input
                            type="text"
                            className="home-editor-input"
                            value={editorDraft.city}
                            onChange={(event) =>
                              setEditorDraft((prev) => ({
                                ...prev,
                                city: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="home-editor-actions">
              <button type="button" className="home-editor-btn-secondary" onClick={resetHomeEditor}>
                <Undo2 size={15} />
                <span>Khôi phục tiêu đề</span>
              </button>
              <button type="button" className="home-editor-btn-secondary" onClick={resetHeroEditor}>
                <Undo2 size={15} />
                <span>Khôi phục banner</span>
              </button>
              <button type="button" className="home-editor-btn-primary" onClick={saveHomeEditor}>
                <Save size={15} />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

        <Footer />
    </div>
  );
}

