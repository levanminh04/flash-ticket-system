import axiosClient from "../lib/axiosClient";
import { gatewayFallbackClient, userDirectClient } from "../lib/internalServiceClients";

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
  totalEvents?: number | null;
  totalTicketsSold?: number | null;
  followerCount?: number | null;
  averageRating?: number | null;
  email?: string | null;
  phone?: string | null;
}

export interface OrganizerEventImageUpdatePayload {
  altText?: string | null;
  displayOrder?: number | null;
  imageType?: OrganizerImageType | null;
}

export const organizerService = {
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
    const response = await axiosClient.get<OrganizerProfile>(
      `/api/organizers/by-user/${userId}`,
    );
    return response.data;
  },

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
