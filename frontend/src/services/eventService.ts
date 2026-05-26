import axiosClient from "../lib/axiosClient";
import { EventSummary, PublicSeatMap, SpringPage, TicketType } from "../types/api";

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getMinTicketPrice(ticketTypes?: TicketType[]): number | undefined {
  const prices = (ticketTypes || [])
    .filter((ticketType) => ticketType.status === "ACTIVE" && ticketType.isVisible !== false)
    .map((ticketType) => toNumber(ticketType.price))
    .filter((price): price is number => typeof price === "number");

  return prices.length > 0 ? Math.min(...prices) : undefined;
}

async function enrichMissingMinPrice(event: EventSummary): Promise<EventSummary> {
  const minPrice = toNumber(event.minPrice) ?? getMinTicketPrice(event.ticketTypes);
  if (typeof minPrice === "number") {
    return { ...event, minPrice };
  }

  const idOrSlug = event.slug || event.id;
  if (!idOrSlug) {
    return event;
  }

  try {
    const response = await axiosClient.get<EventSummary>(`/api/events/${idOrSlug}`);
    const detail = response.data;
    const detailMinPrice =
      toNumber(detail.minPrice) ?? getMinTicketPrice(detail.ticketTypes);

    return typeof detailMinPrice === "number"
      ? { ...event, minPrice: detailMinPrice }
      : event;
  } catch {
    return event;
  }
}

async function enrichPageMinPrices(
  page: SpringPage<EventSummary>,
): Promise<SpringPage<EventSummary>> {
  const content = await Promise.all(page.content.map(enrichMissingMinPrice));
  return { ...page, content };
}

async function enrichListMinPrices(events: EventSummary[]): Promise<EventSummary[]> {
  return Promise.all(events.map(enrichMissingMinPrice));
}

export const eventService = {
  // Get all events with filters
  getEvents: async (params?: Record<string, any>) => {
    const response = await axiosClient.get<SpringPage<EventSummary>>(
      "/api/events",
      { params },
    );
    return enrichPageMinPrices(response.data);
  },

  // Get featured events
  getFeaturedEvents: async (limit = 8) => {
    const response = await axiosClient.get<EventSummary[]>(
      "/api/events/featured",
      {
        params: { limit },
      },
    );
    return enrichListMinPrices(response.data);
  },

  // Get event by Slug or ID
  getEventDetails: async (idOrSlug: string) => {
    const response = await axiosClient.get<any>(`/api/events/${idOrSlug}`);
    return response.data;
  },

  getSeatMap: async (idOrSlug: string): Promise<PublicSeatMap | null> => {
    try {
      const response = await axiosClient.get<PublicSeatMap>(
        `/api/events/${idOrSlug}/seat-map`,
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
};
