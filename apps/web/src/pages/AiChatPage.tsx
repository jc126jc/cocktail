import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import styles from "./AiChatPage.module.css";

const SESSION_KEY = "cocktail.aiChat.messages.v1";

type ChatRole = "user" | "assistant";

type LibraryRecipe = {
  id: string;
  nameZh: string;
  nameEn: string;
  missingCount: number;
  matchReason: string;
  detailPath: string;
};

type ChatBubble = {
  role: ChatRole;
  content: string;
  recipes?: LibraryRecipe[];
  kind?: "reply" | "library" | "generated";
  disclaimer?: string;
};

function loadSessionMessages(): ChatBubble[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatBubble =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

function saveSessionMessages(messages: ChatBubble[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch {
    // quota / private mode — ignore; in-memory still works this visit
  }
}

export function AiChatPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [hint, setHint] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>(() =>
    loadSessionMessages(),
  );

  useEffect(() => {
    saveSessionMessages(messages);
  }, [messages]);

  useEffect(() => {
    void (async () => {
      try {
        const status = await api.aiStatus();
        setAvailable(status.available);
        setHint(
          status.available
            ? "优先匹配现有配方，临时生成的配方不允许保存。"
            : "助手暂时用不了。配方搜索和酒柜还能照常用。",
        );
      } catch {
        setAvailable(false);
        setHint("没能连上助手。配方搜索和酒柜还能用。");
      }
    })();
  }, []);

  const history = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [messages],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || !available) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await api.aiChat({
        message: text,
        history,
      });
      if (res.kind === "library") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.assistantMessage,
            kind: "library",
            recipes: res.recipes,
          },
        ]);
      } else if (res.kind === "generated") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.assistantMessage,
            kind: "generated",
            disclaimer: res.disclaimer,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.assistantMessage,
            kind: "reply",
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "这次没发出去。");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "这次没答上来。也可以回首页搜，或先整理酒柜。",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function clearSession() {
    setMessages([]);
    setError(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1>AI 助手</h1>
          {messages.length > 0 && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearSession}
            >
              清空对话
            </button>
          )}
        </div>
        <p className={styles.hint}>{hint}</p>
      </header>

      {!available && available !== null && (
        <p className={styles.warn} role="status">
          助手需要联网，并且在本机配好密钥后才能用。
        </p>
      )}

      {messages.length === 0 ? (
        <div className={styles.empty} aria-live="polite">
          <p className={styles.emptyNote}>记录不会保存</p>
          <p className={styles.emptyPrompt}>
            试试：「内格罗尼」或「金酒的sour」。
          </p>
        </div>
      ) : (
      <div className={styles.thread} aria-live="polite">
        {messages.map((m, i) => (
          <article
            key={`${m.role}-${i}`}
            className={m.role === "user" ? styles.user : styles.assistant}
          >
            <div className={styles.meta}>
              {m.role === "user" ? "你" : "助手"}
            </div>
            <pre className={styles.body}>{m.content}</pre>
            {m.kind === "library" && m.recipes && m.recipes.length > 0 && (
              <ul className={styles.cards}>
                {m.recipes.map((r) => (
                  <li key={r.id}>
                    <Link to={r.detailPath}>
                      {r.nameZh}{" "}
                      <span className={styles.en}>{r.nameEn}</span>
                    </Link>
                    <div className={styles.cardMeta}>
                      {r.missingCount === 0
                        ? "材料齐全"
                        : `缺 ${r.missingCount} 种`}
                      {" · "}
                      {r.matchReason}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {m.kind === "generated" && (
              <p className={styles.disclaimer}>
                {m.disclaimer ?? "这是临时写的，还没核对过"}
                {" · "}
                不会存进配方库
              </p>
            )}
          </article>
        ))}
      </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <form className={styles.composer} onSubmit={(e) => void onSubmit(e)}>
        <label className="visually-hidden" htmlFor="ai-chat-input">
          输入问题
        </label>
        <div className={styles.composerShell}>
          <textarea
            id="ai-chat-input"
            className={styles.input}
            rows={3}
            value={input}
            disabled={!available || busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) {
                return;
              }
              e.preventDefault();
              if (!available || busy || !input.trim()) return;
              const form = e.currentTarget.form;
              if (form) form.requestSubmit();
            }}
            placeholder={
              available
                ? "想喝什么，直接说…（Enter 发送，Shift+Enter 换行）"
                : "助手暂时用不了"
            }
          />
          <button
            type="submit"
            className={styles.send}
            disabled={!available || busy || !input.trim()}
          >
            {busy ? "…" : "发送"}
          </button>
        </div>
      </form>
    </div>
  );
}
