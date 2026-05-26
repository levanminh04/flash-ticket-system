import { FormEvent, useEffect, useMemo, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import {
  CalendarDays,
  Flame,
  LoaderCircle,
  MapPin,
  MessageCircle,
  ReceiptText,
  SendHorizontal,
  Ticket,
  X,
} from "lucide-react";
import { RiRobot2Fill } from "react-icons/ri";
import { chatService } from "../../services/chatService";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: number;
};

export const CHATBOT_PROMPT_EVENT = "flashTicket:chatbotPrompt";

const quickActions = [
  {
    label: "Sự kiện HOT",
    prompt: "Hiển thị các sự kiện HOT đang có trong hệ thống.",
    icon: Flame,
  },
  {
    label: "Sắp diễn ra",
    prompt: "Liệt kê các sự kiện sắp diễn ra gần nhất.",
    icon: CalendarDays,
  },
  {
    label: "Tìm theo địa điểm",
    prompt: "Tìm sự kiện theo địa điểm và thành phố đang có trong database.",
    icon: MapPin,
  },
  {
    label: "Loại vé còn bán",
    prompt: "Cho tôi xem các sự kiện còn loại vé đang mở bán.",
    icon: Ticket,
  },
  {
    label: "Kiểm tra đơn vé",
    prompt: "Kiểm tra các đơn vé gần đây của tôi.",
    icon: ReceiptText,
  },
  {
    label: "Hướng dẫn đặt vé",
    prompt: "Hướng dẫn tôi cách tìm sự kiện, chọn vé và thanh toán.",
    icon: MessageCircle,
  },
];

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
              <article
                key={msg.id}
                className={`floating-msg floating-msg--${msg.role}${
                  msg.id === "welcome" ? " floating-msg--welcome" : ""
                }`}
              >
                {msg.role === "assistant" ? (
                  <span className="floating-msg-icon">
                    <RiRobot2Fill size={20} color="#10B981" />
                  </span>
                ) : null}
                <div className="floating-msg-body">
                  <p>{msg.text}</p>
                  {msg.id === "welcome" ? (
                    <div className="floating-chatbot-options">
                      {quickActions.map((action) => {
                        const Icon = action.icon;

                        return (
                          <button
                            key={action.label}
                            type="button"
                            onClick={() => void send(action.prompt)}
                            disabled={sending}
                          >
                            <Icon size={16} />
                            <span>{action.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <span className="floating-msg-time">{formatChatTime(msg.createdAt)}</span>
                </div>
              </article>
            ))}
            {sending ? (
              <div className="floating-msg floating-msg--assistant">
                <span className="floating-msg-icon">
                  <RiRobot2Fill size={20} color="#10B981" />
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
