import axiosClient from "../lib/axiosClient";
import {
  SeatInventory,
  Reservation,
  OrderResponse,
  VenueSector,
} from "../types/api";

export interface CreateReservationRequest {
  eventId: string;
  items: {
    ticketTypeId: string;
    quantity: number;
    seatIds?: string[];
  }[];
}

export interface CreateOrderRequest {
  reservationId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  promotionCode?: string;
  customerNote?: string;
}

export const bookingService = {
  // Get seat inventory for an event (seat map)
  getEventSeats: async (eventId: string) => {
    const response = await axiosClient.get<SeatInventory[]>(
      `/api/v1/events/${eventId}/seats`,
    );
    return response.data;
  },

  // Get venue sectors for an event
  getEventSectors: async (eventId: string) => {
    const response = await axiosClient.get<VenueSector[]>(
      `/api/v1/events/${eventId}/sectors`,
    );
    return response.data;
  },

  // Lock a seat (temporary hold while selecting)
  lockSeat: async (eventId: string, seatId: string) => {
    const response = await axiosClient.post<{ success: boolean }>(
      `/api/v1/events/${eventId}/seats/${seatId}/lock`,
    );
    return response.data;
  },

  // Unlock a seat
  unlockSeat: async (eventId: string, seatId: string) => {
    const response = await axiosClient.post<{ success: boolean }>(
      `/api/v1/events/${eventId}/seats/${seatId}/unlock`,
    );
    return response.data;
  },

  // Create a reservation (hold tickets/seats for checkout)
  createReservation: async (data: CreateReservationRequest) => {
    const response = await axiosClient.post<Reservation>(
      "/api/v1/reservations",
      data,
    );
    return response.data;
  },

  // Create an order from a reservation
  createOrder: async (data: CreateOrderRequest) => {
    const response = await axiosClient.post<OrderResponse>(
      "/api/v1/orders",
      data,
    );
    return response.data;
  },
};
