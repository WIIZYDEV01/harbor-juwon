"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  folderHasFiles,
  PROFILE_BUCKET,
  removeProfileImages,
} from "@/lib/profile/images";
import { type ErrorCode, type NoticeCode } from "@/lib/profile/messages";
import { getSessionUser } from "@/lib/profile/queries";
import { isUserRole } from "@/lib/profile/types";
import {
  imageContentType,
  MAX_IMAGE_BYTES,
  parseFullName,
  sniffImage,
} from "@/lib/profile/validate";

export type ActionState = { error: string } | null;

function fail(error: ErrorCode): ActionState {
  return { error };
}

function refreshProfiles() {
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/profiles");
}

async function finish(
  path: string,
  code: NoticeCode | ErrorCode,
  kind: "notice" | "error",
): Promise<never> {
  refreshProfiles();
  redirect(`${path}?${kind}=${code}`);
}

export async function createProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = parseFullName(formData.get("fullName"));
  if (!name) return fail("name");

  const { supabase, user } = await getSessionUser();
  if (!user) return fail("permission");

  const { error } = await supabase.from("profiles").insert({
    user_id: user.id,
    full_name: name,
  });

  if (error) {
    console.error("[profiles.create]", error.code ?? "", error.message);
    if (error.code === "23505") return fail("exists");
    return fail("create");
  }

  await finish("/profile", "created", "notice");
  return null;
}

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = parseFullName(formData.get("fullName"));
  if (!name) return fail("name");

  const { supabase, user } = await getSessionUser();
  if (!user) return fail("permission");

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    if (error) console.error("[profiles.update]", error.code ?? "", error.message);
    return fail("update");
  }

  await finish("/profile", "saved", "notice");
  return null;
}

export async function adminUpdateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = parseFullName(formData.get("fullName"));
  const profileId = String(formData.get("profileId") ?? "");
  if (!name) return fail("name");

  const { supabase, user } = await getSessionUser();
  if (!user) return fail("permission");

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", profileId)
    .select("id");

  if (error || !data?.length) {
    if (error) console.error("[profiles.adminUpdate]", error.code ?? "", error.message);
    return fail("update");
  }

  await finish(`/profiles/${profileId}`, "saved", "notice");
  return null;
}

export async function changeRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profileId = String(formData.get("profileId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!isUserRole(role)) return fail("role");

  const { supabase, user } = await getSessionUser();
  if (!user) return fail("permission");

  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (readError || !target) {
    if (readError) console.error("[profiles.read]", readError.code ?? "", readError.message);
    return fail("permission");
  }

  if (target.user_id === user.id) return fail("role_self");

  const { error } = await supabase.rpc("set_profile_role", {
    target_user_id: target.user_id,
    new_role: role,
  });

  if (error) {
    console.error("[profiles.role]", error.code ?? "", error.message);
    return fail(error.message.includes("cannot_change_own_role") ? "role_self" : "role");
  }

  await finish(`/profiles/${profileId}`, "role_changed", "notice");
  return null;
}

export async function deleteProfile(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const returnPath = String(formData.get("returnPath") ?? "/profile");
  const destination = returnPath.startsWith("/") && !returnPath.startsWith("//")
    ? returnPath
    : "/profile";

  const { supabase, user } = await getSessionUser();
  if (!user) {
    return finish(destination, "permission", "error");
  }

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("id, user_id, avatar_url")
    .eq("id", profileId)
    .maybeSingle();

  if (readError || !profile) {
    if (readError) console.error("[profiles.read]", readError.code ?? "", readError.message);
    return finish(destination, "permission", "error");
  }

  const ownsRow = profile.user_id === user.id;
  if (!ownsRow) {
    const hasImage = Boolean(profile.avatar_url) || (await folderHasFiles(profile.user_id));
    if (hasImage && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return finish(destination, "config", "error");
    }
  }

  const { data: deleted, error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profile.id)
    .select("user_id, avatar_url");

  if (error || !deleted?.length) {
    if (error) console.error("[profiles.delete]", error.code ?? "", error.message);
    return finish(destination, "delete", "error");
  }

  const removed = deleted[0];
  const cleanup = await removeProfileImages({
    ownerId: removed.user_id,
    callerId: user.id,
    avatarUrl: removed.avatar_url,
  });

  if (cleanup) {
    return finish(ownsRow ? "/profile" : "/profiles", "cleanup", "error");
  }

  return finish(ownsRow ? "/profile" : "/profiles", "deleted", "notice");
}

export async function uploadProfileImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getSessionUser();
  if (!user) return fail("permission");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return fail("file");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return fail("file");

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError || !profile) {
    if (readError) console.error("[profiles.read]", readError.code ?? "", readError.message);
    return fail("upload");
  }

  const path = `${user.id}/avatar.${kind}`;
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(path, bytes, {
      contentType: imageContentType(kind),
      upsert: true,
    });

  if (uploadError) {
    console.error("[storage.upload]", uploadError.message);
    return fail("upload");
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("user_id", user.id)
    .select("id");

  if (updateError || !updated?.length) {
    if (updateError) {
      console.error("[profiles.avatar]", updateError.code ?? "", updateError.message);
    }
    if (profile.avatar_url !== path) {
      await supabase.storage.from(PROFILE_BUCKET).remove([path]);
    }
    return fail("upload");
  }

  if (profile.avatar_url && profile.avatar_url !== path) {
    const { error: removeError } = await supabase.storage
      .from(PROFILE_BUCKET)
      .remove([profile.avatar_url]);
    if (removeError) console.error("[storage.remove-old]", removeError.message);
  }

  await finish("/profile", "image_uploaded", "notice");
  return null;
}

export async function deleteProfileImage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return finish("/profile", "permission", "error");

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError || !profile?.avatar_url) {
    if (readError) console.error("[profiles.read]", readError.code ?? "", readError.message);
    return finish("/profile", "image_delete", "error");
  }

  const avatarUrl = profile.avatar_url;
  const { error: removeError } = await supabase.storage
    .from(PROFILE_BUCKET)
    .remove([avatarUrl]);

  if (removeError) {
    console.error("[storage.remove]", removeError.message);
    return finish("/profile", "image_delete", "error");
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", user.id)
    .select("id");

  if (updateError || !updated?.length) {
    if (updateError) {
      console.error("[profiles.avatar]", updateError.code ?? "", updateError.message);
    }
    return finish("/profile", "image_delete", "error");
  }

  return finish("/profile", "image_deleted", "notice");
}
