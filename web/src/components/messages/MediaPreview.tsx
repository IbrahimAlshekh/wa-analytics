import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getMediaUrl } from "@/lib/media";

export interface MediaPreviewProps {
  type?: string;
  path: string;
}

export default function MediaPreview({ type, path }: MediaPreviewProps) {
  const { t } = useTranslation();
  const url = useMemo(() => getMediaUrl(path), [path]);

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={t("messages.mediaAlt")}
          className="max-w-full max-h-72 rounded object-cover block"
        />
      </a>
    );
  }

  if (type === "video") {
    return (
      <video src={url} controls className="max-w-full max-h-72 rounded block" />
    );
  }

  if (type === "audio") {
    return <audio src={url} controls className="max-w-full" />;
  }

  if (type === "sticker") {
    return (
      <img
        src={url}
        alt={t("messages.sticker")}
        className="size-28 object-contain block"
      />
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded">
      <span className="text-xl">📄</span>
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {type || t("messages.file")}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline"
        >
          {t("messages.messageFallback")}
        </a>
      </div>
    </div>
  );
}
