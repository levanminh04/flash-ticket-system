export interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl?: string;
  displayOrder: number;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  district?: string;
  city: string;
  latitude?: number;
  longitude?: number;
  totalCapacity?: number;
  facilities?: string[];
  imageUrls?: string[];
}

export interface OrganizerInfo {
  id: string;
  userId?: string;
  name: string;
  slug?: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  websiteUrl?: string;
  isVerified?: boolean;
  totalEvents?: number;
  totalTicketsSold?: number;
  followerCount?: number;
  averageRating?: number;
  email?: string;
  phone?: string;
}

export interface EventSummary {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string;
  bannerUrl?: string;
  thumbnailUrl?: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  venue?: {
    id: string;
    name: string;
    city: string;
  };
  venueName?: string;
  city?: string;
  startDatetime: string;
  endDatetime: string;
  organizer?: {
    id: string;
    userId?: string;
    name: string;
    slug?: string;
    logoUrl?: string;
    bannerUrl?: string;
    description?: string;
    websiteUrl?: string;
    isVerified?: boolean;
    totalEvents?: number;
    totalTicketsSold?: number;
    followerCount?: number;
    averageRating?: number;
    email?: string;
    phone?: string;
  };
  status: string;
  isFeatured: boolean;
  minPrice?: number;
  ticketsSold?: number;
  totalCapacity?: number;
  tags?: string[];

  // Fields for EventDetailResponse API
  description?: string;
  schedule?: {
    startDatetime: string;
    endDatetime: string;
  };
  statistics?: {
    ticketsSold: number;
    totalCapacity: number;
  };
  ticketTypes?: TicketType[];
  images?: {
    type: string;
    url: string;
    isPrimary?: boolean;
  }[];
  categories?: {
    id?: string;
    name: string;
    slug?: string;
  }[];
}

// Spring Data Page Response Format
export interface SpringPage<T> {
  content: T[];
  pageable: any;
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: any;
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

// ==================== BOOKING FLOW TYPES ====================

export interface TicketType {
  id: string;
  eventId: string;
  sectorId?: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  quantityTotal: number;
  quantityAvailable: number;
  quantityReserved: number;
  maxPerOrder: number;
  seatSelectionEnabled: boolean;
  saleStartDatetime?: string;
  saleEndDatetime?: string;
  displayOrder: number;
  colorCode?: string;
  status: string;
  isVisible: boolean;
}

export interface VenueSector {
  id: string;
  venueId: string;
  name: string;
  code: string;
  description?: string;
  sectorType: string; // SEATED, STANDING, VIP_BOX, ACCESSIBLE
  totalRows?: number;
  seatsPerRow?: number;
  totalCapacity: number;
  positionX?: number;
  positionY?: number;
  widthPercent?: number;
  heightPercent?: number;
  colorCode?: string;
  displayOrder: number;
}

export interface VenueSeat {
  id: string;
  sectorId: string;
  rowName: string;
  seatNumber: string;
  seatLabel?: string;
  coordX?: number;
  coordY?: number;
  seatType: string; // REGULAR, WHEELCHAIR, COMPANION, PREMIUM, RESTRICTED
  isAisle: boolean;
  isActive: boolean;
}

export interface SeatInventory {
  id: string;
  eventId: string;
  seatId: string;
  ticketTypeId?: string;
  status: string; // AVAILABLE, LOCKED, RESERVED, SOLD, BLOCKED
  lockedByUserId?: string;
  lockedAt?: string;
  lockExpiresAt?: string;
  seat?: VenueSeat;
}

export interface ReservationItem {
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
  seatIds?: string[];
}

export interface Reservation {
  id: string;
  eventId: string;
  expiresAt: string;
  status: string;
  items: ReservationItem[];
  totalAmount: number;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  expiresAt?: string;
}

export interface PromotionValidation {
  valid: boolean;
  promotionId?: string;
  code?: string;
  discountType?: string; // PERCENTAGE, FIXED_AMOUNT
  discountValue?: number;
  maxDiscountAmount?: number;
  calculatedDiscount?: number;
  message?: string;
}

export interface PaymentUrlResponse {
  paymentUrl: string;
  transactionId?: string;
}

export interface PaymentResult {
  success: boolean;
  orderNumber?: string;
  transactionNumber?: string;
  amount?: number;
  message?: string;
  orderId?: string;
}
