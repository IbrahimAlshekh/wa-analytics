import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw, Plus, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { getMediaUrl } from "@/lib/media";
import { useStore } from "@/lib/store";
import type { Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

function useDebounce(value: string, delay: number): string {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function getInitials(name: string): string {
  if (name.startsWith("+")) return name.slice(1, 3);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatRelative(unix: number): string {
  const diff = Math.max(0, Date.now() / 1000 - unix);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const PAGE_SIZE = 50;

interface ContactItemProps {
  accountId: number;
  contact: Contact;
  active: boolean;
}

function ContactSidebarItem({ accountId, contact: contactProp, active }: ContactItemProps) {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();

  const storeContact = useStore((s) => s.contacts[contactProp.id]);
  const contact = storeContact ?? contactProp;
  const presence = useStore((s) => s.lastPresence[`${accountId}:${contact.id}`]);

  const displayName = contact.displayName || contact.phone;
  const online = presence?.state === "available";

  const lastSeenText = online
    ? t("sidebar.online")
    : presence
    ? presence.lastSeen
      ? t("sidebar.lastSeen", { time: formatRelative(presence.lastSeen) })
      : t("sidebar.offlineSince", { time: formatRelative(presence.at) })
    : contact.trackingEnabled
    ? t("sidebar.noActivity")
    : null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        className="h-auto py-2 px-3"
        onClick={() => setOpenMobile(false)}
      >
        <Link to={`/accounts/${accountId}/contacts/${contact.id}`} className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <Avatar size="sm">
              {contact.latestPicturePath && (
                <AvatarImage src={getMediaUrl(contact.latestPicturePath)} alt={displayName} />
              )}
              <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-sidebar",
                online ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate text-foreground">{displayName}</div>
            {lastSeenText && (
              <div className={cn("text-xs truncate mt-0.5", online ? "text-primary" : "text-muted-foreground")}>
                {lastSeenText}
              </div>
            )}
          </div>
          {!contact.trackingEnabled && (
            <Badge variant="secondary" className="shrink-0 text-xs h-5 px-1.5">
              {t("sidebar.paused")}
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface AppSidebarProps {
  accountId: number;
  activeCid: number | null;
}

export default function AppSidebar({ accountId, activeCid }: AppSidebarProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const qc = useQueryClient();

  const upsertContacts = useStore((s) => s.upsertContacts);
  const upsertContact = useStore((s) => s.upsertContact);

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 300);
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const contactsQ = useInfiniteQuery({
    queryKey: ["contacts-sidebar", accountId, search],
    queryFn: ({ pageParam }) =>
      api.listContacts(accountId, pageParam as number, PAGE_SIZE, search),
    initialPageParam: 1,
    getNextPageParam: (_lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + (p.contacts?.length ?? 0), 0);
      const total = allPages[0]?.total ?? 0;
      return loaded < total ? allPages.length + 1 : undefined;
    },
    refetchInterval: 30_000,
  });

  const allContacts = useMemo(
    () => contactsQ.data?.pages.flatMap((p) => p.contacts ?? []) ?? [],
    [contactsQ.data],
  );
  const total = contactsQ.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    if (allContacts.length > 0) upsertContacts(allContacts);
  }, [allContacts, upsertContacts]);

  const syncMutation = useMutation({
    mutationFn: () => api.syncContacts(accountId),
    onSuccess: (data) => {
      setSyncMsg(t("sidebar.syncSuccess", { count: data.synced }));
      setTimeout(() => setSyncMsg(null), 3000);
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
    onError: (e) =>
      setSyncMsg(t("sidebar.syncFailed", { error: e instanceof Error ? e.message : String(e) })),
  });

  const addMutation = useMutation({
    mutationFn: () => api.createContact(accountId, phone, addName),
    onSuccess: (created) => {
      upsertContact(created);
      setPhone("");
      setAddName("");
      setAddError(null);
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
    onError: (e) => setAddError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Sidebar side={isRTL ? "right" : "left"} collapsible="offcanvas" className="border-e border-border">
      {/* Header */}
      <SidebarHeader className="border-b border-border px-3 py-2.5 gap-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-semibold text-foreground">{t("sidebar.title")}</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title={t("sidebar.syncTitle")}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={cn("size-3.5", syncMutation.isPending && "animate-spin")} />
            </Button>
            <Button
              variant={showAdd ? "secondary" : "ghost"}
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setShowAdd((v) => !v);
                setAddError(null);
              }}
            >
              {showAdd ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            </Button>
          </div>
        </div>

        {syncMsg && (
          <p className="text-xs text-muted-foreground px-1">{syncMsg}</p>
        )}

        {/* Add contact form */}
        {showAdd && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
            className="flex flex-col gap-1.5"
          >
            <Input
              placeholder={t("sidebar.phonePlaceholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder={t("sidebar.namePlaceholder")}
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="h-7 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              className="h-7 text-xs w-full"
              disabled={!phone || addMutation.isPending}
            >
              {addMutation.isPending ? t("sidebar.adding") : t("sidebar.addContact")}
            </Button>
            {addError && (
              <p className="text-xs text-destructive">{addError}</p>
            )}
          </form>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("sidebar.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="ps-8 h-7 text-xs"
          />
          {searchInput && (
            <button
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchInput("")}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </SidebarHeader>

      {/* Contact list */}
      <SidebarContent className="overflow-y-auto">
        <SidebarMenu className="gap-0 p-1">
          {contactsQ.isLoading && (
            <li className="px-3 py-4 text-xs text-muted-foreground text-center">
              {t("sidebar.loadingMore")}
            </li>
          )}
          {!contactsQ.isLoading && allContacts.length === 0 && (
            <li className="px-3 py-4 text-xs text-muted-foreground text-center">
              {search ? t("sidebar.noResults") : t("sidebar.noContacts")}
            </li>
          )}
          {allContacts.map((c) => (
            <ContactSidebarItem
              key={c.id}
              accountId={accountId}
              contact={c}
              active={c.id === activeCid}
            />
          ))}
        </SidebarMenu>
      </SidebarContent>

      {/* Load more footer */}
      {allContacts.length < total && (
        <SidebarFooter className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground"
            onClick={() => contactsQ.fetchNextPage()}
            disabled={contactsQ.isFetchingNextPage}
          >
            {contactsQ.isFetchingNextPage
              ? t("sidebar.loadingMore")
              : t("sidebar.moreContacts", { count: total - allContacts.length })}
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
