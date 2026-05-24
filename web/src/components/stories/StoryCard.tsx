import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Story } from "@/types/story";
import { getMediaUrl } from "@/lib/media";
import { formatDatetime } from "@/lib/presence-stats";
import Lightbox from "./Lightbox";

export interface StoryCardProps {
  story: Story;
}

export default function StoryCard({ story }: StoryCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const hasMedia = Boolean(story.mediaPath);
  const isVideo = story.mediaType === "video";
  const isImage = story.mediaType === "image";
  const isText = !story.mediaType || story.mediaType === "";

  return (
    <>
      <div
        className="rounded-xl border border-border overflow-hidden bg-card cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => hasMedia && setExpanded(true)}
      >
        {isImage && story.mediaPath && (
          <img
            src={getMediaUrl(story.mediaPath)}
            alt={t("stories.storyAlt")}
            className="w-full aspect-9/16 object-cover block"
          />
        )}
        {isVideo && story.mediaPath && (
          <div className="relative aspect-9/16 bg-black">
            <video
              src={getMediaUrl(story.mediaPath)}
              className="w-full h-full object-cover"
              onClick={(e) => e.stopPropagation()}
              controls
            />
          </div>
        )}
        {isText && (
          <div className="aspect-9/16 bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center p-4">
            <span className="text-sm text-center leading-relaxed font-medium">
              {story.caption || (
                <em className="text-muted-foreground not-italic">
                  {t("stories.textStory")}
                </em>
              )}
            </span>
          </div>
        )}
        {story.mediaType &&
          !["image", "video", ""].includes(story.mediaType) &&
          story.mediaPath && (
            <div className="aspect-9/16 bg-muted flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">📄</span>
              <span className="text-xs text-muted-foreground">
                {story.mediaType}
              </span>
              <a
                href={getMediaUrl(story.mediaPath)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {t("stories.download")}
              </a>
            </div>
          )}

        <div className="px-2.5 py-2 border-t border-border">
          {story.caption && !isText && (
            <p className="text-xs truncate mb-0.5">{story.caption}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {formatDatetime(story.postedAt)}
          </p>
        </div>
      </div>

      {expanded && isImage && story.mediaPath && (
        <Lightbox
          src={getMediaUrl(story.mediaPath)}
          caption={story.caption}
          time={formatDatetime(story.postedAt)}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}
