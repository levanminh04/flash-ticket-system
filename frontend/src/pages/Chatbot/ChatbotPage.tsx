import { FormEvent, useMemo, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import { Bot, LoaderCircle, SendHorizontal, Sparkles, User } from "lucide-react";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";
import AccountSidebar from "../../components/account/AccountSidebar";
import { chatService } from "../../services/chatService";

type ChatRole = "assistant" | "user";
type ChatMessage = { id: string; role: ChatRole; text: string; mood?: string | null };

const starterPrompts = [
  "Gợi ý sự kiện nhạc rock cuối tuần tại TP.HCM",
  "Tư vấn chọn vé phù hợp cho nhóm 4 người",
  "Cho mình biết cách hoàn vé khi không tham gia được",
];

function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ChatbotPage() {
  const { keycloak } = useKeycloak();
  const [sessionId] = useState(generateSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Xin chào, mình là trợ lý FlashTicket. Bạn cần tìm sự kiện, chọn vé hay hỗ trợ đơn hàng?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastStrategy, setLastStrategy] = useState<string | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

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
      const response = await chatService.sendMessage({ sessionId, message: trimmed });
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: response.message || "Mình chưa có phản hồi phù hợp.",
          mood: response.mood,
        },
      ]);
      setLastStrategy(response.ragStrategy ?? null);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "Hiện tại hệ thống chat đang bận. Bạn vui lòng thử lại sau ít phút.",
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
              <p>Vui lòng đăng nhập để sử dụng chatbot hỗ trợ đặt vé.</p>
              <button className="btn btn-primary" onClick={() => keycloak.login()}>
                Đăng nhập
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
          <div className="chatbot-header-card">
            <div>
              <h1 className="page-title">Chatbot hỗ trợ</h1>
              <p>Tra cứu sự kiện, tư vấn vé và hỗ trợ đơn hàng ngay trong cuộc trò chuyện.</p>
            </div>
            {lastStrategy ? (
              <span className="chatbot-strategy-badge">
                <Sparkles size={14} />
                {lastStrategy}
              </span>
            ) : null}
          </div>

          <div className="chatbot-shell">
            <div className="chatbot-messages">
              {messages.map((message) => (
                <article key={message.id} className={`chat-msg chat-msg--${message.role}`}>
                  <div className="chat-msg-icon">
                    {message.role === "assistant" ? <Bot size={15} /> : <User size={15} />}
                  </div>
                  <div className="chat-msg-bubble">
                    <p>{message.text}</p>
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
                      Đang phản hồi...
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
                placeholder="Nhập nội dung cần hỗ trợ..."
                maxLength={2000}
              />
              <button type="submit" className="btn btn-primary" disabled={!canSend}>
                {sending ? <LoaderCircle size={16} className="spin" /> : <SendHorizontal size={16} />}
                Gửi
              </button>
            </form>
          </div>

          <p className="chatbot-note">
            Cần xem sự kiện ngay? <Link to="/search">Đi tới trang tìm kiếm</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
