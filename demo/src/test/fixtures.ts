import type {
  Account,
  AnalyticsReport,
  Contact,
  TimelineEntry,
} from "@/lib/types";

let _seq = 1;
const seq = () => _seq++;

export function makeAccount(overrides: Partial<Account> & { id?: number } = {}): Account {
  const id = overrides.id ?? seq();
  return {
    id,
    jid: `4917${id}@s.whatsapp.net`,
    label: `Account ${id}`,
    trackingActive: true,
    connected: true,
    createdAt: 1700000000,
    ...overrides,
  };
}

export function makeContact(
  overrides: Partial<Contact> & { accountId?: number } = {},
): Contact {
  const id = overrides.id ?? seq();
  const { accountId: _accountId, ...rest } = overrides;
  return {
    id,
    jid: `4917${id}@s.whatsapp.net`,
    phone: `4917${id}`,
    displayName: `Contact ${id}`,
    addedAt: 1700000000,
    trackingEnabled: true,
    ...rest,
  };
}

export function makeTimelineEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    kind: "presence",
    at: 1700000000,
    state: "available",
    ...overrides,
  };
}

function zeroVolumeSide() {
  return {
    messages: 0,
    words: 0,
    avgWordsPerMsg: 0,
    voiceNotes: 0,
    photos: 0,
    videos: 0,
    stickers: 0,
    documents: 0,
    links: 0,
    questions: 0,
    sharePct: 0,
  };
}

function zeroEmotions() {
  return {
    love: 0,
    miss: 0,
    happy: 0,
    sad: 0,
    care: 0,
    encourage: 0,
    apology: 0,
    gratitude: 0,
  };
}

export function makeAnalyticsReport(
  overrides: Partial<AnalyticsReport> = {},
): AnalyticsReport {
  return {
    range: "week",
    startUnix: 1700000000,
    endUnix: 1700604800,
    timeline: {
      firstMsgUnix: 1700000000,
      lastMsgUnix: 1700604800,
      spanDays: 7,
      daysWithComms: 5,
      longestStreakDays: 3,
      highestVolumeDayDate: "2023-11-15",
      highestVolumeDayCount: 10,
    },
    volume: { me: zeroVolumeSide(), them: zeroVolumeSide() },
    temporal: {
      hourHistMe: Array(24).fill(0),
      hourHistThem: Array(24).fill(0),
      dowMe: Array(7).fill(0),
      dowThem: Array(7).fill(0),
      nightPctMe: 0,
      nightPctThem: 0,
      monthly: [],
    },
    emotion: {
      countsMe: zeroEmotions(),
      countsThem: zeroEmotions(),
      laughterMsgsMe: 0,
      laughterMsgsThem: 0,
      questionsMe: 0,
      questionsThem: 0,
    },
    initiation: {
      initiatedMe: 0,
      initiatedThem: 0,
      initiationMeSharePct: 0,
      avgRespMeSec: 0,
      avgRespThemSec: 0,
      medianRespMeSec: 0,
      medianRespThemSec: 0,
      sessions: 0,
      avgSessionMsgs: 0,
      longestSilenceSec: 0,
      avgSilenceSec: 0,
      medianRespAllSec: 0,
    },
    language: {
      topEmojisMe: [],
      topEmojisThem: [],
      topWordsMe: [],
      topWordsThem: [],
      topDomainsMe: [],
      topDomainsThem: [],
    },
    indicators: {
      wordBalancePct: 0,
      msgBalancePct: 0,
      dailyConsistencyPct: 0,
      medianRespAllSec: 0,
      initiationMePct: 0,
      syncLaughDays: 0,
      totalQuestions: 0,
      totalLaughter: 0,
      meShareTrendPct: 0,
    },
    ...overrides,
  };
}
