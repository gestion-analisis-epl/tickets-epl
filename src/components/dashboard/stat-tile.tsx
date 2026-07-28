interface Props {
  label: string;
  value: string | number;
  status?: { color: "good" | "warning" | "critical"; label: string };
}

export function StatTile({ label, value, status }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</p>
      <p className="text-3xl font-semibold mt-1.5">{value}</p>
      {status && (
        <div className="flex items-center gap-1.5 mt-2.5">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: `var(--status-${status.color})` }}
          />
          <span className="text-xs font-medium opacity-70">{status.label}</span>
        </div>
      )}
    </div>
  );
}
