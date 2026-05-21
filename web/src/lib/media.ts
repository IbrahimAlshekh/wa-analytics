export function getMediaUrl(path: string): string {
  const token = localStorage.getItem("wt_bearer");
  if (!token) return `/media/${path}`;
  return `/media/${path}?token=${encodeURIComponent(token)}`;
}
