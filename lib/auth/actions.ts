"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/paths";
import { parseFullName } from "@/lib/profile/validate";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string } | null;

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Sign in failed. Check your email and password." };
  }

  redirect(next);
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const fullName = parseFullName(formData.get("fullName"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "Enter a name up to 80 characters." };
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already")) {
      const signedIn = await supabase.auth.signInWithPassword({ email, password });
      if (!signedIn.error && signedIn.data.session) redirect("/dashboard");
      return { error: "An account with that email already exists. Sign in instead." };
    }
    return { error: "Sign up failed. Check the details and try again." };
  }

  if (!data.session) {
    const signedIn = await supabase.auth.signInWithPassword({ email, password });
    if (!signedIn.error && signedIn.data.session) redirect("/dashboard");
    return {
      error:
        "The account was created, but Supabase will not sign it in until email confirmation is off. In Supabase open Authentication, then Email, and turn Confirm email off. Then open Users, confirm or delete this account, and submit again.",
    };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
