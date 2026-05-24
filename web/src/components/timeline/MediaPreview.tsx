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
      <a href={url} target="_blank" rel="noreferrer" className="block mt-1">
        <img
          src={url}
          alt="WhatsApp Media"
          className="max-w-48 max-h-36 rounded object-cover block mt-1"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-primary text-xs hover:underline"
    >
      {t("timeline.viewMedia", { type: type || "media" })}
    </a>
  );
}
