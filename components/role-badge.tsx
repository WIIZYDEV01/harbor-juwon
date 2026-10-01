import { roleLabel, type UserRole } from "@/lib/profile/types";

const styles: Record<UserRole, string> = {
  member: "border border-ink/30 bg-paper text-ink",
  admin: "bg-ink text-paper",
  super_admin: "bg-clay text-paper",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[role]}`}
    >
      {roleLabel(role)}
    </span>
  );
}
