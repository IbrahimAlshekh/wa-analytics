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
    }
  | { type: "history_sync"; accountId: number }
  | { type: "message_event"; accountId: number; contactId: number }
  | {
      type: "story";
      accountId: number;
      contactId: number;
      storyId: string;
      mediaType?: string;
      postedAt: number;
    };
