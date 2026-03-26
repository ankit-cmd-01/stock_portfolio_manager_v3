import { Bot, LoaderCircle, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { sendChatMessage } from "../api/chat";
import { useAuth } from "../hooks/useAuth";

function buildWelcomeMessage(isAuthenticated, user) {
  if (isAuthenticated) {
    const name = user?.first_name || "there";
    return {
      id: "welcome-auth",
      role: "assistant",
      content: `Hi ${name}. I can answer using your saved portfolios, tracked stocks, and account data, and I can still help with general stock-market questions too.`,
    };
  }

  return {
    id: "welcome-guest",
    role: "assistant",
    content:
      "Hi. I can act like a general stock and portfolio chatbot right now. If you log in, I can answer using your own portfolios and holdings too.",
  };
}

export default function ChatWidget() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState(() => [buildWelcomeMessage(false, null)]);
  const [meta, setMeta] = useState({ mode: "guest", provider: "", engine: "" });
  const listRef = useRef(null);
  const onAuthScreen = location.pathname === "/login";
  const personalizedMode = Boolean(isAuthenticated && user && !onAuthScreen);
  const authSessionKey = personalizedMode ? user?.email || user?.id || "authenticated" : `guest:${location.pathname}`;

  const welcomeMessage = useMemo(
    () => buildWelcomeMessage(personalizedMode, personalizedMode ? user : null),
    [personalizedMode, user]
  );

  useEffect(() => {
    // Reset the chat session whenever auth state changes so guest mode
    // cannot reuse personalized history from a previous logged-in session.
    setMessages([welcomeMessage]);
    setMeta({
      mode: personalizedMode ? "authenticated" : "guest",
      provider: "",
      engine: "",
    });
    setInput("");
    setSending(false);
  }, [authSessionKey, personalizedMode, welcomeMessage]);

  useEffect(() => {
    if (!open) {
      return;
    }
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open, sending]);

  const openChat = () => {
    setOpen(true);
  };

  const closeChat = () => {
    setOpen(false);
  };

  const handleOpenPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    setOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || sending) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const nextHistory = [...messages, userMessage]
      .filter((item) => item.role === "user" || item.role === "assistant")
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);

    try {
      const response = await sendChatMessage({
        message: trimmed,
        history: nextHistory,
      }, { authenticated: personalizedMode });
      setMeta({
        mode: response.mode || (personalizedMode ? "authenticated" : "guest"),
        provider: response.provider || "",
        engine: response.engine || "",
      });
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.reply || "I could not generate a response right now.",
        },
      ]);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Chat is temporarily unavailable. Please try again.";
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: message,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <section className="pointer-events-auto w-[min(92vw,22rem)] overflow-hidden rounded-modal border border-border bg-elevated shadow-panel">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-panel bg-primary/10 text-primary">
                <Bot size={17} />
              </div>
              <div>
                <p className="font-display text-[1.1rem] text-text">StockPilot Chat</p>
                <p className="text-[11px] text-muted">
                  {personalizedMode ? "Personalized mode" : "Guest mode"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeChat}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-panel border border-border bg-base text-muted transition duration-150 hover:border-primary/30 hover:text-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </header>

          <div ref={listRef} className="scrollbar-thin flex max-h-[440px] min-h-[300px] flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] rounded-panel px-4 py-3 text-[0.95rem] leading-6 ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-slate-950"
                    : "border border-white/5 bg-base text-text"
                } break-words`}
              >
                {message.content}
              </div>
            ))}

            {sending ? (
              <div className="inline-flex max-w-[88%] items-center gap-2 rounded-panel border border-white/5 bg-base px-4 py-3 text-sm text-muted">
                <LoaderCircle size={16} className="animate-spin" />
                Thinking...
              </div>
            ) : null}
          </div>

          <footer className="border-t border-border px-4 py-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                placeholder={
                  personalizedMode
                    ? "Ask about your portfolios, holdings, or any stock-market question..."
                    : "Ask any stock or portfolio question..."
                }
                className="w-full resize-none rounded-panel border border-border bg-base px-4 py-3 text-[0.95rem] text-text outline-none transition focus:border-primary/40"
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Sparkles size={14} className="text-primary" />
                  <span>{meta.provider ? `${meta.provider} | ${meta.engine}` : "AI assistant"}</span>
                </div>
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="inline-flex items-center gap-2 rounded-panel bg-primary px-4 py-2.5 text-[0.95rem] font-semibold text-slate-950 transition hover:shadow-cyan disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </form>
          </footer>
        </section>
      ) : null}

      <button
        type="button"
        onPointerDown={handleOpenPointerDown}
        onClick={openChat}
        className="pointer-events-auto inline-flex h-12 w-12 cursor-pointer touch-manipulation items-center justify-center rounded-full border border-primary/30 bg-primary text-slate-950 shadow-cyan transition duration-150 hover:-translate-y-0.5 hover:scale-[1.06] hover:border-primary/60 hover:shadow-[0_0_30px_rgba(34,211,238,0.45)] active:scale-95 active:shadow-[0_0_20px_rgba(34,211,238,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:h-[3.2rem] sm:w-[3.2rem]"
        aria-label="Open chatbot"
      >
        <MessageSquare size={18} />
      </button>
    </div>
  );
}
