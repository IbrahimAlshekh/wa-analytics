import { useMemo, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Message } from "../lib/types";

function getMediaUrl(path: string) {
  const token = localStorage.getItem("wt_bearer");
  if (!token) return `/media/${path}`;
  return `/media/${path}?token=${encodeURIComponent(token)}`;
}

export default function Messages() {
  const qc = useQueryClient();
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ["messages", accountId, cid],
      queryFn: ({ pageParam }) =>
        api.messages(accountId, cid, pageParam as number, 50),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => {
        if (!lastPage || lastPage.length < 50) return undefined;
        return lastPage[lastPage.length - 1].timestamp;
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
    const all = (data?.pages ?? []).flat();
    return [...all].sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  return (
    <div className="col" style={{ gap: 16, height: "calc(100vh - 100px)" }}>

      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", flexShrink: 0 }}>
        <div className="breadcrumb">
          <Link to={`/accounts/${accountId}/contacts/${cid}`}>Contact</Link>
          <span className="breadcrumb-sep">/</span>
          <span>Messages</span>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          {msgs.length} loaded
        </span>
      </div>

      {isLoading && <div className="muted" style={{ textAlign: "center", padding: "32px 0" }}>Loading…</div>}
      {error && <div className="error">{(error as Error).message}</div>}

      <div className="messages-list" style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {msgs.length === 0 && !isLoading && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div style={{ fontWeight: 500 }}>No messages yet</div>
            <div className="muted">Messages will appear here as they're recorded</div>
          </div>
        )}
        {hasNextPage && (
          <div style={{ textAlign: "center", padding: "16px 0", flexShrink: 0 }}>
            <button
              className="btn btn-sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}
        <div style={{ flexGrow: 1 }} />
        {msgs.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
      </div>

      <div style={{ flexShrink: 0 }}>
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

function MessageBubble({ msg }: { msg: Message }) {
  const ts = new Date(msg.timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`message-bubble ${msg.isFromMe ? "message-me" : "message-them"}`}>
      <div className="message-body">
        {msg.mediaPath ? (
          <div className="col" style={{ gap: 8 }}>
            <MediaPreview type={msg.mediaType} path={msg.mediaPath} />
            {msg.text && <span>{msg.text}</span>}
          </div>
        ) : msg.text ? (
          <span>{msg.text}</span>
        ) : msg.mediaType ? (
          <span className="muted">[{msg.mediaType}]</span>
        ) : (
          <span className="muted">[message]</span>
        )}
      </div>
      <time className="message-time">{ts}</time>
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
