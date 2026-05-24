import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function EmptyAccounts() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Smartphone className="size-10 text-muted-foreground/50" />
        <div>
          <p className="font-medium text-sm">{t("accounts.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("accounts.emptyDesc")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
