import { useState } from "react";
import { getMediaUrl } from "../lib/media";

function getInitials(name: string): string {
  if (name.startsWith("+")) return name.slice(1, 3);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  name: string;
  picturePath?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

export default function ContactAvatar({ name, picturePath, size = "md", className = "", style }: Props) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === "lg" ? "avatar-lg" : size === "sm" ? "avatar-sm" : "";
  const showPicture = picturePath && !imgError;

  return (
    <div
      className={`avatar ${sizeClass} ${className}`.trim()}
      style={{
        ...style,
        overflow: "hidden",
        padding: 0,
      }}
    >
      {showPicture ? (
        <img
          src={getMediaUrl(picturePath)}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
