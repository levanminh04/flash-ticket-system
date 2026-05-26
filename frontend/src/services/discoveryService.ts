import axiosClient from "../lib/axiosClient";

export interface DiscoverySearchResult {
  text: string;
  eventId: string;
  score: number;
}

export interface DiscoverySearchResponse {
  query: string;
  strategy?: string;
  resultCount: number;
  results: DiscoverySearchResult[];
}

export const discoveryService = {
  search: async (query: string): Promise<DiscoverySearchResponse> => {
    const response = await axiosClient.get<DiscoverySearchResponse>(
      "/api/discovery/search",
      {
        params: { q: query },
      },
    );
    return response.data;
  },
};
