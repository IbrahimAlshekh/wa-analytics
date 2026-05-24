import type { AnalyticsEmotionCounts } from "../../lib/types";

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const EMOTION_KEYS: (keyof AnalyticsEmotionCounts)[] = [
  "love", "miss", "happy", "sad", "care", "encourage", "apology", "gratitude",
];

export const EMOTION_ICONS: Record<keyof AnalyticsEmotionCounts, string> = {
  love: "❤️", miss: "💭", happy: "😊", sad: "😢",
  care: "🤗", encourage: "💪", apology: "🙏", gratitude: "🌟",
};
