import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function Timeline({ entries }) {
    if (!entries.length) {
        return _jsx("div", { className: "muted", children: "No events yet." });
    }
    const groups = groupByDay(entries);
    return (_jsx("div", { className: "timeline", children: groups.map(([day, group]) => (_jsxs("div", { className: "timeline-day", children: [_jsx("h3", { children: day }), group.map((entry, i) => (_jsxs("div", { className: "timeline-entry", children: [_jsx("time", { children: formatTime(entry.at) }), _jsx(EntryLine, { entry: entry })] }, `${day}-${i}`)))] }, day))) }));
}
function EntryLine({ entry }) {
    switch (entry.kind) {
        case "presence":
            if (entry.state === "available")
                return _jsx("span", { children: _jsx("strong", { children: "Online" }) });
            return (_jsxs("span", { children: [_jsx("strong", { children: "Offline" }), entry.lastSeen
                        ? ` (last seen ${formatTime(entry.lastSeen)})`
                        : ""] }));
        case "picture":
            return (_jsxs("span", { children: ["Profile picture changed", entry.url ? (_jsxs(_Fragment, { children: [" ", _jsx("a", { href: entry.url, target: "_blank", rel: "noreferrer", children: "view" })] })) : null] }));
        case "about":
            return (_jsxs("span", { children: ["About updated:", " ", _jsx("em", { children: entry.text || "(empty)" })] }));
    }
}
function groupByDay(entries) {
    const map = new Map();
    for (const e of entries) {
        const d = new Date(e.at * 1000);
        const key = d.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
        });
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(e);
    }
    return Array.from(map.entries()).reverse();
}
function formatTime(unix) {
    return new Date(unix * 1000).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });
}
