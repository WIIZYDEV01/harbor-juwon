"use client";

import { secondaryButton } from "@/components/styles";

export default function ProtectedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="border border-clay bg-paper px-4 py-4">
      <p className="text-sm text-clay">Unable to load profiles.</p>
      <button type="button" className={`${secondaryButton} mt-4`} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
