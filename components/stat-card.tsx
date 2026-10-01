export function StatCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string | number;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`border px-5 py-4 ${
        accent ? "border-clay bg-clay text-paper" : "border-ink/15 bg-paper text-ink"
      }`}
    >
      <dt className={`text-xs font-semibold uppercase tracking-[0.14em] ${accent ? "text-paper/80" : "text-ink/60"}`}>
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-semibold tabular-nums">{value}</dd>
      {note ? (
        <dd className={`mt-1 text-xs ${accent ? "text-paper/80" : "text-ink/60"}`}>{note}</dd>
      ) : null}
    </div>
  );
}
