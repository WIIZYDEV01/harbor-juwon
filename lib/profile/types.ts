export const ROLES = ["member", "admin", "super_admin"] as const;

export type UserRole = (typeof ROLES)[number];

export type ProfileRow = {
  id: string;
  user_id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileCardData = {
  id: string;
  fullName: string;
  role: UserRole;
  hasImage: boolean;
  createdAt: string;
  version: string;
};

export const ACTIVITY_ACTIONS = [
  "profile_created",
  "profile_updated",
  "profile_deleted",
  "image_uploaded",
  "image_replaced",
  "image_deleted",
  "role_changed",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityItem = {
  id: string;
  action: ActivityAction;
  actorName: string;
  targetName: string;
  targetRole: UserRole;
  createdAt: string;
  selfAction: boolean;
};

export function isUserRole(value: string): value is UserRole {
  return ROLES.includes(value as UserRole);
}

export function isActivityAction(value: string): value is ActivityAction {
  return ACTIVITY_ACTIONS.includes(value as ActivityAction);
}

export function roleLabel(role: UserRole) {
  if (role === "super_admin") return "Super admin";
  if (role === "admin") return "Admin";
  return "Member";
}

export function visibleRoles(viewer: UserRole | null): UserRole[] {
  if (viewer === "super_admin") return ["member", "admin", "super_admin"];
  if (viewer === "admin") return ["member", "admin"];
  if (viewer === "member") return ["member"];
  return [];
}
