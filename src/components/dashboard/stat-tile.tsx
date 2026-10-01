interface Props {
  label: string;
  value: string | number;
  status?: { color: "good" | "warning" | "critical"; label: string };
}

export function StatTile({ label, value, status }: Props) {
  return (
    <div className="rounded-md border border-border border-t-2 border-t-accent bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]">
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
    </div>
  );
}
