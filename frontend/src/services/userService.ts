import axiosClient from "../lib/axiosClient";

export interface UserProfile {
  id?: string;
  keycloakId?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string | null;
  email?: string;
  phone?: string;
  roles?: string[];
  status?: string;
}

export interface UpdateProfileRequest {
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
  };
  phone?: string;
}

export const userService = {
  getProfile: async (): Promise<UserProfile | null> => {
    try {
      const response = await axiosClient.get<{ data?: UserProfile }>("/api/users/me");
      return response.data?.data ?? response.data ?? null;
    } catch {
      return null;
    }
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfile | null> => {
    try {
      const response = await axiosClient.patch<{ data?: UserProfile }>("/api/users/me", data);
      return response.data?.data ?? response.data ?? null;
    } catch {
      return null;
    }
  },
};
