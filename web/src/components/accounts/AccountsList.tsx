import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Account } from "@/types/account";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import AccountRow from "./AccountRow";

export interface AccountsListProps {
  accounts: Account[];
}

export default function AccountsList({ accounts }: AccountsListProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { upsertAccount, removeAccount } = useStore();

  const toggle = useMutation({
    mutationFn: ({ id, trackingActive }: { id: number; trackingActive: boolean }) =>
      api.updateAccount(id, { trackingActive }),
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

  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-border">
        {accounts.map((acc) => (
          <AccountRow
            key={acc.id}
            account={acc}
            onToggle={(v) => toggle.mutate({ id: acc.id, trackingActive: v })}
            onDelete={() => {
              if (confirm(t("accounts.removeConfirm", { name: acc.label || acc.jid })))
                remove.mutate(acc.id);
            }}
          />
        ))}
      </div>
    </Card>
  );
}
