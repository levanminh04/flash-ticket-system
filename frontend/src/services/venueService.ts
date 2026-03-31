import axiosClient from "../lib/axiosClient";
import { Venue } from "../types/api";

export const venueService = {
  getVenues: async () => {
    const response = await axiosClient.get<Venue[]>("/api/venues");
    return response.data;
  },
};
