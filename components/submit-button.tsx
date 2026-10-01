"use client";

import { useFormStatus } from "react-dom";
import { dangerButton, primaryButton, secondaryButton } from "@/components/styles";

export function SubmitButton({
  label,
  pendingLabel,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  tone?: "primary" | "danger" | "secondary";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const className =
    tone === "danger" ? dangerButton : tone === "secondary" ? secondaryButton : primaryButton;
  const blocked = pending || disabled;

  return (
    <button type="submit" className={className} disabled={blocked} aria-disabled={blocked}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
