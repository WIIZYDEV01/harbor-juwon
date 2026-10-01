import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getOwnProfile } from "@/lib/profile/queries";

export const dynamic = "force-dynamic";

function accountName(profileName: string | null | undefined, metadata: unknown) {
  const saved = profileName?.trim();
  if (saved) return saved;
  if (metadata && typeof metadata === "object" && "full_name" in metadata) {
    const value = (metadata as { full_name?: unknown }).full_name;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Account";
}

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile } = await getOwnProfile();
  if (!user) redirect("/login");

  return (
    <AppShell
      name={accountName(profile?.full_name, user.user_metadata)}
      role={profile?.role ?? null}
      avatar={
        profile
          ? { id: profile.id, hasImage: Boolean(profile.avatar_url), version: profile.updated_at }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
