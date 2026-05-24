import InfoIcon from "./InfoIcon";

export interface PresenceStatCardProps {
  label: string;
  value: string;
  description?: string;
  info?: string;
}

export default function PresenceStatCard({
  label,
  value,
  description,
  info,
}: PresenceStatCardProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-24">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {info && <InfoIcon text={info} />}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground/60">{description}</p>
      )}
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
