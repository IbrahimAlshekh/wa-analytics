import { Badge } from "@/components/ui/badge";
import { formatCount } from "@/lib/format";
import type { TokenCount } from "@/types/analytics";

export default function TokenPill({ token, count }: TokenCount) {
  return (
    <Badge variant="outline" className="gap-1 text-xs font-normal">
      <span>{token}</span>
      <span className="text-muted-foreground font-semibold">
        {formatCount(count)}
      </span>
    </Badge>
  );
}
