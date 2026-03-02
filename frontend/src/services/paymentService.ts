import axiosClient from "../lib/axiosClient";
import { PaymentUrlResponse, PaymentResult } from "../types/api";

export const paymentService = {
  // Create VNPay payment URL
  createPaymentUrl: async (orderId: string) => {
    const response = await axiosClient.post<PaymentUrlResponse>(
      "/api/payments/create-url",
      { orderId },
    );
    return response.data;
  },

  // Get payment result (verify callback from VNPay)
  getPaymentResult: async (queryParams: string) => {
    const response = await axiosClient.get<PaymentResult>(
      `/api/payments/result?${queryParams}`,
    );
    return response.data;
  },
};
