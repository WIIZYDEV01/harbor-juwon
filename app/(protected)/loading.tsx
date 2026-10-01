function Block({ className }: { className: string }) {
  return <div className={`animate-pulse bg-ink/10 ${className}`} />;
}

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <span className="sr-only">Loading profiles...</span>
      <div className="space-y-3 border-b border-ink/15 pb-6">
        <Block className="h-3 w-24" />
        <Block className="h-8 w-72 max-w-full" />
        <Block className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Block key={index} className="h-24" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Block key={index} className="h-14" />
        ))}
      </div>
    </div>
  );
}
