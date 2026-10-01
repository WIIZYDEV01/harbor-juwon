"use client";

import { useActionState } from "react";
import { StateMessage } from "@/components/state-message";
import { SubmitButton } from "@/components/submit-button";
import { textInput } from "@/components/styles";
import { changeRole, type ActionState } from "@/lib/profile/actions";
import { ERRORS, type ErrorCode } from "@/lib/profile/messages";
import { ROLES, roleLabel, type UserRole } from "@/lib/profile/types";

export function RoleForm({ profileId, currentRole }: { profileId: string; currentRole: UserRole }) {
  const [state, formAction] = useActionState(changeRole, null as ActionState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="profileId" value={profileId} />
      <div>
        <label htmlFor="role" className="mb-1.5 block text-sm font-medium text-ink">
          Role
        </label>
        <select id="role" name="role" defaultValue={currentRole} className={textInput}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-ink/70">
          The database checks that you are a super admin. You cannot change your own role here.
        </p>
      </div>
      {state?.error ? (
        <StateMessage tone="error">{ERRORS[state.error as ErrorCode] ?? ERRORS.role}</StateMessage>
      ) : null}
      <SubmitButton label="Change role" pendingLabel="Changing role..." tone="secondary" />
    </form>
  );
}
