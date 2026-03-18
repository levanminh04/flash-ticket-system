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

type UserProfileApiResponse = UserProfile | { data?: UserProfile };

function unwrapUserProfileResponse(payload: UserProfileApiResponse | null | undefined): UserProfile | null {
  if (!payload) return null;
  if (Object.prototype.hasOwnProperty.call(payload, "data")) {
    return (payload as { data?: UserProfile }).data ?? null;
  }

  return payload as UserProfile;
}

export const userService = {
  getProfile: async (): Promise<UserProfile | null> => {
    try {
      const response = await axiosClient.get<UserProfileApiResponse>("/api/users/me");
      return unwrapUserProfileResponse(response.data);
    } catch {
      return null;
    }
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfile | null> => {
    try {
      const response = await axiosClient.patch<UserProfileApiResponse>("/api/users/me", data);
      return unwrapUserProfileResponse(response.data);
    } catch {
      return null;
    }
  },
};
