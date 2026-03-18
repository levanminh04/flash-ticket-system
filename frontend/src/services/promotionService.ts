import axiosClient from "../lib/axiosClient";
import { PromotionValidation } from "../types/api";

export const promotionService = {
  // Validate a voucher/promotion code
  validateVoucher: async (
    code: string,
    eventId: string,
    orderValue: number,
  ) => {
    const response = await axiosClient.post<PromotionValidation>(
      "/api/promotions/validate",
      { code, eventId, orderValue },
    );
    return response.data;
  },
};
