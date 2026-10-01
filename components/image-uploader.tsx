"use client";

import { useActionState, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StateMessage } from "@/components/state-message";
import { SubmitButton } from "@/components/submit-button";
import { deleteProfileImage, uploadProfileImage, type ActionState } from "@/lib/profile/actions";
import { ERRORS, type ErrorCode } from "@/lib/profile/messages";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageUploader({ hasImage }: { hasImage: boolean }) {
  const [state, formAction] = useActionState(uploadProfileImage, null as ActionState);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="image" className="mb-1.5 block text-sm font-medium text-ink">
            {hasImage ? "New photo" : "Photo"}
          </label>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            aria-describedby="image-help"
            className="block w-full text-sm text-ink/80 file:mr-4 file:min-h-10 file:rounded-md file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-paper hover:file:bg-ink/90"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setClientError(null);
              setPreview((current) => {
                if (current) URL.revokeObjectURL(current);
                return file ? URL.createObjectURL(file) : null;
              });
              setFileInfo(file ? `${file.name} · ${formatSize(file.size)}` : null);
              if (!file) return;
              if (!ALLOWED.includes(file.type) || file.size > MAX_BYTES) {
                setClientError(ERRORS.file);
              }
            }}
          />
          <p id="image-help" className="mt-2 text-sm text-ink/70">
            JPEG, PNG, or WEBP. Maximum size 2 MB.
          </p>
        </div>
        {preview ? (
          <div className="flex items-center gap-4 border border-ink/15 p-3">
            {/* Local preview only. It is not the stored image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview of the selected photo"
              className="h-20 w-20 rounded-full object-cover"
            />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-ink">Preview</p>
              {fileInfo ? <p className="truncate text-ink/70">{fileInfo}</p> : null}
            </div>
          </div>
        ) : null}
        {clientError ? <StateMessage tone="error">{clientError}</StateMessage> : null}
        {state?.error ? (
          <StateMessage tone="error">
            {ERRORS[state.error as ErrorCode] ?? ERRORS.upload}
          </StateMessage>
        ) : null}
        <SubmitButton
          label={hasImage ? "Replace photo" : "Upload photo"}
          pendingLabel="Uploading..."
          disabled={Boolean(clientError)}
        />
      </form>
      {hasImage ? (
        <div className="border-t border-ink/10 pt-5">
          <ConfirmDialog
            title="Remove your photo?"
            description="Your photo will be deleted from storage. You can upload a new one later."
            confirmLabel="Remove photo"
            pendingLabel="Removing photo..."
            action={deleteProfileImage}
          />
        </div>
      ) : null}
    </div>
  );
}
