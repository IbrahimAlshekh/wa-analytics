import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export interface LightboxProps {
  src: string;
  caption?: string;
  time: string;
  onClose: () => void;
}

export default function Lightbox({
  src,
  caption,
  time,
  onClose,
}: LightboxProps) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center gap-3"
      onClick={onClose}
    >
      <img
        src={src}
        alt={t("stories.mediaAlt")}
        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="text-center">
        {caption && <p className="text-white text-sm mb-1">{caption}</p>}
        <p className="text-white/60 text-xs">{time}</p>
      </div>
      <button
        className="fixed top-4 inset-e-5 text-white text-2xl leading-none hover:opacity-70 transition-opacity"
        onClick={onClose}
      >
        <X className="size-6" />
      </button>
    </div>
  );
}
