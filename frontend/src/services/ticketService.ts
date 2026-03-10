import axiosClient from "../lib/axiosClient";

export interface TicketSummary {
  id: string;
  ticketCode: string;
  orderId: string;
  eventId: string;
  eventTitle: string;
  eventStartDatetime: string;
  eventVenueName?: string | null;
  ticketTypeId: string;
  ticketTypeName: string;
  seatLabel?: string | null;
  holderName?: string | null;
  holderEmail?: string | null;
  price: number;
  qrCodeData?: string | null;
  status: "VALID" | "USED" | "CANCELLED";
  checkedInAt?: string | null;
  createdAt: string;
}

export interface TicketsPageResponse {
  content: TicketSummary[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export const ticketService = {
  getMyTickets: async (page = 0, size = 10): Promise<TicketsPageResponse> => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    const response = await axiosClient.get<TicketsPageResponse>(
      `/api/tickets/my-tickets?${params}`
    );
    return response.data;
  },

  getTicketDetail: async (ticketId: string): Promise<TicketSummary | null> => {
    try {
      const response = await axiosClient.get<TicketSummary>(`/api/tickets/${ticketId}`);
      return response.data;
    } catch {
      return null;
    }
  },
};
