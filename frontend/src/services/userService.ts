import axiosClient from "../lib/axiosClient";

export interface UserProfile {
  id?: string;
  keycloakId?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  email?: string;
  emailVerified?: boolean | null;
  phone?: string;
  phoneVerified?: boolean | null;
  roles?: string[];
  status?: string;
  organizerProfileId?: string | null;
  language?: string | null;
  timezone?: string | null;
  currency?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: string;
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
      const response = await axiosClient.put<UserProfileApiResponse>(
        "/api/users/me/profile",
        data,
      );
      return unwrapUserProfileResponse(response.data);
    } catch {
      return null;
    }
  },

  uploadAvatar: async (file: File): Promise<UserProfile | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axiosClient.post<UserProfileApiResponse>(
        "/api/users/me/avatar",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return unwrapUserProfileResponse(response.data);
    } catch {
      return null;
    }
  },
};
