import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TokenCount } from "../../lib/types";

interface Props {
  label: string;
  tokens: TokenCount[];
  accent: string;
}

export default function WordList({ label, tokens, accent }: Props) {
  return (
    <div>
      <p className={cn("text-xs font-bold uppercase mb-2", accent)}>{label}</p>
      <div className="flex flex-col divide-y divide-border">
        {tokens.map((tc) => (
          <div key={tc.token} className="flex items-baseline justify-between gap-2 py-1">
            <span className="text-xs">{tc.token}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{formatCount(tc.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
