import axiosClient from "../lib/axiosClient";
import { Category } from "../types/api";

export const categoryService = {
  getCategories: async () => {
    const response = await axiosClient.get<Category[]>("/api/categories");
    return response.data;
  },

  getCategoryBySlug: async (slug: string) => {
    const response = await axiosClient.get<Category>(`/api/categories/${slug}`);
    return response.data;
  },
};
