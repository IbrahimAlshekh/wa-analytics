export interface Account {
  id: number;
  jid: string;
  label: string;
  trackingActive: boolean;
  createdAt: number;
  connected: boolean;
}

export interface Contact {
  id: number;
  jid: string;
  phone: string;
  displayName: string;
  addedAt: number;
  trackingEnabled: boolean;
}

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

export interface Message {
  id: number;
  accountId: number;
  contactId?: number;
  chatJid: string;
  messageId: string;
  senderJid: string;
  isFromMe: boolean;
  timestamp: number;
  text?: string;
  mediaType?: string;
  mediaPath?: string;
  receivedAt: number;
}

export type WSEnvelope =
  | { type: "auth.qr"; code: string }
  | { type: "auth.linked"; accountID: number; ownJID: string }
  | { type: "auth.logout"; accountID: number; reason?: string }
  | {
      type: "presence";
      accountId: number;
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
    }
  | {
      type: "message";
      accountId: number;
      contactId?: number;
      chatJid: string;
      messageId: string;
      from: string;
      isFromMe: boolean;
      text?: string;
      mediaType?: string;
      mediaPath?: string;
      timestamp: number;
    };
