import { useTranslation } from "react-i18next";
import type { Message, MessageEvent } from "@/types/message";
import { cn } from "@/lib/utils";
import MediaPreview from "./MediaPreview";

export interface MessageBubbleProps {
  msg: Message;
  annotations: MessageEvent[];
  quotedMsg?: Message;
}

export default function MessageBubble({
  msg,
  annotations,
  quotedMsg,
}: MessageBubbleProps) {
  const { t } = useTranslation();
  const ts = new Date(msg.timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const reactionsByActor = new Map<string, MessageEvent>();
  for (const ev of annotations) {
    if (ev.kind === "reaction") reactionsByActor.set(ev.actorJid, ev);
  }
  const activeReactions = [...reactionsByActor.values()].filter(
    (ev) => ev.emoji,
  );

  const isDeleted = annotations.some((ev) => ev.kind === "delete");
  const edits = annotations
    .filter((ev) => ev.kind === "edit")
    .sort((a, b) => b.observedAt - a.observedAt);
  const latestEdit = edits[0];
  const displayText = latestEdit?.newText || msg.text;

  return (
    <div
      className={cn(
        "flex flex-col mb-2 max-w-[75%]",
        msg.isFromMe ? "self-end items-end" : "self-start items-start",
      )}
    >
      {quotedMsg && (
        <div className="text-xs bg-muted/50 border-s-2 border-primary px-2 py-1 rounded mb-1 max-w-full">
          <span className="text-muted-foreground">↩ </span>
          <span className="text-muted-foreground">
            {quotedMsg.text
              ? quotedMsg.text.slice(0, 80) +
                (quotedMsg.text.length > 80 ? "…" : "")
              : quotedMsg.mediaType
                ? `[${quotedMsg.mediaType}]`
                : "[message]"}
          </span>
        </div>
      )}
      {!quotedMsg && msg.quotedMessageId && (
        <div className="text-xs bg-muted/30 border-s-2 border-muted-foreground/30 px-2 py-1 rounded mb-1">
          <span className="text-muted-foreground">
            ↩ {t("messages.replyFallback")}
          </span>
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl px-3 py-2 text-sm",
          msg.isFromMe
            ? "bg-primary text-primary-foreground rounded-se-sm"
            : "bg-card border border-border rounded-ss-sm",
          isDeleted && "opacity-60 line-through",
        )}
      >
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

      <div className="flex items-center gap-1.5 mt-0.5 px-1">
        {isDeleted && (
          <span className="text-xs text-muted-foreground">
            🗑 {t("messages.deleted")}
          </span>
        )}
        {latestEdit && !isDeleted && (
          <span className="text-xs text-muted-foreground">
            ✏ {t("messages.edited")}
          </span>
        )}
        <time className="text-xs text-muted-foreground">{ts}</time>
      </div>

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
