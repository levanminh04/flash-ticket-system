import axiosClient from "../lib/axiosClient";

export interface ChatRequestPayload {
  sessionId: string;
  message: string;
}

export interface ChatResponsePayload {
  sessionId: string;
  message: string;
  mood?: string | null;
  ragStrategy?: string | null;
}

export const chatService = {
  sendMessage: async (
    payload: ChatRequestPayload,
  ): Promise<ChatResponsePayload> => {
    const response = await axiosClient.post<ChatResponsePayload>(
      "/api/chat",
      payload,
    );
    return response.data;
  },
};

