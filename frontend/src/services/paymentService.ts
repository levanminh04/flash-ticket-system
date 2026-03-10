import axiosClient from "../lib/axiosClient";

export interface PaymentInitResponse {
  transactionId: string;
  transactionNumber: string;
  paymentUrl: string;
  amount: number;
  provider: string;
  expiresAt: string;
}

export interface PaymentStatusTransaction {
  transactionNumber: string;
  status: string;
  amount: number;
  paymentMethod: string;
  responseCode: string;
  bankCode: string;
  initiatedAt: string;
  completedAt: string;
}

export interface PaymentStatusResponse {
  orderId: string;
  orderStatus: string;
  totalAmount: number;
  transactions: PaymentStatusTransaction[];
}

export const paymentService = {
  initiatePayment: async (
    orderId: string,
    bankCode?: string,
  ): Promise<PaymentInitResponse> => {
    const response = await axiosClient.post("/api/payments/initiate", {
      orderId,
      bankCode,
    });
    const data = response.data as any;
    return {
      transactionId: data.transactionId ?? data.transactionID ?? "",
      transactionNumber:
        data.transactionNumber ?? data.transaction_number ?? "",
      paymentUrl:
        data.paymentUrl ??
        data.paymentURL ??
        data.payment_url ??
        data.checkoutUrl ??
        data.checkout_url ??
        "",
      amount: Number(data.amount ?? 0),
      provider: data.provider ?? "VNPAY",
      expiresAt: data.expiresAt ?? data.expiredAt ?? "",
    };
  },
  getPaymentStatus: async (orderId: string): Promise<PaymentStatusResponse> => {
    const response = await axiosClient.get<PaymentStatusResponse>(
      `/api/payments/status/${orderId}`,
    );
    return response.data;
  },
};
