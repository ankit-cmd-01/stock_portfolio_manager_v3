import {
  Bot,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Minimize2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { sendChatMessage } from "../api/chat";
import { useAuth } from "../hooks/useAuth";

const GLOBAL_PROMPTS = [
  "Explain P/E ratio",
  "Top pharma stocks to watch",
  "Best stock overall for long-term investing",
  "Which sectors look strongest right now?",
];

const PORTFOLIO_PROMPTS = [
  "Best stock in my portfolio",
  "Summarize my holdings",
  "Which portfolio is strongest right now?",
  "Which of my holdings are underperforming?",
];

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
  const [fullscreen, setFullscreen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState(() => [buildWelcomeMessage(false, null)]);
  const [meta, setMeta] = useState({ mode: "guest", provider: "", engine: "" });
  const [responseMode, setResponseMode] = useState(isAuthenticated ? "portfolio" : "global");
  const [typingReply, setTypingReply] = useState(null);
  const listRef = useRef(null);
  const typingTimerRef = useRef(null);
  const onAuthScreen = location.pathname === "/login";
  const personalizedMode = Boolean(isAuthenticated && user && !onAuthScreen);
  const authSessionKey = personalizedMode ? user?.email || user?.id || "authenticated" : `guest:${location.pathname}`;

  const welcomeMessage = useMemo(
    () => buildWelcomeMessage(personalizedMode, personalizedMode ? user : null),
    [personalizedMode, user]
  );
  const suggestedPrompts = useMemo(
    () => (responseMode === "portfolio" && personalizedMode ? PORTFOLIO_PROMPTS : GLOBAL_PROMPTS),
    [personalizedMode, responseMode]
  );
  const modeHelperText = responseMode === "portfolio"
    ? "Uses your saved portfolios and holdings."
    : "Answers with broader market context first.";
  const promptLayoutClassName = fullscreen
    ? "grid grid-cols-2 gap-2"
    : "scrollbar-thin flex gap-2 overflow-x-auto pb-1";
  const promptButtonClassName = fullscreen
    ? "min-h-[3rem] rounded-2xl border border-border bg-base px-3 py-2 text-left text-[11px] leading-4 text-muted transition hover:border-primary/40 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
    : "shrink-0 rounded-full border border-border bg-base px-3 py-2 text-[11px] text-muted transition hover:border-primary/40 hover:text-text disabled:cursor-not-allowed disabled:opacity-50";

  useEffect(() => {
    // Reset the chat session whenever auth state changes so guest mode
    // cannot reuse personalized history from a previous logged-in session.
    setMessages([welcomeMessage]);
    setResponseMode(personalizedMode ? "portfolio" : "global");
    setMeta({
      mode: personalizedMode ? "authenticated" : "guest",
      provider: "",
      engine: "",
    });
    setInput("");
    setSending(false);
    setTypingReply(null);
  }, [authSessionKey, personalizedMode, welcomeMessage]);

  useEffect(() => {
    if (!open) {
      return;
    }
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open, sending, typingReply?.visibleContent]);

  useEffect(() => {
    if (!typingReply) {
      return undefined;
    }

    if (typingReply.visibleContent.length >= typingReply.fullContent.length) {
      setMessages((current) => [
        ...current,
        {
          id: typingReply.id,
          role: "assistant",
          content: typingReply.fullContent,
        },
      ]);
      setTypingReply(null);
      setSending(false);
      return undefined;
    }

    const chunkSize = typingReply.fullContent.length > 360
      ? 6
      : typingReply.fullContent.length > 180
        ? 4
        : 2;

    typingTimerRef.current = window.setTimeout(() => {
      setTypingReply((current) => (
        current
          ? {
              ...current,
              visibleContent: current.fullContent.slice(
                0,
                Math.min(current.fullContent.length, current.visibleContent.length + chunkSize)
              ),
            }
          : null
      ));
    }, 18);

    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, [typingReply]);

  const openChat = () => {
    setOpen(true);
  };

  const closeChat = () => {
    setOpen(false);
    setFullscreen(false);
  };

  const handleOpenPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    setOpen(true);
  };

  const submitMessage = async (overrideMessage) => {
    const trimmed = (overrideMessage ?? input).trim();
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
    setTypingReply(null);

    try {
      const response = await sendChatMessage({
        message: trimmed,
        history: nextHistory,
        response_mode: responseMode,
      }, { authenticated: personalizedMode });
      setMeta({
        mode: response.mode || (personalizedMode ? "authenticated" : "guest"),
        provider: response.provider || "",
        engine: response.engine || "",
      });
      setTypingReply({
        id: `assistant-${Date.now()}`,
        fullContent: response.reply || "I could not generate a response right now.",
        visibleContent: "",
      });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Chat is temporarily unavailable. Please try again.";
      setTypingReply({
        id: `assistant-error-${Date.now()}`,
        fullContent: message,
        visibleContent: "",
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitMessage();
  };

  const handleInputKeyDown = (event) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void submitMessage();
  };

  const toggleFullscreen = () => {
    setFullscreen((current) => !current);
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === "portfolio" && !personalizedMode) {
      return;
    }
    setResponseMode(nextMode);
  };

  const handlePromptClick = (prompt) => {
    void submitMessage(prompt);
  };

  const containerClassName = fullscreen && open
    ? "pointer-events-none fixed inset-3 z-[60] flex flex-col sm:inset-6"
    : "pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6";

  const panelClassName = fullscreen
    ? "pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-modal border border-border bg-elevated shadow-panel"
    : "pointer-events-auto flex h-[min(40rem,calc(100dvh-2.5rem))] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-modal border border-border bg-elevated shadow-panel sm:h-[min(40rem,calc(100dvh-3rem))]";

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close chat overlay"
          onClick={closeChat}
          className="fixed inset-0 z-[59] cursor-default bg-transparent"
        />
      ) : null}

      <div className={containerClassName}>
        {open ? (
          <section className={panelClassName}>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-panel border border-border bg-base text-muted transition duration-150 hover:border-primary/30 hover:text-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label={fullscreen ? "Exit full screen chat" : "Open full screen chat"}
                >
                  {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={closeChat}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-panel border border-border bg-base text-muted transition duration-150 hover:border-primary/30 hover:text-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="Close chat"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="border-b border-border/80 px-4 py-3">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-base p-1">
                <button
                  type="button"
                  onClick={() => handleModeChange("portfolio")}
                  disabled={!personalizedMode}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    responseMode === "portfolio"
                      ? "bg-primary text-slate-950 shadow-cyan"
                      : "text-muted"
                  } ${!personalizedMode ? "cursor-not-allowed opacity-45" : ""}`}
                  title={personalizedMode ? "Use saved portfolio data" : "Log in to use My Portfolio mode"}
                >
                  My Portfolio
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("global")}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    responseMode === "global"
                      ? "bg-primary text-slate-950 shadow-cyan"
                      : "text-muted"
                  }`}
                >
                  Global Market
                </button>
              </div>
              <p className="mt-2 px-1 text-[11px] text-muted">{modeHelperText}</p>
            </div>

            <div ref={listRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-3">
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

                {typingReply ? (
                  <div className="max-w-[88%] rounded-panel border border-white/5 bg-base px-4 py-3 text-[0.95rem] leading-6 text-text break-words">
                    {typingReply.visibleContent}
                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-[-2px]" />
                  </div>
                ) : null}

                {sending && !typingReply ? (
                  <div className="inline-flex max-w-[88%] items-center gap-2 rounded-panel border border-white/5 bg-base px-4 py-3 text-sm text-muted">
                    <LoaderCircle size={16} className="animate-spin" />
                    Thinking...
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="border-t border-border px-4 py-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted/80">
                      Quick Prompts
                    </p>
                    {!fullscreen ? (
                      <p className="text-[10px] text-muted/70">Scroll for more</p>
                    ) : null}
                  </div>
                  <div className={promptLayoutClassName}>
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handlePromptClick(prompt)}
                        disabled={sending}
                        className={promptButtonClassName}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  rows={fullscreen ? 4 : 2}
                  placeholder={
                    responseMode === "portfolio" && personalizedMode
                      ? "Ask about your portfolios, holdings, performance, or account summary..."
                      : "Ask any stock-market or investing question..."
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
    </>
  );
}
