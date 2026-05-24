import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import { api } from "../lib/api";
import type { Message, MessageEvent } from "@/types/message";
import { ws } from "../lib/ws";
import { Button } from "@/components/ui/button";
import MessageBubble from "@/components/messages/MessageBubble";
import MessageInput from "@/components/messages/MessageInput";

type WAFetchState = "idle" | "loading" | "open" | "exhausted";

export default function Messages() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { id: accountIdStr, cid: cidStr } = useParams<{
    id: string;
    cid: string;
  }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);

  const allowExtraPageRef = useRef(false);
  const [, forceRender] = useState(0);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
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
      if (listRef.current)
        savedScrollHeightRef.current = listRef.current.scrollHeight;
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
        setWAState(
          (lastPage?.messages?.length ?? 0) > 0 ? "open" : "exhausted",
        );
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

  function handleLoadOlderLocal() {
    if (listRef.current)
      savedScrollHeightRef.current = listRef.current.scrollHeight;
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
        <div className="text-sm text-muted-foreground text-center py-8">
          {t("messages.loading")}
        </div>
      )}
      {error && (
        <div className="text-sm text-destructive px-5 py-2">
          {(error as Error).message}
        </div>
      )}

      {/* Messages list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto flex flex-col px-4 py-2 min-h-full">
          {msgs.length === 0 && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <MessageSquare className="size-10 text-muted-foreground/50" />
              <p className="font-medium text-sm">{t("messages.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("messages.emptyDesc")}
              </p>
            </div>
          )}

          {hasNextPage && (
            <div className="text-center py-4 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadOlderLocal}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage
                  ? t("messages.loadingOlder")
                  : t("messages.loadOlder")}
              </Button>
            </div>
          )}

          {!hasNextPage && msgs.length > 0 && waState !== "exhausted" && (
            <div className="text-center py-4 shrink-0">
              {waState === "loading" ? (
                <span className="text-xs text-muted-foreground">
                  {t("messages.fetchingWhatsApp")}
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleFetchFromWA}>
                  {waState === "open"
                    ? t("messages.loadMoreWhatsApp")
                    : t("messages.fetchOlderWhatsApp")}
                </Button>
              )}
            </div>
          )}
          {!hasNextPage && msgs.length > 0 && waState === "exhausted" && (
            <div className="text-center py-3 shrink-0">
              <span className="text-xs text-muted-foreground">
                {t("messages.noMore")}
              </span>
            </div>
          )}

          <div className="flex-1" />
          {msgs.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              annotations={eventsByTarget.get(m.messageId) ?? []}
              quotedMsg={
                m.quotedMessageId ? msgById.get(m.quotedMessageId) : undefined
              }
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
            <p className="text-xs text-destructive mt-1.5">
              {sendMutation.error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
