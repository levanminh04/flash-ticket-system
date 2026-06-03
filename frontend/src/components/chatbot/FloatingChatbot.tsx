import {
  FormEvent,
  Fragment,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useTranslation } from "react-i18next";
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

function formatChatTime(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function renderInlineText(text: string) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*)/g;
  let lastIndex = 0;

  text.replace(pattern, (match, _group, index) => {
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    parts.push(<strong key={`${match}-${index}`}>{match.slice(2, -2)}</strong>);
    lastIndex = index + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function ChatMessageText({ text }: { text: string }) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {listItems.map((item, index) => (
            <li key={`${item}-${index}`}>{renderInlineText(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }

    if (orderedItems.length > 0) {
      blocks.push(
        <ol key={`ol-${blocks.length}`}>
          {orderedItems.map((item, index) => (
            <li key={`${item}-${index}`}>{renderInlineText(item)}</li>
          ))}
        </ol>,
      );
      orderedItems = [];
    }
  };

  lines.forEach((line, index) => {
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);

    if (bullet) {
      if (orderedItems.length > 0) {
        flushList();
      }
      listItems.push(bullet[1]);
      return;
    }

    if (ordered) {
      if (listItems.length > 0) {
        flushList();
      }
      orderedItems.push(ordered[1]);
      return;
    }

    flushList();
    blocks.push(<p key={`p-${index}`}>{renderInlineText(line)}</p>);
  });

  flushList();

  return <>{blocks.map((block, index) => <Fragment key={index}>{block}</Fragment>)}</>;
}

export default function FloatingChatbot() {
  const { keycloak } = useKeycloak();
  const { i18n, t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const [opened, setOpened] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      text: t("chatbot.welcomeMessage"),
      createdAt: Date.now(),
    },
  ]);

  const quickActions = useMemo(
    () => [
      {
        label: t("chatbot.quickHot"),
        prompt: t("chatbot.quickHotPrompt"),
        icon: Flame,
      },
      {
        label: t("chatbot.quickUpcoming"),
        prompt: t("chatbot.quickUpcomingPrompt"),
        icon: CalendarDays,
      },
      {
        label: t("chatbot.quickLocation"),
        prompt: t("chatbot.quickLocationPrompt"),
        icon: MapPin,
      },
      {
        label: t("chatbot.quickTicketTypes"),
        prompt: t("chatbot.quickTicketTypesPrompt"),
        icon: Ticket,
      },
      {
        label: t("chatbot.quickCheckOrders"),
        prompt: t("chatbot.quickCheckOrdersPrompt"),
        icon: ReceiptText,
      },
      {
        label: t("chatbot.quickGuide"),
        prompt: t("chatbot.quickGuidePrompt"),
        icon: MessageCircle,
      },
    ],
    [t],
  );

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  useEffect(() => {
    if (!opened) return;

    const messagesElement = messagesRef.current;
    if (!messagesElement) return;

    requestAnimationFrame(() => {
      messagesElement.scrollTo({
        top: messagesElement.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [messages, opened, sending]);

  useEffect(() => {
    if (!opened) return;

    const handlePointerDown = (event: PointerEvent) => {
      const rootElement = rootRef.current;
      if (!rootElement || rootElement.contains(event.target as Node)) {
        return;
      }

      setOpened(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [opened]);

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
          text: t("chatbot.loginRequired"),
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
          text: res.message || t("chatbot.fallbackMessage"),
          createdAt: Date.now(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: t("chatbot.busyMessage"),
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
    setMessages((prev) =>
      prev.map((message) =>
        message.id === "welcome"
          ? { ...message, text: t("chatbot.welcomeMessage") }
          : message,
      ),
    );
  }, [t]);

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
    <div className="floating-chatbot" ref={rootRef}>
      {opened ? (
        <section className="floating-chatbot-panel">
          <header className="floating-chatbot-header">
            <div>
              <strong>FlashTicket Assistant</strong>
            </div>
            <button type="button" onClick={() => setOpened(false)} aria-label={t("chatbot.close")}>
              <X size={16} />
            </button>
          </header>

          <div className="floating-chatbot-messages" ref={messagesRef}>
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
                  <div className="floating-msg-text">
                    <ChatMessageText text={msg.text} />
                  </div>
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
                  <span className="floating-msg-time">
                    {formatChatTime(msg.createdAt, i18n.resolvedLanguage || "vi")}
                  </span>
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
                    {t("chatbot.replying")}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <form className="floating-chatbot-input" onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("chatbot.placeholder")}
              maxLength={2000}
            />
            <button type="submit" disabled={!canSend} aria-label={t("chatbot.send")}>
              <SendHorizontal size={16} />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="floating-chatbot-trigger"
        onClick={() => setOpened((prev) => !prev)}
        aria-label={t("chatbot.open")}
      >
        <MessageCircle size={20} />
      </button>
    </div>
  );
}
