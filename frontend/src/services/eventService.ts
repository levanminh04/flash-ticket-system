import axiosClient from "../lib/axiosClient";
import { EventSummary, PublicSeatMap, SpringPage } from "../types/api";

export const eventService = {
  // Get all events with filters
  getEvents: async (params?: Record<string, any>) => {
    const response = await axiosClient.get<SpringPage<EventSummary>>(
      "/api/events",
      { params },
    );
    return response.data;
  },

  // Get featured events
  getFeaturedEvents: async (limit = 8) => {
    const response = await axiosClient.get<EventSummary[]>(
      "/api/events/featured",
      {
        params: { limit },
      },
    );
    return response.data;
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
