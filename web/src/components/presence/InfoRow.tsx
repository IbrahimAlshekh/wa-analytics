export interface InfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

export default function InfoRow({ label, value, mono }: InfoRowProps) {
  return (
    <div className="py-2 border-b border-border flex flex-col gap-0.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-sm break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
