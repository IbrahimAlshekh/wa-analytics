import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { getMediaUrl } from "@/lib/media";
import { useStore } from "@/lib/store";
import { getInitials, formatRelative } from "@/lib/format";
import type { Contact } from "@/types/contact";
import { cn } from "@/lib/utils";

export interface ContactSidebarItemProps {
  accountId: number;
  contact: Contact;
  active: boolean;
}

export default function ContactSidebarItem({
  accountId,
  contact: contactProp,
  active,
}: ContactSidebarItemProps) {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();

  const storeContact = useStore((s) => s.contacts[contactProp.id]);
  const contact = storeContact ?? contactProp;
  const presence = useStore(
    (s) => s.lastPresence[`${accountId}:${contact.id}`],
  );

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
        <Link
          to={`/accounts/${accountId}/contacts/${contact.id}`}
          className="flex items-center gap-2.5"
        >
          <div className="relative shrink-0">
            <Avatar size="sm">
              {contact.latestPicturePath && (
                <AvatarImage
                  src={getMediaUrl(contact.latestPicturePath)}
                  alt={displayName}
                />
              )}
              <AvatarFallback className="text-xs">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-0.5 -inset-e-0.5 size-2.5 rounded-full border-2 border-sidebar",
                online ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate text-foreground">
              {displayName}
            </div>
            {lastSeenText && (
              <div
                className={cn(
                  "text-xs truncate mt-0.5",
                  online ? "text-primary" : "text-muted-foreground",
                )}
              >
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
