import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function SessionTimeline({ entries }) {
    if (!entries.length) {
        return _jsx("div", { className: "muted", children: "No events yet." });
    }
    const messages = entries
        .filter((e) => e.kind === "message")
        .sort((a, b) => b.at - a.at)
        .slice(0, 10);
    const statusEntries = entries.filter((e) => e.kind !== "message");
    const blocks = buildBlocks(statusEntries);
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 24 }, children: [_jsxs("div", { children: [_jsx("h4", { style: { margin: "0 0 8px", color: "var(--fg-muted, #888)" }, children: "Recent Messages" }), messages.length === 0 ? (_jsx("div", { className: "muted", children: "No messages yet." })) : (_jsx("div", { className: "session-timeline", children: messages.map((e, i) => (_jsxs("div", { className: "session-event", children: [_jsx("time", { className: "session-time", children: formatTime(e.at) }), _jsxs("span", { children: [e.isFromMe ? "Sent" : "Received", ":", " ", _jsx("em", { style: { fontStyle: "normal", color: "var(--fg)" }, children: e.text || _jsx("span", { className: "muted", children: "[media]" }) })] })] }, i))) }))] }), _jsxs("div", { children: [_jsx("h4", { style: { margin: "0 0 8px", color: "var(--fg-muted, #888)" }, children: "Status" }), blocks.length === 0 ? (_jsx("div", { className: "muted", children: "No sessions recorded yet." })) : (_jsx("div", { className: "session-timeline", children: blocks.map((b, i) => {
                            if (b.type === "session")
                                return _jsx(SessionBlock, { session: b.session }, i);
                            if (b.type === "offline-gap")
                                return _jsx(GapBlock, { fromAt: b.fromAt, toAt: b.toAt }, i);
                            return _jsx(EventBlock, { ev: b.ev }, i);
                        }) }))] })] }));
}
function SessionBlock({ session }) {
    const start = formatTime(session.startAt);
    const end = session.endAt ? formatTime(session.endAt) : "now";
    const dur = session.durationSec != null ? formatDuration(session.durationSec) : null;
    const lastSeenDiff = session.lastSeen != null && session.endAt != null
        ? session.endAt - session.lastSeen
        : null;
    return (_jsxs("div", { className: "session-block session-online", children: [_jsxs("div", { className: "session-header", children: [_jsx("span", { className: "session-dot session-dot-online" }), _jsxs("span", { className: "session-label", children: ["Online ", start, " \u2013 ", end, dur ? _jsxs("span", { className: "session-duration", children: ["(", dur, ")"] }) : null] })] }), lastSeenDiff != null && lastSeenDiff > 0 && (_jsxs("div", { className: "session-meta", children: ["Last activity ", formatDuration(lastSeenDiff), " before going offline"] }))] }));
}
function GapBlock({ fromAt, toAt }) {
    const dur = formatDuration(toAt - fromAt);
    return (_jsxs("div", { className: "session-block session-offline", children: [_jsx("span", { className: "session-dot session-dot-offline" }), _jsxs("span", { className: "session-label session-muted", children: ["Offline ", dur] })] }));
}
function EventBlock({ ev }) {
    return (_jsxs("div", { className: "session-event", children: [_jsx("time", { className: "session-time", children: formatTime(ev.at) }), ev.kind === "picture" ? (_jsxs("span", { children: ["Profile picture changed", ev.url ? (_jsxs(_Fragment, { children: [" ", _jsx("a", { href: ev.url, target: "_blank", rel: "noreferrer", children: "view" })] })) : null] })) : (_jsxs("span", { children: ["About updated: ", _jsx("em", { children: ev.text || "(empty)" })] }))] }));
}
// ---------------------------------------------------------------------------
// Build display blocks from raw timeline entries.
function buildBlocks(entries) {
    const presence = entries
        .filter((e) => e.kind === "presence")
        .sort((a, b) => a.at - b.at);
    const nonPresence = entries
        .filter((e) => e.kind === "picture" || e.kind === "about")
        .map((e) => ({
        kind: e.kind,
        at: e.at,
        text: e.text,
        url: e.url,
    }))
        .sort((a, b) => a.at - b.at);
    // Pair online→offline into sessions.
    const sessions = [];
    let sessionStart = null;
    let sessionLastSeen = null;
    let lastOfflineAt = null;
    for (const p of presence) {
        if (p.state === "available") {
            sessionStart = p.at;
            sessionLastSeen = null;
        }
        else if (p.state === "unavailable" && sessionStart != null) {
            const dur = p.at - sessionStart;
            sessions.push({
                startAt: sessionStart,
                endAt: p.at,
                lastSeen: p.lastSeen ?? null,
                durationSec: dur,
            });
            sessionStart = null;
            sessionLastSeen = null;
            lastOfflineAt = p.at;
        }
        else if (p.state === "unavailable") {
            // Standalone unavailable (no prior available in this window)
            lastOfflineAt = p.at;
        }
    }
    // Currently online
    if (sessionStart != null) {
        sessions.push({
            startAt: sessionStart,
            endAt: null,
            lastSeen: sessionLastSeen,
            durationSec: null,
        });
        // Clear offline marker — currently online
        lastOfflineAt = null;
    }
    // Merge sessions whose gap is under MERGE_GAP_SEC into a single session.
    const MERGE_GAP_SEC = 120;
    const merged = [];
    for (const s of sessions) {
        const prev = merged[merged.length - 1];
        if (prev && prev.endAt != null && s.startAt - prev.endAt <= MERGE_GAP_SEC) {
            prev.endAt = s.endAt;
            prev.durationSec = prev.endAt != null ? prev.endAt - prev.startAt : null;
            prev.lastSeen = s.lastSeen ?? prev.lastSeen;
        }
        else {
            merged.push({ ...s });
        }
    }
    // Build alternating blocks: offline-gap then session.
    const blocks = [];
    for (let i = 0; i < merged.length; i++) {
        const prev = merged[i - 1];
        const cur = merged[i];
        if (prev && prev.endAt != null) {
            const gapSec = cur.startAt - prev.endAt;
            if (gapSec > 30) {
                blocks.push({ type: "offline-gap", fromAt: prev.endAt, toAt: cur.startAt });
            }
        }
        blocks.push({ type: "session", session: cur });
    }
    // Interleave non-presence events at their natural position.
    const mixed = [];
    let bi = 0;
    for (const ev of nonPresence) {
        while (bi < blocks.length) {
            const b = blocks[bi];
            const bAt = b.type === "session"
                ? b.session.startAt
                : b.type === "offline-gap"
                    ? b.fromAt
                    : b.ev.at;
            if (bAt > ev.at)
                break;
            mixed.push(blocks[bi++]);
        }
        mixed.push({ type: "event", ev });
    }
    while (bi < blocks.length)
        mixed.push(blocks[bi++]);
    // Reverse so newest is at top.
    const reversed = mixed.reverse();
    // If the person is currently offline (no open session), prepend an indicator.
    if (lastOfflineAt != null) {
        const offlineSince = Math.floor(Date.now() / 1000 - lastOfflineAt);
        const offlineBlock = {
            type: "offline-gap",
            fromAt: lastOfflineAt,
            toAt: Math.floor(Date.now() / 1000),
        };
        // Only prepend if it's a meaningful gap (>30s) and not already shown.
        if (offlineSince > 30) {
            return [offlineBlock, ...reversed];
        }
    }
    return reversed;
}
// ---------------------------------------------------------------------------
// Helpers
function formatTime(unix) {
    return new Date(unix * 1000).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });
}
function formatDuration(sec) {
    if (sec < 60)
        return `${sec}s`;
    const m = Math.floor(sec / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0)
        return `${d}d ${h % 24}h`;
    if (h > 0)
        return `${h}h ${m % 60}m`;
    return `${m}m`;
}
