import type { Contact } from "./contact";

export type TimelineKind = "presence" | "picture" | "about" | "message";

export interface TimelineEntry {
  kind: TimelineKind;
  at: number;
  state?: "available" | "unavailable";
  lastSeen?: number;
  text?: string;
  pictureId?: string;
  url?: string;
  mediaPath?: string;
  isFromMe?: boolean;
  mediaType?: string;
}

export interface TimelineResponse {
  contact: Contact;
  entries: TimelineEntry[];
}

export interface DayBucket {
  date: string;
  onlineSeconds: number;
}

export interface StatsSummary {
  range: string;
  startUnix: number;
  endUnix: number;
  days: DayBucket[];
  onlineSecondsAll: number;
  pictureChanges: number;
  aboutChanges: number;
}
