import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const PROFILE_BUCKET = "profile-images";

const AVATAR_FILES = ["avatar.jpg", "avatar.jpeg", "avatar.png", "avatar.webp"];

function isMissingObject(message: string | undefined) {
  const text = message?.toLowerCase() ?? "";
  return text.includes("not found") || text.includes("does not exist");
}

async function collectPaths(
  client: SupabaseClient,
  ownerId: string,
  avatarUrl: string | null,
) {
  const paths = new Set<string>();
  if (avatarUrl?.startsWith(`${ownerId}/`)) {
    paths.add(avatarUrl);
  }
  for (const name of AVATAR_FILES) {
    paths.add(`${ownerId}/${name}`);
  }

  const { data, error } = await client.storage.from(PROFILE_BUCKET).list(ownerId);
  if (error && !isMissingObject(error.message)) {
    console.error("[storage.list]", error.message);
  }
  for (const file of data ?? []) {
    if (file.name) paths.add(`${ownerId}/${file.name}`);
  }

  return [...paths];
}

async function removePaths(client: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return null;
  const { error } = await client.storage.from(PROFILE_BUCKET).remove(paths);
  if (error && !isMissingObject(error.message)) {
    console.error("[storage.remove]", error.message);
    return error.message;
  }
  return null;
}

export async function removeProfileImages(options: {
  ownerId: string;
  callerId: string;
  avatarUrl: string | null;
}) {
  const run = async () => {
    if (options.callerId === options.ownerId) {
      const supabase = await createClient();
      const paths = await collectPaths(
        supabase,
        options.ownerId,
        options.avatarUrl,
      );
      return removePaths(supabase, paths);
    }

    const admin = createAdminClient();
    if (!admin) return "missing_service_role";
    const paths = await collectPaths(admin, options.ownerId, options.avatarUrl);
    return removePaths(admin, paths);
  };

  const first = await run();
  if (!first) return null;
  return run();
}

export async function folderHasFiles(ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(PROFILE_BUCKET).list(ownerId);
  if (error) {
    console.error("[storage.list]", error.message);
    return false;
  }
  return (data ?? []).some((file) => file.name && file.name !== ".emptyFolderPlaceholder");
}
