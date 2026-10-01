"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { textInput } from "@/components/styles";
import { StateMessage } from "@/components/state-message";
import { ERRORS, type ErrorCode } from "@/lib/profile/messages";
import { createProfile, updateProfile, adminUpdateProfile, type ActionState } from "@/lib/profile/actions";

export function ProfileForm({
  mode,
  defaultName,
  profileId,
}: {
  mode: "create" | "update" | "admin";
  defaultName: string;
  profileId?: string;
}) {
  const action =
    mode === "create" ? createProfile : mode === "admin" ? adminUpdateProfile : updateProfile;
  const [state, formAction] = useActionState(action, null as ActionState);

  return (
    <form action={formAction} className="space-y-4">
      {mode === "admin" && profileId ? (
        <input type="hidden" name="profileId" value={profileId} />
      ) : null}
      <div>
        <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-ink">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          maxLength={80}
          defaultValue={defaultName}
          autoComplete="name"
          className={textInput}
          aria-describedby={state?.error ? "fullName-error" : undefined}
        />
      </div>
      {state?.error ? (
        <div id="fullName-error">
          <StateMessage tone="error">
            {ERRORS[state.error as ErrorCode] ?? ERRORS.save}
          </StateMessage>
        </div>
      ) : null}
      <SubmitButton
        label={mode === "create" ? "Create profile" : "Save profile"}
        pendingLabel="Saving profile..."
      />
    </form>
  );
}
