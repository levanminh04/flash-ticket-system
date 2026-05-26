import axiosClient from "../lib/axiosClient";
import {
  coreDirectClient,
  gatewayFallbackClient,
  userDirectClient,
} from "../lib/internalServiceClients";
import { Category, SpringPage } from "../types/api";

export type OrganizerVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";
export type OrganizerEventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "SOLD_OUT";
export type OrganizerTicketStatus = "ACTIVE" | "INACTIVE" | "SOLD_OUT";
export type LayoutSourceType = "CUSTOM" | "CLONED_FROM_VENUE" | "CLONED_FROM_EVENT";

export interface OrganizerVenue {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  totalCapacity?: number;
  facilities?: string[];
  imageUrls?: string[];
}

export interface OrganizerEventImageSummary {
  id: string;
  url: string;
  type: string;
  isPrimary?: boolean;
  displayOrder?: number;
}

export interface OrganizerEventCategory {
  id: string;
  name: string;
  slug: string;
  isPrimary?: boolean;
}

export interface OrganizerEventVenue {
  id: string;
  name: string;
  slug?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  totalCapacity?: number;
  facilities?: string[];
}

export interface OrganizerEventSchedule {
  startDatetime?: string;
  endDatetime?: string;
  timezone?: string;
  saleStartDatetime?: string;
  saleEndDatetime?: string;
}

export interface OrganizerEventConfig {
  minTicketsPerOrder?: number;
  maxTicketsPerOrder?: number;
  maxTicketsPerBuyer?: number;
  visibility?: OrganizerVisibility | string;
}

export interface OrganizerEventStats {
  viewCount?: number;
  ticketsSold?: number;
  totalCapacity?: number;
}

export interface OrganizerMiniOrganizer {
  id?: string;
  userId?: string;
  name?: string;
  slug?: string;
  logoUrl?: string;
}

export interface OrganizerPublicTicketType {
  id: string;
  eventSectorId?: string | null;
  sectorId?: string | null;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number | null;
  currency?: string;
  quantityTotal?: number;
  quantityAvailable?: number;
  quantityReserved?: number;
  maxPerOrder?: number;
  maxPerBuyer?: number;
  inventoryMode?: string;
  saleStartDatetime?: string;
  saleEndDatetime?: string;
  seatSelectionEnabled?: boolean;
  status?: string;
  colorCode?: string;
  displayOrder?: number;
}

export interface OrganizerEventDetail {
  id: string;
  title: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  tags?: string[];
  images?: OrganizerEventImageSummary[];
  categories?: OrganizerEventCategory[];
  venue?: OrganizerEventVenue | null;
  schedule?: OrganizerEventSchedule;
  organizer?: OrganizerMiniOrganizer;
  ticketTypes?: OrganizerPublicTicketType[];
  config?: OrganizerEventConfig;
  statistics?: OrganizerEventStats;
  status?: string;
  isFeatured?: boolean;
  isOnline?: boolean;
  onlineEventUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizerEventPayload {
  title: string;
  shortDescription?: string;
  description?: string;
  tags?: string[];
  startDatetime: string;
  endDatetime: string;
  timezone?: string;
  venueId?: string;
  isOnline?: boolean;
  onlineEventUrl?: string;
  categoryIds?: string[];
  saleStartDatetime?: string;
  saleEndDatetime?: string;
  minTicketsPerOrder?: number;
  maxTicketsPerOrder?: number;
  visibility?: OrganizerVisibility | string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}

export interface OrganizerTicketType {
  id: string;
  eventId: string;
  eventSectorId?: string | null;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number | null;
  currency?: string;
  quantityTotal?: number;
  quantityAvailable?: number;
  quantityReserved?: number;
  maxPerOrder?: number;
  maxPerBuyer?: number;
  inventoryMode?: string;
  seatSelectionEnabled?: boolean;
  saleStartDatetime?: string;
  saleEndDatetime?: string;
  colorCode?: string;
  displayOrder?: number;
  status?: OrganizerTicketStatus | string;
  isVisible?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizerTicketTypePayload {
  name: string;
  description?: string;
  price: number;
  originalPrice?: number | null;
  quantityTotal: number;
  maxPerOrder?: number;
  saleStartDatetime?: string;
  saleEndDatetime?: string;
  seatSelectionEnabled?: boolean;
  colorCode?: string;
  displayOrder?: number;
  eventSectorId?: string | null;
  isVisible?: boolean;
}

export interface OrganizerEventLayout {
  id: string;
  eventId: string;
  name?: string;
  backgroundImageUrl?: string;
  backgroundPublicId?: string;
  backgroundWidth?: number;
  backgroundHeight?: number;
  mapConfig?: Record<string, unknown>;
  sourceType?: LayoutSourceType | string;
  sourceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizerLayoutPayload {
  name?: string;
  backgroundImageUrl?: string;
  backgroundPublicId?: string;
  backgroundWidth?: number;
  backgroundHeight?: number;
  mapConfig?: Record<string, unknown>;
  sourceType?: LayoutSourceType | string;
  sourceId?: string;
}

export interface OrganizerSeatMap {
  layoutId?: string;
  backgroundImageUrl?: string;
  backgroundWidth?: number;
  backgroundHeight?: number;
  mapConfig?: Record<string, unknown>;
  sectors?: OrganizerSeatSector[];
}

export interface OrganizerSeatSector {
  id: string;
  name: string;
  code?: string | null;
  sectorType?: string;
  totalCapacity?: number;
  mapData?: Record<string, unknown>;
  colorCode?: string;
  displayOrder?: number | null;
  isActive?: boolean | null;
  seatsData?: OrganizerSeat[];
}

export interface OrganizerSeat {
  id: string;
  rowName?: string;
  seatNumber?: string;
  seatLabel?: string;
  coordX?: number;
  coordY?: number;
  ticketTypeId?: string | null;
  colorCode?: string | null;
  seatType?: string;
  isActive?: boolean;
  inventoryStatus?: string;
}

export interface OrganizerSeatPublishPayload {
  id: string;
  rowName?: string;
  seatNumber?: string;
  seatLabel?: string;
  coordX: number;
  coordY: number;
  ticketTypeId?: string;
  colorCode?: string;
  seatType?: string;
  isActive?: boolean;
  coordMetadata?: Record<string, unknown>;
}

export interface OrganizerSeatSectorPublishPayload {
  id: string;
  name: string;
  code?: string;
  sectorType?: string;
  totalCapacity?: number;
  colorCode?: string;
  visible?: boolean;
  displayOrder?: number;
  mapData?: Record<string, unknown>;
  seats?: OrganizerSeatPublishPayload[];
}

export interface OrganizerSeatMapPublishPayload {
  name?: string;
  backgroundImageUrl?: string;
  backgroundPublicId?: string;
  backgroundWidth?: number;
  backgroundHeight?: number;
  mapConfig?: Record<string, unknown>;
  sectors?: OrganizerSeatSectorPublishPayload[];
}

async function getVenuesWithFallback(): Promise<OrganizerVenue[]> {
  try {
    const response = await axiosClient.get<OrganizerVenue[]>("/api/venues");
    return response.data;
  } catch {
    const directResponse = await coreDirectClient.get<OrganizerVenue[]>("/api/venues");
    return directResponse.data;
  }
}

async function getCategories(): Promise<Category[]> {
  const response = await axiosClient.get<Category[]>("/api/categories");
  return response.data;
}

export const organizerWorkspaceService = {
  getCategories,

  getVenues: getVenuesWithFallback,

  getMyEvents: async (
    page = 0,
    size = 12,
    sort = "createdAt,desc",
  ): Promise<SpringPage<OrganizerEventDetail>> => {
    const response = await axiosClient.get<SpringPage<OrganizerEventDetail>>(
      "/api/organizer/events",
      {
        params: { page, size, sort },
      },
    );
    return response.data;
  },

  getMyEvent: async (eventId: string): Promise<OrganizerEventDetail> => {
    const response = await axiosClient.get<OrganizerEventDetail>(
      `/api/organizer/events/${eventId}`,
    );
    return response.data;
  },

  createEvent: async (payload: OrganizerEventPayload): Promise<OrganizerEventDetail> => {
    const response = await axiosClient.post<OrganizerEventDetail>(
      "/api/organizer/events",
      payload,
    );
    return response.data;
  },

  updateEvent: async (
    eventId: string,
    payload: Partial<OrganizerEventPayload>,
  ): Promise<OrganizerEventDetail> => {
    const response = await axiosClient.put<OrganizerEventDetail>(
      `/api/organizer/events/${eventId}`,
      payload,
    );
    return response.data;
  },

  publishEvent: async (eventId: string): Promise<OrganizerEventDetail> => {
    const response = await axiosClient.patch<OrganizerEventDetail>(
      `/api/organizer/events/${eventId}/publish`,
    );
    return response.data;
  },

  cancelEvent: async (eventId: string): Promise<OrganizerEventDetail> => {
    const response = await axiosClient.patch<OrganizerEventDetail>(
      `/api/organizer/events/${eventId}/cancel`,
    );
    return response.data;
  },

  deleteEvent: async (eventId: string): Promise<void> => {
    await axiosClient.delete(`/api/organizer/events/${eventId}`);
  },

  getTicketTypes: async (eventId: string): Promise<OrganizerTicketType[]> => {
    const response = await axiosClient.get<OrganizerTicketType[]>(
      `/api/organizer/events/${eventId}/ticket-types`,
    );
    return response.data;
  },

  createTicketType: async (
    eventId: string,
    payload: OrganizerTicketTypePayload,
  ): Promise<OrganizerTicketType> => {
    const response = await axiosClient.post<OrganizerTicketType>(
      `/api/organizer/events/${eventId}/ticket-types`,
      payload,
    );
    return response.data;
  },

  updateTicketType: async (
    eventId: string,
    ticketTypeId: string,
    payload: OrganizerTicketTypePayload,
  ): Promise<OrganizerTicketType> => {
    const response = await axiosClient.put<OrganizerTicketType>(
      `/api/organizer/events/${eventId}/ticket-types/${ticketTypeId}`,
      payload,
    );
    return response.data;
  },

  deleteTicketType: async (eventId: string, ticketTypeId: string): Promise<void> => {
    await axiosClient.delete(
      `/api/organizer/events/${eventId}/ticket-types/${ticketTypeId}`,
    );
  },

  getLayout: async (eventId: string): Promise<OrganizerEventLayout | null> => {
    try {
      const response = await axiosClient.get<OrganizerEventLayout>(
        `/api/organizer/events/${eventId}/layout`,
      );
      return response.data;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        return null;
      }
      throw error;
    }
  },

  createLayout: async (
    eventId: string,
    payload: OrganizerLayoutPayload,
  ): Promise<OrganizerEventLayout> => {
    const response = await axiosClient.post<OrganizerEventLayout>(
      `/api/organizer/events/${eventId}/layout`,
      payload,
    );
    return response.data;
  },

  updateLayout: async (
    eventId: string,
    payload: OrganizerLayoutPayload,
  ): Promise<OrganizerEventLayout> => {
    const response = await axiosClient.put<OrganizerEventLayout>(
      `/api/organizer/events/${eventId}/layout`,
      payload,
    );
    return response.data;
  },

  deleteLayout: async (eventId: string): Promise<void> => {
    await axiosClient.delete(`/api/organizer/events/${eventId}/layout`);
  },

  getSeatMap: async (eventId: string): Promise<OrganizerSeatMap | null> => {
    try {
      const response = await axiosClient.get<OrganizerSeatMap>(
        `/api/organizer/events/${eventId}/seat-map`,
      );
      return response.data;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        return null;
      }
      throw error;
    }
  },

  publishSeatMap: async (
    eventId: string,
    payload: OrganizerSeatMapPublishPayload,
  ): Promise<OrganizerSeatMap> => {
    const response = await axiosClient.post<OrganizerSeatMap>(
      `/api/organizer/events/${eventId}/seat-map/publish`,
      payload,
    );
    return response.data;
  },

  getOrganizerByUserIdDirect: async (userId: string) => {
    try {
      const response = await gatewayFallbackClient.get(`/api/organizers/by-user/${userId}`);
      return response.data;
    } catch {
      const response = await userDirectClient.get(`/api/organizers/by-user/${userId}`);
      return response.data;
    }
  },
};
