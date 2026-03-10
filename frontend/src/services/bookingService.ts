import axiosClient from "../lib/axiosClient";

export interface BookingItemRequest {
  ticketTypeId: string;
  quantity: number;
  seatIds?: string[];
}

export interface CreateBookingRequest {
  eventId: string;
  items: BookingItemRequest[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  promotionCode?: string;
  customerNote?: string;
}

export interface BookingResponseItem {
  id: string;
  ticketTypeId: string;
  ticketTypeName: string;
  sectorName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface BookingResponse {
  orderId: string;
  orderNumber: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  expiresAt: string;
  status: string;
  items: BookingResponseItem[];
}

export const bookingService = {
  // Backend source hiện tại: chỉ có POST /api/bookings
  createBooking: async (
    data: CreateBookingRequest,
  ): Promise<BookingResponse> => {
    const response = await axiosClient.post<BookingResponse>(
      "/api/bookings",
      data,
    );
    return response.data;
  },
};
