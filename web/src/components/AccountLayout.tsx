import { Outlet, useMatch, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import AppSidebar from "./layout/AppSidebar";

function MobileTrigger() {
  const { t } = useTranslation();
  const { toggleSidebar } = useSidebar();
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border md:hidden shrink-0">
      <Button variant="ghost" size="icon" className="size-7" aria-label={t("sidebar.openContacts")} onClick={toggleSidebar}>
        <PanelLeft className="size-4" />
      </Button>
      <span className="text-sm text-muted-foreground">{t("sidebar.mobileLabel")}</span>
    </div>
  );
}

export default function AccountLayout() {
  const { id: accountIdStr } = useParams<{ id: string }>();
  const accountId = Number(accountIdStr);

  const contactMatch = useMatch("/accounts/:id/contacts/:cid");
  const messagesMatch = useMatch("/accounts/:id/contacts/:cid/messages");
  const activeCidStr = contactMatch?.params.cid ?? messagesMatch?.params.cid;
  const activeCid = activeCidStr ? Number(activeCidStr) : null;
  const isMessages = Boolean(messagesMatch);

  return (
    <SidebarProvider className="flex-1 overflow-hidden min-h-0">
      <AppSidebar accountId={accountId} activeCid={activeCid} />
      <SidebarInset className="flex flex-col overflow-hidden">
        <MobileTrigger />
        <div className={`flex-1 overflow-auto${isMessages ? "" : " p-0"}`}>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
