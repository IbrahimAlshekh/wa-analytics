import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
export default function Messages() {
    const { id: accountIdStr, cid: cidStr } = useParams();
    const accountId = Number(accountIdStr);
    const cid = Number(cidStr);
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery({
        queryKey: ["messages", accountId, cid],
        queryFn: ({ pageParam }) => api.messages(accountId, cid, pageParam, 50),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            if (!lastPage || lastPage.length < 50)
                return undefined;
            return lastPage[lastPage.length - 1].timestamp;
        },
    });
    const msgs = (data?.pages ?? []).flat();
    return (_jsxs("div", { className: "col", style: { gap: 16 }, children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsx(Link, { to: `/accounts/${accountId}/contacts/${cid}`, className: "muted", children: "\u2190 back to contact" }), _jsxs("span", { className: "muted", style: { fontSize: 13 }, children: [msgs.length, " messages loaded"] })] }), isLoading && _jsx("div", { className: "muted", children: "Loading\u2026" }), error && _jsx("div", { className: "error", children: error.message }), _jsxs("div", { className: "messages-list", children: [msgs.length === 0 && !isLoading && (_jsx("div", { className: "muted", style: { padding: 24, textAlign: "center" }, children: "No messages recorded yet." })), msgs.map((m) => (_jsx(MessageBubble, { msg: m }, m.id)))] }), hasNextPage && (_jsx("div", { style: { textAlign: "center" }, children: _jsx("button", { className: "btn", onClick: () => fetchNextPage(), disabled: isFetchingNextPage, children: isFetchingNextPage ? "Loading…" : "Load older messages" }) }))] }));
}
function MessageBubble({ msg }) {
    const ts = new Date(msg.timestamp * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
    return (_jsxs("div", { className: `message-bubble ${msg.isFromMe ? "message-me" : "message-them"}`, children: [_jsx("div", { className: "message-body", children: msg.text ? (_jsx("span", { children: msg.text })) : msg.mediaType ? (_jsxs("span", { className: "muted", children: ["[", msg.mediaType, "]"] })) : (_jsx("span", { className: "muted", children: "[message]" })) }), _jsx("time", { className: "message-time", children: ts })] }));
}
