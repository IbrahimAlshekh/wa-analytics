import type { TimelineEntry } from "@/types/timeline";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Session parsing

export function parseSessions(entries: TimelineEntry[]): {
  durations: number[];
} {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  const durations: number[] = [];
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      durations.push(p.at - onlineAt);
      onlineAt = null;
    }
  }
  return { durations };
}

// ---------------------------------------------------------------------------
// Hour / weekday distribution

export function distributeToHours(
  buckets: number[],
  start: number,
  end: number,
) {
  let cur = start;
  while (cur < end) {
    const hour = new Date(cur * 1000).getHours();
    const next = Math.floor(cur / 3600) * 3600 + 3600;
    const sliceEnd = Math.min(end, next);
    buckets[hour] += sliceEnd - cur;
    cur = sliceEnd;
  }
}

export function distributeToWeekdays(
  buckets: number[],
  start: number,
  end: number,
) {
  let cur = start;
  while (cur < end) {
    const d = new Date(cur * 1000);
    const dow = d.getDay();
    const next = new Date(d);
    next.setHours(24, 0, 0, 0);
    const sliceEnd = Math.min(end, Math.floor(next.getTime() / 1000));
    buckets[dow] += sliceEnd - cur;
    cur = sliceEnd;
  }
}

// ---------------------------------------------------------------------------
// Daily seconds per day

export function buildDailySeconds(
  entries: TimelineEntry[],
): Record<string, number> {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  const byDay: Record<string, number> = {};
  let onlineAt: number | null = null;
  const add = (start: number, end: number) => {
    let cur = start;
    while (cur < end) {
      const date = new Date(cur * 1000).toISOString().slice(0, 10);
      const d = new Date(cur * 1000);
      d.setHours(24, 0, 0, 0);
      const sliceEnd = Math.min(end, Math.floor(d.getTime() / 1000));
      byDay[date] = (byDay[date] ?? 0) + (sliceEnd - cur);
      cur = sliceEnd;
    }
  };
  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      add(onlineAt, p.at);
      onlineAt = null;
    }
  }
  if (onlineAt != null) add(onlineAt, Math.floor(Date.now() / 1000));
  return byDay;
}

// ---------------------------------------------------------------------------
// Compute functions

export function computePeakHours(entries: TimelineEntry[]) {
  const buckets = new Array(24).fill(0);
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      distributeToHours(buckets, onlineAt, p.at);
      onlineAt = null;
    }
  }
  if (onlineAt != null)
    distributeToHours(buckets, onlineAt, Math.floor(Date.now() / 1000));
  return buckets.map((sec, i) => ({
    hour: i.toString().padStart(2, "0"),
    minutes: Math.round(sec / 60),
  }));
}

export function computeWeekdayActivity(entries: TimelineEntry[]) {
  const buckets = new Array(7).fill(0);
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      distributeToWeekdays(buckets, onlineAt, p.at);
      onlineAt = null;
    }
  }
  if (onlineAt != null)
    distributeToWeekdays(buckets, onlineAt, Math.floor(Date.now() / 1000));
  return [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    day: WEEKDAYS[i],
    minutes: Math.round(buckets[i] / 60),
    weekend: i === 0 || i === 6,
  }));
}

export function computeAvgSessionDuration(
  entries: TimelineEntry[],
): number | null {
  const { durations } = parseSessions(entries);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

export function computeLongestSession(entries: TimelineEntry[]): number | null {
  const { durations } = parseSessions(entries);
  if (durations.length === 0) return null;
  return Math.max(...durations);
}

export function computeStreak(
  entries: TimelineEntry[],
): { online: boolean; days: number; seconds: number } | null {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  if (presence.length === 0) return null;
  const last = presence[presence.length - 1];
  if (last.state === "unavailable") {
    return {
      online: false,
      days: 0,
      seconds: Math.floor(Date.now() / 1000) - last.at,
    };
  }
  const activeDays = new Set<string>();
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      activeDays.add(new Date(onlineAt * 1000).toISOString().slice(0, 10));
      onlineAt = null;
    }
  }
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (activeDays.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }
  return { online: true, days: streak, seconds: 0 };
}

export function computeLongestOfflineStreak(
  entries: TimelineEntry[],
): number | null {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  if (presence.length === 0) return null;
  const activeDays = new Set<string>();
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      activeDays.add(new Date(onlineAt * 1000).toISOString().slice(0, 10));
      onlineAt = null;
    }
  }
  if (activeDays.size === 0) return null;
  const sorted = [...activeDays].sort();
  const start = new Date(sorted[0] + "T00:00:00");
  const end = new Date(sorted[sorted.length - 1] + "T00:00:00");
  let maxGap = 0,
    gap = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (activeDays.has(key)) {
      maxGap = Math.max(maxGap, gap);
      gap = 0;
    } else gap++;
  }
  return maxGap > 0 ? maxGap : null;
}

export function computeDailyAvgOnline(entries: TimelineEntry[]): {
  avgOnlineSec: number | null;
  trendPct: number | null;
} {
  const byDay = buildDailySeconds(entries);
  const days = Object.values(byDay);
  if (days.length === 0) return { avgOnlineSec: null, trendPct: null };
  const avgOnlineSec = Math.round(
    days.reduce((a, b) => a + b, 0) / days.length,
  );
  const sorted = Object.keys(byDay).sort();
  let trendPct: number | null = null;
  if (sorted.length >= 14) {
    const recent = sorted.slice(-7).reduce((s, d) => s + byDay[d], 0) / 7;
    const prev = sorted.slice(-14, -7).reduce((s, d) => s + byDay[d], 0) / 7;
    if (prev > 0) trendPct = Math.round(((recent - prev) / prev) * 100);
  }
  return { avgOnlineSec, trendPct };
}

export function computeNightOwlScore(entries: TimelineEntry[]): number | null {
  const buckets = new Array(24).fill(0);
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      distributeToHours(buckets, onlineAt, p.at);
      onlineAt = null;
    }
  }
  if (onlineAt != null)
    distributeToHours(buckets, onlineAt, Math.floor(Date.now() / 1000));
  const total = buckets.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const nightTime = buckets.slice(0, 5).reduce((a, b) => a + b, 0);
  return Math.round((nightTime / total) * 100);
}

export function computeConsistencyScore(
  entries: TimelineEntry[],
): number | null {
  const byDay = buildDailySeconds(entries);
  const vals = Object.values(byDay);
  if (vals.length < 3) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean === 0) return null;
  const std = Math.sqrt(
    vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length,
  );
  const cv = std / mean;
  return Math.max(0, Math.round(100 - cv * 100));
}

export function computePicChangeFrequency(
  entries: TimelineEntry[],
): number | null {
  const pics = entries
    .filter((e) => e.kind === "picture")
    .sort((a, b) => a.at - b.at);
  if (pics.length < 2) return null;
  const span = (pics[pics.length - 1].at - pics[0].at) / 86400;
  return Math.round(span / (pics.length - 1));
}

export function computeFirstLastSeen(entries: TimelineEntry[]): {
  firstSeen: number | null;
  lastSeen: number | null;
} {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  if (presence.length === 0) return { firstSeen: null, lastSeen: null };
  return {
    firstSeen: presence[0].at,
    lastSeen: presence[presence.length - 1].at,
  };
}

export function computeSleepWindow(entries: TimelineEntry[]): string | null {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  if (presence.length === 0) return null;

  const gaps: { start: number; end: number }[] = [];
  for (let i = 1; i < presence.length; i++) {
    if (
      presence[i - 1].state === "unavailable" &&
      presence[i].state === "available"
    ) {
      gaps.push({ start: presence[i - 1].at, end: presence[i].at });
    }
  }

  const nightGaps = gaps.filter((g) => {
    const dur = g.end - g.start;
    if (dur < 3 * 3600) return false;
    const startH = new Date(g.start * 1000).getHours();
    return startH >= 20 || startH <= 4;
  });

  if (nightGaps.length < 3) return null;

  const toRad = (h: number, m: number) => ((h + m / 60) / 24) * 2 * Math.PI;
  const circMean = (angles: number[]) => {
    const sx = angles.reduce((s, a) => s + Math.sin(a), 0) / angles.length;
    const cx = angles.reduce((s, a) => s + Math.cos(a), 0) / angles.length;
    const r = Math.atan2(sx, cx);
    return ((r < 0 ? r + 2 * Math.PI : r) / (2 * Math.PI)) * 24;
  };

  const startAngles = nightGaps.map((g) => {
    const d = new Date(g.start * 1000);
    return toRad(d.getHours(), d.getMinutes());
  });
  const endAngles = nightGaps.map((g) => {
    const d = new Date(g.end * 1000);
    return toRad(d.getHours(), d.getMinutes());
  });

  const avgStart = circMean(startAngles);
  const avgEnd = circMean(endAngles);

  const fmt = (h: number) => {
    const hr = Math.floor(h) % 24;
    const suffix = hr < 12 ? "am" : "pm";
    return `${hr % 12 === 0 ? 12 : hr % 12}${suffix}`;
  };
  return `${fmt(avgStart)} – ${fmt(avgEnd)}`;
}

export function computeOnlinePatternSummary(
  hourlyData: { hour: string; minutes: number }[],
): string | null {
  const threshold = Math.max(...hourlyData.map((d) => d.minutes)) * 0.5;
  if (threshold === 0) return null;
  const active = hourlyData
    .map((d, i) => ({ i, m: d.minutes }))
    .filter((d) => d.m >= threshold)
    .map((d) => d.i);
  if (active.length === 0) return null;
  const fmt = (h: number) =>
    `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
  return `${fmt(active[0])} – ${fmt(active[active.length - 1])}`;
}

export function computeTrend30Days(entries: TimelineEntry[]) {
  const byDay = buildDailySeconds(entries);
  const result: { date: string; minutes: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({
      date: key.slice(5),
      minutes: Math.round((byDay[key] ?? 0) / 60),
    });
  }
  return result;
}

export function computeHeatmap(entries: TimelineEntry[]) {
  const byDay = buildDailySeconds(entries);
  const result: { date: string; minutes: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 111; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, minutes: Math.round((byDay[key] ?? 0) / 60) });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Export CSV

export function exportCSV(entries: TimelineEntry[]) {
  const header = "timestamp,datetime,type,state,text,isFromMe,mediaType,url";
  const rows = entries
    .sort((a, b) => a.at - b.at)
    .map((e) =>
      [
        e.at,
        new Date(e.at * 1000).toISOString(),
        e.kind,
        e.state ?? "",
        JSON.stringify(e.text ?? ""),
        e.isFromMe ?? "",
        e.mediaType ?? "",
        e.url ?? "",
      ].join(","),
    );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contact-timeline.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Format helpers

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDatetime(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
