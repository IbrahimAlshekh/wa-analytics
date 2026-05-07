import type { TimelineEntry } from "../lib/types";

interface Props {
  entries: TimelineEntry[];
}

export default function Timeline({ entries }: Props) {
  if (!entries.length) {
    return <div className="muted">No events yet.</div>;
  }
  const groups = groupByDay(entries);
  return (
    <div className="timeline">
      {groups.map(([day, group]) => (
        <div key={day} className="timeline-day">
          <h3>{day}</h3>
          {group.map((entry, i) => (
            <div className="timeline-entry" key={`${day}-${i}`}>
              <time>{formatTime(entry.at)}</time>
              <EntryLine entry={entry} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EntryLine({ entry }: { entry: TimelineEntry }) {
  switch (entry.kind) {
    case "presence":
      if (entry.state === "available")
        return <span><strong>Online</strong></span>;
      return (
        <span>
          <strong>Offline</strong>
          {entry.lastSeen
            ? ` (last seen ${formatTime(entry.lastSeen)})`
            : ""}
        </span>
      );
    case "picture":
      return (
        <span>
          Profile picture changed
          {entry.url ? (
            <>
              {" "}
              <a href={entry.url} target="_blank" rel="noreferrer">view</a>
            </>
          ) : null}
        </span>
      );
    case "about":
      return (
        <span>
          About updated:{" "}
          <em>{entry.text || "(empty)"}</em>
        </span>
      );
  }
}

function groupByDay(entries: TimelineEntry[]): [string, TimelineEntry[]][] {
  const map = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const d = new Date(e.at * 1000);
    const key = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).reverse();
}

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
