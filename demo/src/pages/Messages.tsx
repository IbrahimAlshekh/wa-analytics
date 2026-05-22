import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Paperclip, Send, X, MessageSquare } from "lucide-react";
import { api } from "../lib/api";
import type { Message, MessageEvent } from "../lib/types";
import { ws } from "../lib/ws";
import { getMediaUrl } from "../lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WAFetchState = "idle" | "loading" | "open" | "exhausted";

export default function Messages() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);

  const allowExtraPageRef = useRef(false);
  const [, forceRender] = useState(0);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ["messages", accountId, cid],
      queryFn: ({ pageParam }) => api.messages(accountId, cid, pageParam as number, 50),
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
      scrollToBottomRef.current = true;
      qc.invalidateQueries({ queryKey: ["messages", accountId, cid] });
    },
  });

  const msgs: Message[] = useMemo(() => {
    const all = (data?.pages ?? []).flatMap((p) => p.messages);
    return [...all]
      .filter((m) => m.text || m.mediaType || m.mediaPath || m.quotedMessageId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

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

  const msgById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of msgs) map.set(m.messageId, m);
    return map;
  }, [msgs]);

  const [waState, setWAState] = useState<WAFetchState>("idle");
  const waFetchingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const savedScrollHeightRef = useRef(0);
  const scrollToBottomRef = useRef(false);

  useEffect(() => {
    return ws.on((msg) => {
      if (msg.type !== "history_sync") return;
      if (msg.accountId !== accountId) return;
      if (!waFetchingRef.current) return;
      waFetchingRef.current = false;
      if (listRef.current) savedScrollHeightRef.current = listRef.current.scrollHeight;
      allowExtraPageRef.current = true;
      forceRender((n) => n + 1);
    });
  }, [accountId]);

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

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (scrollToBottomRef.current) {
      list.scrollTop = list.scrollHeight;
      scrollToBottomRef.current = false;
      return;
    }
    if (savedScrollHeightRef.current === 0) return;
    const delta = list.scrollHeight - savedScrollHeightRef.current;
    if (delta > 0) list.scrollTop += delta;
    savedScrollHeightRef.current = 0;
  }, [msgs.length]);

  async function handleFetchFromWA() {
    setWAState("loading");
    waFetchingRef.current = true;
    try {
      await api.fetchMessageHistory(accountId, cid);
      setTimeout(() => {
        if (waFetchingRef.current) { waFetchingRef.current = false; setWAState("exhausted"); }
      }, 15_000);
    } catch {
      waFetchingRef.current = false;
      setWAState("idle");
    }
  }

  function handleLoadOlderLocal() {
    if (listRef.current) savedScrollHeightRef.current = listRef.current.scrollHeight;
    fetchNextPage();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card shrink-0">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            to={`/accounts/${accountId}/contacts/${cid}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("messages.back")}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">{t("messages.title")}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("messages.loaded", { count: msgs.length })}
        </span>
      </div>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground text-center py-8">{t("messages.loading")}</div>
      )}
      {error && (
        <div className="text-sm text-destructive px-5 py-2">{(error as Error).message}</div>
      )}

      {/* Messages list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto flex flex-col px-4 py-2 min-h-full">
        {msgs.length === 0 && !isLoading && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <MessageSquare className="size-10 text-muted-foreground/50" />
            <p className="font-medium text-sm">{t("messages.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("messages.emptyDesc")}</p>
          </div>
        )}

        {hasNextPage && (
          <div className="text-center py-4 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleLoadOlderLocal} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? t("messages.loadingOlder") : t("messages.loadOlder")}
            </Button>
          </div>
        )}

        {!hasNextPage && msgs.length > 0 && waState !== "exhausted" && (
          <div className="text-center py-4 shrink-0">
            {waState === "loading" ? (
              <span className="text-xs text-muted-foreground">{t("messages.fetchingWhatsApp")}</span>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleFetchFromWA}>
                {waState === "open" ? t("messages.loadMoreWhatsApp") : t("messages.fetchOlderWhatsApp")}
              </Button>
            )}
          </div>
        )}
        {!hasNextPage && msgs.length > 0 && waState === "exhausted" && (
          <div className="text-center py-3 shrink-0">
            <span className="text-xs text-muted-foreground">{t("messages.noMore")}</span>
          </div>
        )}

        <div className="flex-1" />
        {msgs.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            annotations={eventsByTarget.get(m.messageId) ?? []}
            quotedMsg={m.quotedMessageId ? msgById.get(m.quotedMessageId) : undefined}
          />
        ))}
      </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-card">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <MessageInput
          onSend={(text, file) => sendMutation.mutate({ text, file })}
          disabled={sendMutation.isPending}
        />
        {sendMutation.error && (
          <p className="text-xs text-destructive mt-1.5">{sendMutation.error.message}</p>
        )}
      </div>
      </div>
    </div>
  );
}

function MessageInput({ onSend, disabled }: { onSend: (text: string, file?: File) => void; disabled: boolean }) {
  const { t } = useTranslation();
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
    <form className="flex items-end gap-2" onSubmit={handleSubmit}>
      <div className="flex-1 flex flex-col gap-1.5">
        {file && (
          <div className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs">
            <span className="flex-1 truncate">📎 {file.name}</span>
            <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <Input
          placeholder={t("messages.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title={t("messages.attachFile")}
      >
        <Paperclip className="size-4" />
      </Button>
      <Button
        type="submit"
        size="icon"
        className="size-9"
        disabled={disabled || (!text.trim() && !file)}
      >
        <Send className="size-4" />
      </Button>
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
  const { t } = useTranslation();
  const ts = new Date(msg.timestamp * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const reactionsByActor = new Map<string, MessageEvent>();
  for (const ev of annotations) {
    if (ev.kind === "reaction") reactionsByActor.set(ev.actorJid, ev);
  }
  const activeReactions = [...reactionsByActor.values()].filter((ev) => ev.emoji);

  const isDeleted = annotations.some((ev) => ev.kind === "delete");
  const edits = annotations.filter((ev) => ev.kind === "edit").sort((a, b) => b.observedAt - a.observedAt);
  const latestEdit = edits[0];
  const displayText = latestEdit?.newText || msg.text;

  return (
    <div className={cn(
      "flex flex-col mb-2 max-w-[75%]",
      msg.isFromMe ? "self-end items-end" : "self-start items-start",
    )}>
      {/* Reply context */}
      {quotedMsg && (
        <div className="text-xs bg-muted/50 border-s-2 border-primary px-2 py-1 rounded mb-1 max-w-full">
          <span className="text-muted-foreground">↩ </span>
          <span className="text-muted-foreground">
            {quotedMsg.text
              ? quotedMsg.text.slice(0, 80) + (quotedMsg.text.length > 80 ? "…" : "")
              : quotedMsg.mediaType
              ? `[${quotedMsg.mediaType}]`
              : "[message]"}
          </span>
        </div>
      )}
      {!quotedMsg && msg.quotedMessageId && (
        <div className="text-xs bg-muted/30 border-s-2 border-muted-foreground/30 px-2 py-1 rounded mb-1">
          <span className="text-muted-foreground">↩ {t("messages.replyFallback")}</span>
        </div>
      )}

      {/* Bubble */}
      <div className={cn(
        "rounded-2xl px-3 py-2 text-sm",
        msg.isFromMe
          ? "bg-primary text-primary-foreground rounded-se-sm"
          : "bg-card border border-border rounded-ss-sm",
        isDeleted && "opacity-60 line-through",
      )}>
        {msg.mediaPath ? (
          <div className="flex flex-col gap-2">
            <MediaPreview type={msg.mediaType} path={msg.mediaPath} />
            {displayText && <span>{displayText}</span>}
          </div>
        ) : displayText ? (
          <span>{displayText}</span>
        ) : msg.mediaType ? (
          <span className="opacity-70">[{msg.mediaType}]</span>
        ) : null}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 mt-0.5 px-1">
        {isDeleted && (
          <span className="text-xs text-muted-foreground">🗑 {t("messages.deleted")}</span>
        )}
        {latestEdit && !isDeleted && (
          <span className="text-xs text-muted-foreground">✏ {t("messages.edited")}</span>
        )}
        <time className="text-xs text-muted-foreground">{ts}</time>
      </div>

      {/* Reactions */}
      {activeReactions.length > 0 && (
        <div className="flex gap-1 mt-0.5 flex-wrap">
          {activeReactions.map((ev) => (
            <span
              key={ev.actorJid}
              className="text-base rounded-full bg-card border border-border px-1"
              title={ev.isFromMe ? t("messages.you") : ev.actorJid}
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
  const { t } = useTranslation();
  const url = useMemo(() => getMediaUrl(path), [path]);

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={t("messages.mediaAlt")} className="max-w-full max-h-72 rounded object-cover block" />
      </a>
    );
  }

  if (type === "video") {
    return <video src={url} controls className="max-w-full max-h-72 rounded block" />;
  }

  if (type === "audio") {
    return <audio src={url} controls className="max-w-full" />;
  }

  if (type === "sticker") {
    return <img src={url} alt={t("messages.sticker")} className="size-28 object-contain block" />;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded">
      <span className="text-xl">📄</span>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{type || t("messages.file")}</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs underline">
          {t("messages.messageFallback")}
        </a>
      </div>
    </div>
  );
}
