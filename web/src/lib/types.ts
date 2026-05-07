export interface Contact {
  id: number;
  jid: string;
  phone: string;
  displayName: string;
  addedAt: number;
  trackingEnabled: boolean;
}

export interface AuthStatus {
  linked: boolean;
  connected: boolean;
  ownJID: string;
}

export type TimelineKind = "presence" | "picture" | "about";

export interface TimelineEntry {
  kind: TimelineKind;
  at: number;
  state?: "available" | "unavailable";
  lastSeen?: number;
  text?: string;
  pictureId?: string;
  url?: string;
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

export type WSEnvelope =
  | { type: "auth.qr"; code: string }
  | { type: "auth.linked"; ownJID: string }
  | { type: "auth.logout"; reason?: string }
  | {
      type: "presence";
      contactId: number;
      jid: string;
      state: "available" | "unavailable";
      lastSeen?: number;
      observedAt: number;
    }
  | {
      type: "picture";
      contactId: number;
      jid: string;
      pictureId?: string;
      url?: string;
      capturedAt: number;
    }
  | {
      type: "about";
      contactId: number;
      jid: string;
      text: string;
      capturedAt: number;
    };
