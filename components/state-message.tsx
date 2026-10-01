type Tone = "info" | "error" | "success" | "empty";

const tones: Record<Tone, string> = {
  info: "border-ink/15 bg-paper text-ink",
  error: "border-clay bg-paper text-clay",
  success: "border-ink bg-paper text-ink",
  empty: "border-dashed border-ink/25 bg-paper text-ink/70",
};

export function StateMessage({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: string;
}) {
  const live = tone === "error" ? "assertive" : "polite";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live={live}
      className={`rounded-md border px-4 py-3 text-sm ${tones[tone]}`}
    >
      {children}
    </p>
  );
}
