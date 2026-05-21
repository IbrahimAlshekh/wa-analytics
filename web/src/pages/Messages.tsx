import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Message, MessageEvent } from "../lib/types";
import { ws } from "../lib/ws";

function getMediaUrl(path: string) {
  const token = localStorage.getItem("wt_bearer");
  if (!token) return `/media/${path}`;
  return `/media/${path}?token=${encodeURIComponent(token)}`;
}

// "open" means more WA history may exist; "exhausted" means WA returned nothing new
type WAFetchState = "idle" | "loading" | "open" | "exhausted";

export default function Messages() {
  const qc = useQueryClient();
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);

  // When true, getNextPageParam allows one more page even if last page < 50 items
  const allowExtraPageRef = useRef(false);
  const [, forceRender] = useState(0);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ["messages", accountId, cid],
      queryFn: ({ pageParam }) =>
        api.messages(accountId, cid, pageParam as number, 50),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => {
        const msgs = lastPage?.messages;
        if (!msgs || msgs.length === 0) return undefined;
        if (msgs.length < 50 && !allowExtraPageRef.current) return undefined;
        return msgs[msgs.length - 1].timestamp;
      },
    });

  const sendMutation = useMutation({
    mutationFn: ({ text, file }: { text: string; file?: File }) =>
      api.sendMessage(accountId, cid, text, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", accountId, cid] });
    },
  });

  const msgs: Message[] = useMemo(() => {
    const all = (data?.pages ?? []).flatMap((p) => p.messages);
    return [...all]
      // Filter out content-less rows — these are protocol/system messages
      // (edit notifications, ephemeral acks, etc.) that were stored before
      // the tracker learned to skip them. They have no displayable content.
      .filter((m) => m.text || m.mediaType || m.mediaPath || m.quotedMessageId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  // Events: server returns all events for the contact on every response; use last page.
  const events: MessageEvent[] = useMemo(() => {
    const pages = data?.pages ?? [];
    if (pages.length === 0) return [];
    return pages[pages.length - 1].events;
  }, [data]);

  const eventsByTarget = useMemo(() => {
    const map = new Map<string, MessageEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.targetMessageId) ?? [];
      list.push(ev);
      map.set(ev.targetMessageId, list);
    }
    return map;
  }, [events]);

  // Index messages by messageId for reply-to lookups.
  const msgById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of msgs) map.set(m.messageId, m);
    return map;
  }, [msgs]);

  // ── WA history fetch state ───────────────────────────────────────────────
  const [waState, setWAState] = useState<WAFetchState>("idle");
  const waFetchingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const savedScrollHeightRef = useRef(0);

  // When WA history sync arrives, unlock one extra page and fetch it
  useEffect(() => {
    return ws.on((msg) => {
      if (msg.type !== "history_sync") return;
      if (msg.accountId !== accountId) return;
      if (!waFetchingRef.current) return;
      waFetchingRef.current = false;
      // Save scroll height before new messages are prepended
      if (listRef.current) savedScrollHeightRef.current = listRef.current.scrollHeight;
      // Allow getNextPageParam to return a cursor even if last page was partial
      allowExtraPageRef.current = true;
      forceRender((n) => n + 1); // re-render so hasNextPage updates
    });
  }, [accountId]);

  // After render where hasNextPage flipped to true (due to allowExtraPageRef), fetch
  useEffect(() => {
    if (allowExtraPageRef.current && hasNextPage && !isFetchingNextPage) {
      allowExtraPageRef.current = false;
      fetchNextPage().then((result) => {
        const pages = result.data?.pages ?? [];
        const lastPage = pages[pages.length - 1];
        setWAState((lastPage?.messages?.length ?? 0) > 0 ? "open" : "exhausted");
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Preserve scroll position when older messages are prepended
  useEffect(() => {
    const list = listRef.current;
    if (!list || savedScrollHeightRef.current === 0) return;
    const delta = list.scrollHeight - savedScrollHeightRef.current;
    if (delta > 0) list.scrollTop += delta;
    savedScrollHeightRef.current = 0;
  }, [msgs.length]);

  async function handleFetchFromWA() {
    setWAState("loading");
    waFetchingRef.current = true;
    try {
      await api.fetchMessageHistory(accountId, cid);
      // Response arrives via history_sync WS event — set a 15s timeout fallback
      setTimeout(() => {
        if (waFetchingRef.current) {
          waFetchingRef.current = false;
          setWAState("exhausted");
        }
      }, 15_000);
    } catch {
      waFetchingRef.current = false;
      setWAState("idle");
    }
  }

  // Scroll-position preservation for local DB pagination (load older from DB)
  function handleLoadOlderLocal() {
    if (listRef.current) savedScrollHeightRef.current = listRef.current.scrollHeight;
    fetchNextPage();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          flexShrink: 0,
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--card)",
        }}
      >
        <div className="breadcrumb">
          <Link to={`/accounts/${accountId}/contacts/${cid}`}>← Back</Link>
          <span className="breadcrumb-sep">/</span>
          <span>Messages</span>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          {msgs.length} loaded
        </span>
      </div>

      {isLoading && (
        <div className="muted" style={{ textAlign: "center", padding: "32px 0" }}>
          Loading…
        </div>
      )}
      {error && <div className="error" style={{ padding: "8px 20px" }}>{(error as Error).message}</div>}

      {/* Messages list */}
      <div
        ref={listRef}
        className="messages-list"
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          padding: "8px 20px",
        }}
      >
        {msgs.length === 0 && !isLoading && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div style={{ fontWeight: 500 }}>No messages yet</div>
            <div className="muted">Messages will appear here as they're recorded</div>
          </div>
        )}

        {/* Local DB pagination */}
        {hasNextPage && (
          <div style={{ textAlign: "center", padding: "16px 0", flexShrink: 0 }}>
            <button
              className="btn btn-sm"
              onClick={handleLoadOlderLocal}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}

        {/* WhatsApp history fetch — shown when local DB is exhausted and we have a cursor */}
        {!hasNextPage && msgs.length > 0 && waState !== "exhausted" && (
          <div style={{ textAlign: "center", padding: "16px 0", flexShrink: 0 }}>
            {waState === "loading" ? (
              <span className="muted" style={{ fontSize: 13 }}>Fetching from WhatsApp…</span>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={handleFetchFromWA}>
                {waState === "open" ? "Load more from WhatsApp" : "Fetch older from WhatsApp"}
              </button>
            )}
          </div>
        )}
        {!hasNextPage && msgs.length > 0 && waState === "exhausted" && (
          <div style={{ textAlign: "center", padding: "12px 0", flexShrink: 0 }}>
            <span className="muted" style={{ fontSize: 12 }}>No more messages</span>
          </div>
        )}

        <div style={{ flexGrow: 1 }} />
        {msgs.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            annotations={eventsByTarget.get(m.messageId) ?? []}
            quotedMsg={m.quotedMessageId ? msgById.get(m.quotedMessageId) : undefined}
          />
        ))}
      </div>

      {/* Input bar */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          background: "var(--card)",
        }}
      >
        <MessageInput
          onSend={(text, file) => sendMutation.mutate({ text, file })}
          disabled={sendMutation.isPending}
        />
        {sendMutation.error && (
          <div className="error" style={{ marginTop: 8 }}>
            {sendMutation.error.message}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageInput({ onSend, disabled }: { onSend: (text: string, file?: File) => void, disabled: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) return;
    onSend(text, file || undefined);
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <form className="row" style={{ gap: 8, alignItems: "flex-end" }} onSubmit={handleSubmit}>
      <div className="col" style={{ flexGrow: 1, gap: 4 }}>
        {file && (
          <div className="row" style={{ gap: 8, alignItems: "center", background: "var(--bg-muted, #f5f5f5)", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}>
            <span style={{ flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              📎 {file.name}
            </span>
            <button type="button" className="btn-close" onClick={() => setFile(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        )}
        <input
          type="text"
          className="input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          style={{ width: "100%" }}
        />
      </div>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="Attach file"
        style={{ padding: "8px 12px" }}
      >
        📎
      </button>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || (!text.trim() && !file)}
      >
        Send
      </button>
    </form>
  );
}

function MessageBubble({
  msg,
  annotations,
  quotedMsg,
}: {
  msg: Message;
  annotations: MessageEvent[];
  quotedMsg?: Message;
}) {
  const ts = new Date(msg.timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Reactions: last-wins per actor, filter out removals (empty emoji)
  const reactionsByActor = new Map<string, MessageEvent>();
  for (const ev of annotations) {
    if (ev.kind === "reaction") reactionsByActor.set(ev.actorJid, ev);
  }
  const activeReactions = [...reactionsByActor.values()].filter((ev) => ev.emoji);

  const isDeleted = annotations.some((ev) => ev.kind === "delete");
  const edits = annotations
    .filter((ev) => ev.kind === "edit")
    .sort((a, b) => b.observedAt - a.observedAt);
  const latestEdit = edits[0];

  const displayText = latestEdit?.newText || msg.text;

  return (
    <div className={`message-bubble ${msg.isFromMe ? "message-me" : "message-them"}`}>
      {/* Reply context */}
      {quotedMsg && (
        <div className="message-reply-preview">
          <span className="message-reply-icon">↩</span>
          <span className="message-reply-text">
            {quotedMsg.text
              ? quotedMsg.text.slice(0, 80) + (quotedMsg.text.length > 80 ? "…" : "")
              : quotedMsg.mediaType
              ? `[${quotedMsg.mediaType}]`
              : "[message]"}
          </span>
        </div>
      )}
      {!quotedMsg && msg.quotedMessageId && (
        <div className="message-reply-preview message-reply-unknown">
          <span className="message-reply-icon">↩</span>
          <span className="message-reply-text muted">Reply to earlier message</span>
        </div>
      )}

      {/* Body — always show original content; overlay deleted style if needed */}
      <div className={`message-body${isDeleted ? " message-body-deleted" : ""}`}>
        {msg.mediaPath ? (
          <div className="col" style={{ gap: 8 }}>
            <MediaPreview type={msg.mediaType} path={msg.mediaPath} />
            {displayText && <span>{displayText}</span>}
          </div>
        ) : displayText ? (
          <span>{displayText}</span>
        ) : msg.mediaType ? (
          <span className="muted">[{msg.mediaType}]</span>
        ) : null}
      </div>

      {/* Footer row: badges + time */}
      <div className="message-footer">
        {isDeleted && (
          <span className="message-deleted-badge">🗑 deleted</span>
        )}
        {latestEdit && !isDeleted && (
          <span className="message-edited-badge">✏ edited</span>
        )}
        <time className="message-time">{ts}</time>
      </div>

      {/* Reactions */}
      {activeReactions.length > 0 && (
        <div className="message-reactions">
          {activeReactions.map((ev) => (
            <span
              key={ev.actorJid}
              className="message-reaction"
              title={ev.isFromMe ? "You" : ev.actorJid}
            >
              {ev.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaPreview({ type, path }: { type?: string; path: string }) {
  const url = useMemo(() => getMediaUrl(path), [path]);

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt="WhatsApp Media"
          style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 4, display: "block" }}
        />
      </a>
    );
  }

  if (type === "video") {
    return (
      <video
        src={url}
        controls
        style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 4, display: "block" }}
      />
    );
  }

  if (type === "audio") {
    return <audio src={url} controls style={{ maxWidth: "100%" }} />;
  }

  if (type === "sticker") {
    return (
      <img
        src={url}
        alt="Sticker"
        style={{ width: 120, height: 120, objectFit: "contain", display: "block" }}
      />
    );
  }

  return (
    <div className="row" style={{ gap: 8, alignItems: "center", padding: "8px 12px", background: "rgba(0,0,0,0.05)", borderRadius: 4 }}>
      <span style={{ fontSize: 20 }}>📄</span>
      <div className="col">
        <span style={{ fontSize: 13, fontWeight: 500 }}>{type || "File"}</span>
        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Download</a>
      </div>
    </div>
  );
}
