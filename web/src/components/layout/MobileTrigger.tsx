import { useTranslation } from "react-i18next";
import { PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

export default function MobileTrigger() {
  const { t, i18n } = useTranslation();
  const { toggleSidebar } = useSidebar();
  const isRTL = i18n.dir() === "rtl";
  const Icon = isRTL ? PanelRight : PanelLeft;
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border md:hidden shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={t("sidebar.openContacts")}
        onClick={toggleSidebar}
      >
        <Icon className="size-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        {t("sidebar.mobileLabel")}
      </span>
    </div>
  );
}
