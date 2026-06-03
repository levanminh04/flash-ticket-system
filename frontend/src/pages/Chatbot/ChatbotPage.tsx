import { FormEvent, Fragment, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link, useNavigate } from "react-router-dom";
import { Bot, LoaderCircle, SendHorizontal, Sparkles, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";
import AccountSidebar from "../../components/account/AccountSidebar";
import { chatService } from "../../services/chatService";
import {
  discoveryService,
  type DiscoverySearchResponse,
} from "../../services/discoveryService";

type ChatRole = "assistant" | "user";
type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  mood?: string | null;
  discovery?: DiscoverySearchResponse | null;
};

function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildDiscoverySummary(
  discovery: DiscoverySearchResponse | null,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!discovery) {
    return "";
  }

  if (discovery.resultCount <= 0) {
    return t("chatbot.discoveryEmpty");
  }

  return t("chatbot.discoveryFound", { count: discovery.resultCount });
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
    blocks.push(
      <p key={`p-${index}`}>
        {renderInlineText(line)}
      </p>,
    );
  });

  flushList();

  return <>{blocks.map((block, index) => <Fragment key={index}>{block}</Fragment>)}</>;
}

export default function ChatbotPage() {
  const { t } = useTranslation();
  const { keycloak } = useKeycloak();
  const navigate = useNavigate();
  const pageContentRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const [sessionId] = useState(generateSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: t("chatbot.welcomeFullPage"),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastStrategy, setLastStrategy] = useState<string | null>(null);

  const starterPrompts = useMemo(
    () => [
      t("chatbot.starterRock"),
      t("chatbot.starterGroup"),
      t("chatbot.starterRefund"),
      t("chatbot.starterOutdoor"),
    ],
    [t],
  );

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;

    requestAnimationFrame(() => {
      messagesElement.scrollTo({
        top: messagesElement.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [messages, sending]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const contentElement = pageContentRef.current;
      if (!contentElement || contentElement.contains(event.target as Node)) {
        return;
      }

      if (window.history.state?.idx > 0) {
        navigate(-1);
        return;
      }

      navigate("/");
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [navigate]);

  const submitMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);

    try {
      const [discoveryResult, chatResult] = await Promise.allSettled([
        discoveryService.search(trimmed),
        chatService.sendMessage({ sessionId, message: trimmed }),
      ]);

      const discovery =
        discoveryResult.status === "fulfilled" ? discoveryResult.value : null;

      if (chatResult.status === "rejected" && !discovery) {
        throw chatResult.reason;
      }

      const chatResponse =
        chatResult.status === "fulfilled" ? chatResult.value : null;
      const discoverySummary = buildDiscoverySummary(discovery, t);

      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text:
            chatResponse?.message ||
            discoverySummary ||
            t("chatbot.fallbackMessage"),
          mood: chatResponse?.mood,
          discovery,
        },
      ]);
      setLastStrategy(chatResponse?.ragStrategy ?? discovery?.strategy ?? null);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: t("chatbot.fullPageBusy"),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitMessage(input);
  };

  if (!keycloak.authenticated) {
    return (
      <div className="chatbot-page">
        <AccountCategoryNav />
        <div className="container account-layout-container">
          <AccountSidebar />
          <section className="account-main-content">
            <div className="list-empty">
              <Bot size={44} />
              <p>{t("chatbot.fullPageLoginRequired")}</p>
              <button className="btn btn-primary" onClick={() => keycloak.login()}>
                {t("auth.signIn")}
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="chatbot-page">
      <AccountCategoryNav />
      <div className="container account-layout-container">
        <AccountSidebar />

        <section className="account-main-content">
          <div ref={pageContentRef}>
          <div className="chatbot-header-card">
            <div>
              <h1 className="page-title">{t("chatbot.fullPageTitle")}</h1>
              <p>{t("chatbot.fullPageIntro")}</p>
            </div>
            {lastStrategy ? (
              <span className="chatbot-strategy-badge">
                <Sparkles size={14} />
                {lastStrategy}
              </span>
            ) : null}
          </div>

          <div className="chatbot-shell">
            <div className="chatbot-messages" ref={messagesRef}>
              {messages.map((message) => (
                <article key={message.id} className={`chat-msg chat-msg--${message.role}`}>
                  <div className="chat-msg-icon">
                    {message.role === "assistant" ? <Bot size={15} /> : <User size={15} />}
                  </div>
                  <div className="chat-msg-bubble">
                    <div className="chat-msg-text">
                      <ChatMessageText text={message.text} />
                    </div>
                    {message.discovery && message.discovery.resultCount > 0 ? (
                      <div className="chat-msg-meta">
                        <span>
                          Discovery: {message.discovery.resultCount} {t("blog.titleHighlight").toLowerCase()}
                          {message.discovery.strategy ? ` - ${message.discovery.strategy}` : ""}
                        </span>
                        {message.discovery.results.slice(0, 3).map((result, index) => (
                          <Link
                            key={`${result.eventId || index}-${index}`}
                            to={result.eventId ? `/event/${result.eventId}` : "/search"}
                          >
                            {result.text || t("chatbot.result", { index: index + 1 })}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {message.mood && message.role === "assistant" ? (
                      <span className="chat-msg-meta">Mood: {message.mood}</span>
                    ) : null}
                  </div>
                </article>
              ))}
              {sending ? (
                <div className="chat-msg chat-msg--assistant">
                  <div className="chat-msg-icon">
                    <Bot size={15} />
                  </div>
                  <div className="chat-msg-bubble">
                    <span className="chatbot-typing">
                      <LoaderCircle size={14} className="spin" />
                      {t("chatbot.replying")}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="chatbot-prompts">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chatbot-prompt-btn"
                  onClick={() => void submitMessage(prompt)}
                  disabled={sending}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form className="chatbot-input-wrap" onSubmit={handleSubmit}>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t("chatbot.fullPagePlaceholder")}
                maxLength={2000}
              />
              <button type="submit" className="btn btn-primary" disabled={!canSend}>
                {sending ? <LoaderCircle size={16} className="spin" /> : <SendHorizontal size={16} />}
                {t("chatbot.send")}
              </button>
            </form>
          </div>

          <p className="chatbot-note">
            {t("chatbot.fullPageSearchHint")} <Link to="/search">{t("chatbot.fullPageSearchLink")}</Link>.
          </p>
          </div>
        </section>
      </div>
    </div>
  );
}
