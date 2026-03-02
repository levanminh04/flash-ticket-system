import axiosClient from "../lib/axiosClient";
import { EventSummary, SpringPage } from "../types/api";

export const eventService = {
  // Get all events with filters
  getEvents: async (params?: Record<string, any>) => {
    const response = await axiosClient.get<SpringPage<EventSummary>>(
      "/api/v1/events",
      { params },
    );
    return response.data;
  },

  // Get featured events
  getFeaturedEvents: async (limit = 8) => {
    const response = await axiosClient.get<EventSummary[]>(
      "/api/v1/events/featured",
      {
        params: { limit },
      },
    );
    return response.data;
  },

  // Get event by Slug or ID
  getEventDetails: async (idOrSlug: string) => {
    const response = await axiosClient.get<any>(`/api/v1/events/${idOrSlug}`);
    return response.data;
  },
};
