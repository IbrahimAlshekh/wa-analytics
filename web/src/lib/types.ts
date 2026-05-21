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
  latestPicturePath?: string;
}

export interface ContactsPage {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
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
  quotedMessageId?: string;
}

export interface MessageEvent {
  id: number;
  accountId: number;
  contactId?: number;
  targetMessageId: string;
  kind: "reaction" | "delete" | "edit";
  actorJid: string;
  isFromMe: boolean;
  emoji?: string;
  newText?: string;
  observedAt: number;
}

export interface MessagesPage {
  messages: Message[];
  events: MessageEvent[];
}

export interface TokenCount {
  token: string;
  count: number;
}

export interface MonthRow {
  month: string;
  me: number;
  them: number;
  total: number;
  meSharePct: number;
}

export type AnalyticsRange = "day" | "week" | "month" | "all";

export interface AnalyticsEmotionCounts {
  love: number;
  miss: number;
  happy: number;
  sad: number;
  care: number;
  encourage: number;
  apology: number;
  gratitude: number;
}

export interface AnalyticsVolumeSide {
  messages: number;
  words: number;
  avgWordsPerMsg: number;
  voiceNotes: number;
  photos: number;
  videos: number;
  stickers: number;
  documents: number;
  links: number;
  questions: number;
  sharePct: number;
}

export interface AnalyticsReport {
  range: AnalyticsRange;
  startUnix: number;
  endUnix: number;
  timeline: {
    firstMsgUnix: number;
    lastMsgUnix: number;
    spanDays: number;
    daysWithComms: number;
    longestStreakDays: number;
    highestVolumeDayDate: string;
    highestVolumeDayCount: number;
  };
  volume: {
    me: AnalyticsVolumeSide;
    them: AnalyticsVolumeSide;
  };
  temporal: {
    hourHistMe: number[];
    hourHistThem: number[];
    dowMe: number[];
    dowThem: number[];
    nightPctMe: number;
    nightPctThem: number;
    monthly: MonthRow[];
  };
  emotion: {
    countsMe: AnalyticsEmotionCounts;
    countsThem: AnalyticsEmotionCounts;
    laughterMsgsMe: number;
    laughterMsgsThem: number;
    questionsMe: number;
    questionsThem: number;
  };
  initiation: {
    initiatedMe: number;
    initiatedThem: number;
    initiationMeSharePct: number;
    avgRespMeSec: number;
    avgRespThemSec: number;
    medianRespMeSec: number;
    medianRespThemSec: number;
    sessions: number;
    avgSessionMsgs: number;
    longestSilenceSec: number;
    avgSilenceSec: number;
    medianRespAllSec: number;
  };
  language: {
    topEmojisMe: TokenCount[];
    topEmojisThem: TokenCount[];
    topWordsMe: TokenCount[];
    topWordsThem: TokenCount[];
    topDomainsMe: TokenCount[];
    topDomainsThem: TokenCount[];
  };
  indicators: {
    wordBalancePct: number;
    msgBalancePct: number;
    dailyConsistencyPct: number;
    medianRespAllSec: number;
    initiationMePct: number;
    syncLaughDays: number;
    totalQuestions: number;
    totalLaughter: number;
    meShareTrendPct: number;
  };
}

export interface ScheduleSlot {
  id: number;
  startMin: number;
  endMin: number;
}

export interface AccountSchedule {
  forceOffline: boolean;
  slots: ScheduleSlot[];
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
    }
  | { type: "history_sync"; accountId: number }
  | { type: "message_event"; accountId: number; contactId: number };
