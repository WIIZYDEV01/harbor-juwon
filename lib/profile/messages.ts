export const ERRORS = {
  permission: "You don't have permission to view this profile.",
  save: "Unable to save this profile.",
  upload: "Upload failed.",
  file: "Choose a JPEG, PNG, or WEBP image up to 2 MB.",
  name: "Enter a name up to 80 characters.",
  cleanup:
    "The profile was deleted, but the image could not be removed from storage.",
  delete: "You don't have permission to delete this profile.",
  update: "You don't have permission to update this profile.",
  create: "Unable to create this profile.",
  exists: "You already have a profile.",
  image_delete: "Unable to delete this image.",
  config: "Profile image cleanup is not configured on the server.",
  load: "Unable to load profiles.",
  role: "You don't have permission to change this role.",
  role_self: "You can't change your own role.",
} as const;

export type ErrorCode = keyof typeof ERRORS;

export const NOTICES = {
  created: "Profile created.",
  saved: "Profile updated successfully.",
  deleted: "Profile deleted successfully.",
  image_uploaded: "Image uploaded.",
  image_deleted: "Image deleted.",
  role_changed: "Role updated.",
  confirm: "Check your email to confirm your account, then sign in.",
} as const;

export type NoticeCode = keyof typeof NOTICES;

export function readCodedMessage<T extends Record<string, string>>(
  catalog: T,
  value: string | undefined,
) {
  if (!value || !(value in catalog)) return null;
  return catalog[value as keyof T];
}
