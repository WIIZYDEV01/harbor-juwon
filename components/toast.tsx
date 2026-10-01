"use client";

import { useEffect, useState } from "react";

export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 flex max-w-sm items-center gap-4 bg-ink px-4 py-3 text-sm text-paper shadow-lg"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="rounded-sm px-1 font-semibold text-paper/80 hover:text-paper"
      >
        Dismiss
      </button>
    </div>
  );
}
