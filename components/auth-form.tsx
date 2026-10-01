"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { StateMessage } from "@/components/state-message";
import { textInput } from "@/components/styles";
import { signIn, signUp, type AuthState } from "@/lib/auth/actions";

export function AuthForm({
  mode,
  nextPath = "/dashboard",
}: {
  mode: "signin" | "signup";
  nextPath?: string;
}) {
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction] = useActionState(action, null as AuthState);

  return (
    <form action={formAction} className="space-y-4">
      {mode === "signin" ? <input type="hidden" name="next" value={nextPath} /> : null}
      {mode === "signup" ? (
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
            autoComplete="name"
            className={textInput}
          />
        </div>
      ) : null}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={textInput}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={textInput}
          aria-describedby={state?.error ? "auth-error" : undefined}
        />
      </div>
      {state?.error ? (
        <div id="auth-error">
          <StateMessage tone="error">{state.error}</StateMessage>
        </div>
      ) : null}
      <SubmitButton
        label={mode === "signup" ? "Create account" : "Sign in"}
        pendingLabel={mode === "signup" ? "Creating account..." : "Signing in..."}
      />
    </form>
  );
}
