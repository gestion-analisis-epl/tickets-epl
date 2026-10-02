interface Props {
  label: string;
  value: string | number;
  status?: { color: "good" | "warning" | "critical"; label: string };
  onClick?: () => void;
  active?: boolean;
}

export function StatTile({ label, value, status, onClick, active }: Props) {
  const className = `rounded-md border border-border border-t-2 border-t-accent bg-card p-5 shadow-[0_1px_0_hsl(var(--border))] ${
    onClick
      ? "w-full text-left cursor-pointer transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      : ""
  } ${active ? "border-primary" : ""}`;

  const content = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="font-display text-4xl font-semibold mt-2 tabular-nums">{value}</p>
      {status && (
        <div className="flex items-center gap-1.5 mt-2.5">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: `var(--status-${status.color})` }}
          />
          <span className="text-xs font-medium text-muted">{status.label}</span>
        </div>
      )}
    </>
  );

  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button type="button" onClick={onClick} aria-haspopup="dialog" className={className}>
      {content}
    </button>
  );
}
