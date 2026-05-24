import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw, Plus, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import ContactSidebarItem from "./ContactSidebarItem";
import { useDebounce } from "@/hooks/useDebounce";

const PAGE_SIZE = 50;

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
      const loaded = allPages.reduce(
        (n, p) => n + (p.contacts?.length ?? 0),
        0,
      );
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
      setSyncMsg(
        t("sidebar.syncFailed", {
          error: e instanceof Error ? e.message : String(e),
        }),
      ),
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
    <Sidebar
      side={isRTL ? "right" : "left"}
      collapsible="offcanvas"
      className="border-e border-border"
    >
      {/* Header */}
      <SidebarHeader className="border-b border-border px-3 py-2.5 gap-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-semibold text-foreground">
            {t("sidebar.title")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title={t("sidebar.syncTitle")}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  syncMutation.isPending && "animate-spin",
                )}
              />
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
              {showAdd ? (
                <X className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
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
              {addMutation.isPending
                ? t("sidebar.adding")
                : t("sidebar.addContact")}
            </Button>
            {addError && <p className="text-xs text-destructive">{addError}</p>}
          </form>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute inset-s-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("sidebar.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="ps-8 h-7 text-xs"
          />
          {searchInput && (
            <button
              className="absolute inset-e-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              : t("sidebar.moreContacts", {
                  count: total - allContacts.length,
                })}
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
