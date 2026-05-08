import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Message } from "../lib/types";

export default function Messages() {
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

  const msgs: Message[] = (data?.pages ?? []).flat();

  return (
    <div className="col" style={{ gap: 16 }}>

      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between" }}>
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

      <div className="messages-list">
        {msgs.length === 0 && !isLoading && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div style={{ fontWeight: 500 }}>No messages yet</div>
            <div className="muted">Messages will appear here as they're recorded</div>
          </div>
        )}
        {msgs.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
      </div>

      {hasNextPage && (
        <div style={{ textAlign: "center", paddingBottom: 16 }}>
          <button
            className="btn"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}
    </div>
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
        {msg.text ? (
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
