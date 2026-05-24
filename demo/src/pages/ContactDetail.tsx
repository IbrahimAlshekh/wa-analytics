import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MessageSquare, Pause, Play, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import type { AnalyticsRange, TimelineEntry } from "../lib/types";
import SessionTimeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
import PresencePanel from "../components/PresencePanel";
import AnalyticsPanel from "../components/AnalyticsPanel";
import StoriesPanel from "../components/StoriesPanel";
import LiveStatusCard from "../components/LiveStatusCard";
import { useStore, wsKey } from "../lib/store";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMediaUrl } from "@/lib/media";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ContactDetail() {
  const { t } = useTranslation();
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const RANGE_LABELS: { value: AnalyticsRange; label: string }[] = [
    { value: "day", label: t("contactDetail.rangeDaily") },
    { value: "week", label: t("contactDetail.rangeWeekly") },
    { value: "all", label: t("contactDetail.rangeGeneral") },
  ];

  const [range, setRange] = useState<AnalyticsRange>("week");

  const { upsertContact, removeContact, addWsEntry, pruneWsEntries, setLastPresence } = useStore();
  const contact = useStore((s) => s.contacts[cid]);
  const wsEntries = useStore((s) => s.wsEntries[wsKey(accountId, cid)]) ?? [];

  const toggleTracking = useMutation({
    mutationFn: (enabled: boolean) =>
      api.updateContact(accountId, cid, { trackingEnabled: enabled }),
    onSuccess: (updated) => {
      upsertContact(updated);
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: () => api.deleteContact(accountId, cid),
    onSuccess: () => {
      removeContact(cid);
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
      navigate(`/accounts/${accountId}/contacts`);
    },
  });

  useEffect(() => {
    api.refreshPicture(accountId, cid).catch(() => {});
  }, [accountId, cid]);

  const tl = useQuery({
    queryKey: ["timeline", accountId, cid],
    queryFn: () => api.timeline(accountId, cid, 0),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (tl.data?.contact) upsertContact(tl.data.contact);
  }, [tl.data?.contact, upsertContact]);

  useEffect(() => {
    if (!tl.data?.entries) return;
    const latest = [...tl.data.entries]
      .filter((e) => e.kind === "presence" && e.state)
      .sort((a, b) => b.at - a.at)[0];
    if (latest?.state) setLastPresence(accountId, cid, latest.state, latest.at, latest.lastSeen);
  }, [tl.data?.entries, accountId, cid, setLastPresence]);

  useEffect(() => {
    if (!tl.data) return;
    const serverKeys = new Set(
      (tl.data.entries ?? []).map((e) => `${e.kind}:${e.at}:${e.state ?? ""}`)
    );
    pruneWsEntries(accountId, cid, serverKeys);
  }, [tl.data, accountId, cid, pruneWsEntries]);

  useEffect(() => {
    // App.tsx calls addWsEntry globally — no extra listener needed.
  }, [accountId, cid, addWsEntry]);

  const analyticsQ = useQuery({
    queryKey: ["analytics", accountId, cid, range],
    queryFn: () => api.analytics(accountId, cid, range),
    staleTime: 60_000,
  });

  const allEntries = useMemo<TimelineEntry[]>(() => {
    const base = tl.data?.entries ?? [];
    const seen = new Set<string>();
    const merged: TimelineEntry[] = [];
    for (const e of base) {
      const key = `${e.kind}:${e.at}:${e.state ?? ""}`;
      if (!seen.has(key)) { seen.add(key); merged.push(e); }
    }
    for (const e of wsEntries) {
      const key = `${e.kind}:${e.at}:${e.state ?? ""}`;
      if (!seen.has(key)) { seen.add(key); merged.push(e); }
    }
    return merged;
  }, [tl.data?.entries, wsEntries]);

  if (tl.isLoading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
      {t("contactDetail.loading")}
    </div>
  );
  if (tl.error) return (
    <div className="p-4 text-destructive text-sm">{(tl.error as Error).message}</div>
  );
  if (!tl.data) return null;

  const c = contact ?? tl.data.contact;
  const displayName = c.displayName || c.phone;

  const presenceEntries = allEntries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  const lastPresence = presenceEntries[presenceEntries.length - 1];
  const isOnline = lastPresence?.state === "available";

  let sessionStart: number | null = null;
  if (isOnline) {
    for (let i = presenceEntries.length - 1; i >= 0; i--) {
      if (presenceEntries[i].state === "available") {
        sessionStart = presenceEntries[i].at;
      } else {
        break;
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="flex items-start gap-4 flex-wrap">
        <Avatar size="lg" className="shrink-0">
          {c.latestPicturePath && (
            <AvatarImage src={getMediaUrl(c.latestPicturePath)} alt={displayName} />
          )}
          <AvatarFallback className="text-base font-semibold">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold tracking-tight truncate">{displayName}</h2>
          <p className="text-sm text-muted-foreground">{c.phone}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge
              variant={isOnline ? "default" : "secondary"}
              className={cn("gap-1", isOnline && "bg-primary text-primary-foreground")}
            >
              <span className={cn("size-1.5 rounded-full", isOnline ? "bg-primary-foreground" : "bg-muted-foreground")} />
              {isOnline ? t("contactDetail.badgeOnline") : t("contactDetail.badgeOffline")}
            </Badge>
            <Badge variant={c.trackingEnabled ? "default" : "secondary"}>
              {c.trackingEnabled ? t("contactDetail.badgeTracking") : t("contactDetail.badgePaused")}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/accounts/${accountId}/contacts/${cid}/messages`}>
              <MessageSquare className="size-3.5 me-1.5" />
              {t("contactDetail.messages")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={toggleTracking.isPending}
            onClick={() => toggleTracking.mutate(!c.trackingEnabled)}
          >
            {c.trackingEnabled
              ? <><Pause className="size-3.5 me-1.5" />{t("contactDetail.pauseTracking")}</>
              : <><Play className="size-3.5 me-1.5" />{t("contactDetail.resumeTracking")}</>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={deleteContactMutation.isPending}
            onClick={() => {
              if (confirm(t("contactDetail.deleteConfirm", { name: displayName }))) {
                deleteContactMutation.mutate();
              }
            }}
          >
            <Trash2 className="size-3.5 me-1.5" />
            {deleteContactMutation.isPending ? t("contactDetail.deleting") : t("contactDetail.delete")}
          </Button>
        </div>
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="status">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="status">{t("contactDetail.tabStatus")}</TabsTrigger>
          <TabsTrigger value="presence">{t("contactDetail.tabPresence")}</TabsTrigger>
          <TabsTrigger value="stories">{t("contactDetail.tabStories")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("contactDetail.tabAnalytics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4 flex flex-col gap-4">
          <LiveStatusCard
            entries={allEntries}
            isOnline={isOnline}
            sessionStart={sessionStart}
            lastPresence={lastPresence}
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("contactDetail.activityTimeline")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SessionTimeline entries={allEntries} contactName={displayName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presence" className="mt-4 flex flex-col gap-4">
          <StatsStrip accountId={accountId} contactId={cid} />
          <PresencePanel entries={allEntries} contact={c} />
        </TabsContent>

        <TabsContent value="stories" className="mt-4">
          <StoriesPanel accountId={accountId} contactId={cid} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("contactDetail.rangeLabel")}
                </span>
                <div className="flex gap-1">
                  {RANGE_LABELS.map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={range === value ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setRange(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          {analyticsQ.data ? (
            <AnalyticsPanel report={analyticsQ.data} contactName={displayName} />
          ) : analyticsQ.isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t("contactDetail.loadingAnalytics")}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
