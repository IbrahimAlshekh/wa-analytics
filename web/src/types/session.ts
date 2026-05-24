export interface Session {
  startAt: number;
  endAt: number | null;
  lastSeen: number | null;
  durationSec: number | null;
}

export interface NonPresence {
  kind: "picture" | "about";
  at: number;
  text?: string;
  mediaPath?: string;
}

export type Block =
  | { type: "session"; session: Session }
  | { type: "offline-gap"; fromAt: number; toAt: number }
  | { type: "event"; ev: NonPresence };
