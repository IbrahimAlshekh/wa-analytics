import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, X, Smartphone } from "lucide-react";
import { api } from "../lib/api";
import type { Account } from "@/types/account";
import QRView from "../components/QRView";
import PhoneCodeView from "../components/PhoneCodeView";
import { useStore } from "../lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AccountRow from "@/components/accounts/AccountRow";

export default function Accounts() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const {
    accounts: storeAccounts,
    setAccounts,
    upsertAccount,
    removeAccount,
  } = useStore();
  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: api.listAccounts,
  });
  const [showPair, setShowPair] = useState(false);

  useEffect(() => {
    if (accountsQ.data) setAccounts(accountsQ.data);
  }, [accountsQ.data, setAccounts]);

  const toggle = useMutation({
    mutationFn: ({
      id,
      trackingActive,
    }: {
      id: number;
      trackingActive: boolean;
    }) => api.updateAccount(id, { trackingActive }),
    onSuccess: (updated) => {
      upsertAccount(updated);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAccount(id),
    onSuccess: (_, id) => {
      removeAccount(id);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const list: Account[] =
    storeAccounts.length > 0 ? storeAccounts : (accountsQ.data ?? []);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight">
          {t("accounts.title")}
        </h2>
        <Button
          variant={showPair ? "ghost" : "default"}
          size="sm"
          onClick={() => setShowPair((v) => !v)}
        >
          {showPair ? (
            <>
              <X className="size-3.5 me-1.5" />
              {t("accounts.cancel")}
            </>
          ) : (
            <>
              <Plus className="size-3.5 me-1.5" />
              {t("accounts.addAccount")}
            </>
          )}
        </Button>
      </div>

      {showPair && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("accounts.linkTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="qr">
              <TabsList className="mb-4">
                <TabsTrigger value="qr">{t("accounts.qrTab")}</TabsTrigger>
                <TabsTrigger value="phone">
                  {t("accounts.phoneTab")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="qr">
                <QRView />
              </TabsContent>
              <TabsContent value="phone">
                <PhoneCodeView />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {list.length === 0 && !showPair && (
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
      )}

      {list.length > 0 && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {list.map((acc) => (
              <AccountRow
                key={acc.id}
                account={acc}
                onToggle={(v) =>
                  toggle.mutate({ id: acc.id, trackingActive: v })
                }
                onDelete={() => {
                  if (
                    confirm(
                      t("accounts.removeConfirm", {
                        name: acc.label || acc.jid,
                      }),
                    )
                  )
                    remove.mutate(acc.id);
                }}
              />
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-2 text-center text-[10px] leading-relaxed text-muted-foreground/60 max-w-100 mx-auto mt-8 mb-4">
        <p className="font-semibold uppercase tracking-wider text-[9px]">
          {t("auth.disclaimer.title")}
        </p>
        <p>{t("auth.disclaimer.text")}</p>
      </div>
    </div>
  );
}
