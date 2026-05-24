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
