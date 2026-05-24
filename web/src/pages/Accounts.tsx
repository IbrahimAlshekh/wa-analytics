import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import { Button } from "@/components/ui/button";
import PairAccountCard from "@/components/accounts/PairAccountCard";
import EmptyAccounts from "@/components/accounts/EmptyAccounts";
import AccountsList from "@/components/accounts/AccountsList";

export default function Accounts() {
  const { t } = useTranslation();
  const { accounts: storeAccounts, setAccounts } = useStore();
  const [showPair, setShowPair] = useState(false);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: api.listAccounts,
  });

  useEffect(() => {
    if (accountsQ.data) setAccounts(accountsQ.data);
  }, [accountsQ.data, setAccounts]);

  const list = storeAccounts.length > 0 ? storeAccounts : (accountsQ.data ?? []);

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

      {showPair && <PairAccountCard />}

      {list.length === 0 && !showPair && <EmptyAccounts />}

      {list.length > 0 && <AccountsList accounts={list} />}

      <div className="flex flex-col gap-2 text-center text-[10px] leading-relaxed text-muted-foreground/60 max-w-100 mx-auto mt-8 mb-4">
        <p className="font-semibold uppercase tracking-wider text-[9px]">
          {t("auth.disclaimer.title")}
        </p>
        <p>{t("auth.disclaimer.text")}</p>
      </div>
    </div>
  );
}
