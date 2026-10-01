import "server-only";

import {
  visibleRoles,
  type ProfileCardData,
  type ProfileRow,
  type UserRole,
} from "@/lib/profile/types";

export function toCard(row: ProfileRow): ProfileCardData {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    hasImage: Boolean(row.avatar_url),
    createdAt: row.created_at,
    version: row.updated_at,
  };
}

export function rowsMatchRole(viewerRole: UserRole | null, rows: ProfileRow[]) {
  const allowed = new Set<UserRole>(visibleRoles(viewerRole));
  if (allowed.size === 0) return rows.length === 0;
  return rows.every((row) => allowed.has(row.role));
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
