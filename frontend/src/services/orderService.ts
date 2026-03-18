import axiosClient from "../lib/axiosClient";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  eventId: string;
  eventTitle: string;
  eventStartDatetime: string;
  totalAmount: number;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED" | "EXPIRED";
  paymentMethod?: string | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface OrderItemDetail {
  id: string;
  ticketTypeId: string;
  ticketTypeName: string;
  sectorName?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderDetail extends OrderSummary {
  eventVenueName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  subtotal?: number;
  discountAmount?: number;
  promotionCode?: string | null;
  paidAt?: string | null;
  customerNote?: string | null;
  items?: OrderItemDetail[];
}

export interface OrdersPageResponse {
  content: OrderSummary[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export const orderService = {
  getMyOrders: async (page = 0, size = 10): Promise<OrdersPageResponse> => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    const response = await axiosClient.get<OrdersPageResponse>(
      `/api/orders/my-orders?${params}`
    );
    return response.data;
  },

  getOrderDetail: async (orderId: string): Promise<OrderDetail | null> => {
    try {
      const response = await axiosClient.get<OrderDetail>(`/api/orders/${orderId}`);
      return response.data;
    } catch {
      return null;
    }
  },

  cancelOrder: async (orderId: string): Promise<void> => {
    await axiosClient.delete(`/api/orders/${orderId}`);
  },
};
