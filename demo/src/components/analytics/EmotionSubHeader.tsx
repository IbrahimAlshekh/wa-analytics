interface Props {
  title: string;
}

export default function EmotionSubHeader({ title }: Props) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="w-5 shrink-0" />
      <span className="flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      <span className="w-8 shrink-0 flex justify-end">
        <span className="size-2 rounded-full bg-primary" />
      </span>
      <span className="text-xs text-muted-foreground/40">|</span>
      <span className="w-8 shrink-0 flex">
        <span className="size-2 rounded-full bg-contact" />
      </span>
    </div>
  );
}
