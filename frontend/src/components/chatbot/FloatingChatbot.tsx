import { FormEvent, useEffect, useMemo, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Bot, LoaderCircle, MessageCircle, SendHorizontal, X } from "lucide-react";
import { chatService } from "../../services/chatService";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: number;
};

export const CHATBOT_PROMPT_EVENT = "flashTicket:chatbotPrompt";

function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatChatTime(timestamp: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export default function FloatingChatbot() {
  const { keycloak } = useKeycloak();
  const [opened, setOpened] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Xin chào! Bạn cần mình hỗ trợ tìm sự kiện hay kiểm tra đơn vé?",
      createdAt: Date.now(),
    },
  ]);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || sending) return;

    const now = Date.now();

    setMessages((prev) => [...prev, { id: `u-${now}`, role: "user", text: value, createdAt: now }]);
    setInput("");

    if (!keycloak.authenticated) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${now + 1}`,
          role: "assistant",
          text: "Please log in to use FlashTicket Assistant.",
          createdAt: now + 1,
        },
      ]);
      return;
    }

    setSending(true);
    try {
      const res = await chatService.sendMessage({ sessionId, message: value });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res.message || "Mình chưa có phản hồi phù hợp.",
          createdAt: Date.now(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "Hiện tại chatbot đang bận, bạn thử lại sau ít phút.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await send(input);
  };

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail;
      if (!prompt) return;

      setOpened(true);
      void send(prompt);
    };

    window.addEventListener(CHATBOT_PROMPT_EVENT, handlePrompt);
    return () => window.removeEventListener(CHATBOT_PROMPT_EVENT, handlePrompt);
  }, [sending, keycloak.authenticated]);

  return (
    <div className="floating-chatbot">
      {opened ? (
        <section className="floating-chatbot-panel">
          <header className="floating-chatbot-header">
            <div>
              <strong>FlashTicket Assistant</strong>
            </div>
            <button type="button" onClick={() => setOpened(false)} aria-label="Đóng chat">
              <X size={16} />
            </button>
          </header>

          <div className="floating-chatbot-messages">
            {messages.map((msg) => (
              <article key={msg.id} className={`floating-msg floating-msg--${msg.role}`}>
                {msg.role === "assistant" ? (
                  <span className="floating-msg-icon">
                    <Bot size={14} />
                  </span>
                ) : null}
                <div className="floating-msg-body">
                  <p>{msg.text}</p>
                  <span className="floating-msg-time">{formatChatTime(msg.createdAt)}</span>
                </div>
              </article>
            ))}
            {sending ? (
              <div className="floating-msg floating-msg--assistant">
                <span className="floating-msg-icon">
                  <Bot size={14} />
                </span>
                <div className="floating-msg-body">
                  <p className="floating-msg-loading">
                    <LoaderCircle size={14} className="spin" />
                    Đang phản hồi...
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <form className="floating-chatbot-input" onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập tin nhắn..."
              maxLength={2000}
            />
            <button type="submit" disabled={!canSend} aria-label="Gửi">
              <SendHorizontal size={16} />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="floating-chatbot-trigger"
        onClick={() => setOpened((prev) => !prev)}
        aria-label="Mở chatbot"
      >
        <MessageCircle size={20} />
      </button>
    </div>
  );
}
