import axiosClient from "../lib/axiosClient";
import { gatewayFallbackClient, userDirectClient } from "../lib/internalServiceClients";
import { SpringPage } from "../types/api";

export type OrganizerImageType =
  | "BANNER"
  | "POSTER"
  | "SEAT_MAP"
  | "GALLERY"
  | "THUMBNAIL";

export interface OrganizerEventImage {
  id: string;
  imageUrl: string;
  publicId?: string | null;
  imageType: OrganizerImageType;
  altText?: string | null;
  displayOrder?: number | null;
  width?: number | null;
  height?: number | null;
  fileSizeBytes?: number | null;
  isPrimary?: boolean | null;
  createdAt?: string | null;
  createdBy?: string | null;
  isDeleted?: boolean | null;
}

export interface CheckInResponse {
  success: boolean;
  ticketCode: string;
  holderName: string;
  ticketTypeName: string;
  seatLabel: string;
  checkedInAt: string;
}

export interface OrganizerProfile {
  id: string;
  userId: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  isVerified?: boolean | null;
  createdAt?: string | null;
  totalEvents?: number | null;
  totalTicketsSold?: number | null;
  followerCount?: number | null;
  averageRating?: number | null;
  email?: string | null;
  phone?: string | null;
}

export interface ApplyOrganizerPayload {
  organizerName: string;
  organizerType: "INDIVIDUAL" | "COMPANY" | "NONPROFIT" | "GOVERNMENT";
  description?: string | null;
  websiteUrl?: string | null;
  contactEmail: string;
  contactPhone: string;
  taxCode?: string | null;
  representativeName?: string | null;
}

export interface FollowResponse {
  organizerProfileId: string;
  organizerName: string;
  isFollowing: boolean;
  followerCount: number;
}

export interface VerifyOrganizerPayload {
  approved: boolean;
  rejectionReason?: string | null;
}

export interface OrganizerEventImageUpdatePayload {
  altText?: string | null;
  displayOrder?: number | null;
  imageType?: OrganizerImageType | null;
}

async function userServicePost<TResponse, TPayload>(
  path: string,
  payload?: TPayload,
): Promise<TResponse> {
  try {
    const response = await gatewayFallbackClient.post<TResponse>(path, payload);
    return response.data;
  } catch {
    const response = await userDirectClient.post<TResponse>(path, payload);
    return response.data;
  }
}

async function userServiceDelete<TResponse>(path: string): Promise<TResponse> {
  try {
    const response = await gatewayFallbackClient.delete<TResponse>(path);
    return response.data;
  } catch {
    const response = await userDirectClient.delete<TResponse>(path);
    return response.data;
  }
}

async function userServicePut<TResponse, TPayload>(
  path: string,
  payload: TPayload,
): Promise<TResponse> {
  try {
    const response = await gatewayFallbackClient.put<TResponse>(path, payload);
    return response.data;
  } catch {
    const response = await userDirectClient.put<TResponse>(path, payload);
    return response.data;
  }
}

async function uploadOrganizerProfileImage(
  path: "/api/organizers/me/logo" | "/api/organizers/me/banner",
  file: File,
): Promise<OrganizerProfile> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await gatewayFallbackClient.post<OrganizerProfile>(
      path,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  } catch {
    const response = await userDirectClient.post<OrganizerProfile>(
      path,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  }
}

export const organizerService = {
  applyForOrganizer: async (
    payload: ApplyOrganizerPayload,
  ): Promise<OrganizerProfile> =>
    userServicePost<OrganizerProfile, ApplyOrganizerPayload>(
      "/api/organizers/apply",
      payload,
    ),

  followOrganizer: async (organizerProfileId: string): Promise<FollowResponse> =>
    userServicePost<FollowResponse, undefined>(
      `/api/organizers/${encodeURIComponent(organizerProfileId)}/follow`,
    ),

  unfollowOrganizer: async (
    organizerProfileId: string,
  ): Promise<FollowResponse> =>
    userServiceDelete<FollowResponse>(
      `/api/organizers/${encodeURIComponent(organizerProfileId)}/follow`,
    ),

  isFollowingOrganizer: async (
    organizerProfileId: string,
  ): Promise<boolean> => {
    const path = `/api/organizers/${encodeURIComponent(organizerProfileId)}/is-following`;

    try {
      const response = await gatewayFallbackClient.get<{ isFollowing: boolean }>(path);
      return response.data.isFollowing;
    } catch {
      const response = await userDirectClient.get<{ isFollowing: boolean }>(path);
      return response.data.isFollowing;
    }
  },

  getAdminOrganizers: async (
    status = "PENDING",
    page = 0,
    size = 20,
  ): Promise<SpringPage<OrganizerProfile>> => {
    const params = { status, page, size };

    try {
      const response = await gatewayFallbackClient.get<SpringPage<OrganizerProfile>>(
        "/api/admin/organizers",
        { params },
      );
      return response.data;
    } catch {
      const response = await userDirectClient.get<SpringPage<OrganizerProfile>>(
        "/api/admin/organizers",
        { params },
      );
      return response.data;
    }
  },

  verifyOrganizer: async (
    organizerProfileId: string,
    payload: VerifyOrganizerPayload,
  ): Promise<OrganizerProfile> =>
    userServicePut<OrganizerProfile, VerifyOrganizerPayload>(
      `/api/admin/organizers/${encodeURIComponent(organizerProfileId)}/verify`,
      payload,
    ),

  getPublicOrganizerBySlug: async (slug: string): Promise<OrganizerProfile> => {
    const path = `/api/organizers/public/${encodeURIComponent(slug)}`;

    try {
      const response = await gatewayFallbackClient.get<OrganizerProfile>(path);
      return response.data;
    } catch {
      const response = await userDirectClient.get<OrganizerProfile>(path);
      return response.data;
    }
  },

  getMyOrganizerProfile: async (): Promise<OrganizerProfile> => {
    try {
      const response = await gatewayFallbackClient.get<OrganizerProfile>(
        "/api/organizers/me",
      );
      return response.data;
    } catch {
      const response = await userDirectClient.get<OrganizerProfile>(
        "/api/organizers/me",
      );
      return response.data;
    }
  },

  getOrganizerByUserId: async (userId: string): Promise<OrganizerProfile> => {
    const path = `/api/internal/organizers/by-user/${encodeURIComponent(userId)}`;

    try {
      const response = await gatewayFallbackClient.get<OrganizerProfile>(path);
      return response.data;
    } catch {
      const response = await userDirectClient.get<OrganizerProfile>(path);
      return response.data;
    }
  },

  uploadLogo: async (file: File): Promise<OrganizerProfile> =>
    uploadOrganizerProfileImage("/api/organizers/me/logo", file),

  uploadBanner: async (file: File): Promise<OrganizerProfile> =>
    uploadOrganizerProfileImage("/api/organizers/me/banner", file),

  getEventImages: async (eventId: string): Promise<OrganizerEventImage[]> => {
    const response = await axiosClient.get<OrganizerEventImage[]>(
      `/api/organizer/events/${eventId}/images`,
    );
    return response.data;
  },

  uploadEventImage: async (
    eventId: string,
    file: File,
    imageType: OrganizerImageType,
  ): Promise<OrganizerEventImage> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("imageType", imageType);

    const response = await axiosClient.post<OrganizerEventImage>(
      `/api/organizer/events/${eventId}/images`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  deleteEventImage: async (eventId: string, imageId: string): Promise<void> => {
    await axiosClient.delete(`/api/organizer/events/${eventId}/images/${imageId}`);
  },

  updateEventImage: async (
    eventId: string,
    imageId: string,
    payload: OrganizerEventImageUpdatePayload,
  ): Promise<OrganizerEventImage> => {
    const response = await axiosClient.patch<OrganizerEventImage>(
      `/api/organizer/events/${eventId}/images/${imageId}`,
      payload,
    );
    return response.data;
  },

  checkInTicket: async (
    qrData: string,
    location: string,
  ): Promise<CheckInResponse> => {
    const response = await axiosClient.post<CheckInResponse>(
      "/api/tickets/checkin",
      {
        qrData,
        location,
      },
    );
    return response.data;
  },
};
