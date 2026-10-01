import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  isActivityAction,
  isUserRole,
  type ActivityItem,
  type ProfileRow,
  type UserRole,
} from "@/lib/profile/types";

const profileColumns =
  "id, user_id, full_name, role, avatar_url, created_at, updated_at";

export const DIRECTORY_PAGE_SIZE = 20;

type SupabaseError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function logError(scope: string, error: SupabaseError) {
  console.error("Failed to load profiles", {
    scope,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function asProfile(row: {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}): ProfileRow | null {
  if (!isUserRole(row.role)) return null;
  return { ...row, role: row.role };
}

function asProfiles(rows: Parameters<typeof asProfile>[0][] | null) {
  return (rows ?? [])
    .map((row) => asProfile(row))
    .filter((row): row is ProfileRow => row !== null);
}

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

export type SessionUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
};

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  // Verified locally against the project's asymmetric signing key; no Auth round trip.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const user: SessionUser | null = claims?.sub
    ? { id: claims.sub, email: claims.email ?? null, user_metadata: claims.user_metadata ?? {} }
    : null;
  return { supabase, user };
});

export const getOwnProfile = cache(async () => {
  const { supabase, user } = await getSessionUser();
  if (!user) return { user: null, profile: null, error: false };

  const { data, error } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logError("own", error);
    return { user, profile: null, error: true };
  }

  return {
    user,
    profile: data ? asProfile(data) : null,
    error: false,
  };
});

export async function listDirectory(options: {
  query?: string;
  role?: UserRole | null;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const pageSize = options.pageSize ?? DIRECTORY_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * pageSize;

  let request = supabase.from("profiles").select(profileColumns, { count: "exact" });
  const search = options.query?.trim().slice(0, 80);
  if (search) request = request.ilike("full_name", likePattern(search));
  if (options.role) request = request.eq("role", options.role);

  const { data, error, count } = await request
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) {
    if (error.code === "PGRST103") {
      return { rows: [] as ProfileRow[], total: count ?? 0, page, pageSize, error: false };
    }
    logError("directory", error);
    return { rows: [] as ProfileRow[], total: 0, page, pageSize, error: true };
  }

  return { rows: asProfiles(data), total: count ?? 0, page, pageSize, error: false };
}

export async function getProfileStats() {
  const supabase = await createClient();
  const head = () =>
    supabase.from("profiles").select("id", { count: "exact", head: true });

  const results = await Promise.all([
    head(),
    head().eq("role", "member"),
    head().eq("role", "admin"),
    head().eq("role", "super_admin"),
    head().not("avatar_url", "is", null),
  ]);

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    logError("stats", failed.error);
    return { stats: null, error: true };
  }

  const [total, members, admins, superAdmins, withImages] = results.map(
    (result) => result.count ?? 0,
  );
  return {
    stats: { total, members, admins, superAdmins, withImages },
    error: false,
  };
}

export async function listActivity(viewerId: string, limit = 12) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_activity")
    .select("id, actor_user_id, action, target_user_id, target_role, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logError("activity", error);
    return { items: [] as ActivityItem[], error: true };
  }

  const events = (data ?? []).filter(
    (row) => isActivityAction(row.action) && isUserRole(row.target_role),
  );
  const ids = [
    ...new Set(events.flatMap((row) => [row.actor_user_id, row.target_user_id])),
  ];

  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people, error: peopleError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    if (peopleError) {
      logError("activity-names", peopleError);
      return { items: [] as ActivityItem[], error: true };
    }
    for (const person of people ?? []) {
      names.set(person.user_id, person.full_name || "Unnamed profile");
    }
  }

  const items: ActivityItem[] = events.map((row) => ({
    id: row.id,
    action: row.action as ActivityItem["action"],
    actorName:
      row.actor_user_id === viewerId ? "You" : names.get(row.actor_user_id) ?? "Another user",
    targetName: names.get(row.target_user_id) ?? "a removed profile",
    targetRole: row.target_role as UserRole,
    createdAt: row.created_at,
    selfAction: row.actor_user_id === row.target_user_id,
  }));

  return { items, error: false };
}

export async function getVisibleProfile(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logError("one", error);
    return { profile: null, error: true };
  }

  return { profile: data ? asProfile(data) : null, error: false };
}
