"use client";

import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { SubmitButton } from "@/components/submit-button";
import { dangerButton, secondaryButton } from "@/components/styles";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
  hiddenFields = {},
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={dangerButton} onClick={() => setOpen(true)}>
        {confirmLabel}
      </button>
      {open ? (
        <Dialog title={title} onClose={() => setOpen(false)}>
          <p className="text-sm leading-6 text-ink/80">{description}</p>
          <form action={action} className="mt-6 flex flex-wrap justify-end gap-3">
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <SubmitButton label={confirmLabel} pendingLabel={pendingLabel} tone="danger" />
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
