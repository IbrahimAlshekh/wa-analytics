import { Outlet, useMatch, useParams } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./layout/AppSidebar";
import MobileTrigger from "./layout/MobileTrigger";

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
