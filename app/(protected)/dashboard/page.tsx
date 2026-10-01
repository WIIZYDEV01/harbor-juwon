import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { DirectoryTable } from "@/components/directory-table";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/profile-card";
import { RoleBadge } from "@/components/role-badge";
import { StatCard } from "@/components/stat-card";
import { StateMessage } from "@/components/state-message";
import { primaryButton, secondaryButton } from "@/components/styles";
import { Toast } from "@/components/toast";
import { ERRORS, NOTICES, readCodedMessage } from "@/lib/profile/messages";
import {
  getOwnProfile,
  getProfileStats,
  listActivity,
  listDirectory,
} from "@/lib/profile/queries";
import type { ProfileRow } from "@/lib/profile/types";
import { formatDate, rowsMatchRole, toCard } from "@/lib/profile/view";

export const dynamic = "force-dynamic";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function completion(profile: ProfileRow | null) {
  if (!profile) return { done: 0, label: "Not created" };
  const done = Number(Boolean(profile.full_name.trim())) + Number(Boolean(profile.avatar_url));
  return { done, label: done === 2 ? "Complete" : "Add a photo" };
}

function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {href ? (
        <Link href={href} className="text-sm font-semibold text-ink underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const notice = readCodedMessage(NOTICES, params.notice);
  const error = readCodedMessage(ERRORS, params.error);
  const [ownResult, directory] = await Promise.all([
    getOwnProfile(),
    listDirectory({ pageSize: 8 }),
  ]);

  if (!ownResult.user) return null;
  if (ownResult.error) return <StateMessage tone="error">{ERRORS.load}</StateMessage>;

  const own = ownResult.profile;
  const role = own?.role ?? null;
  const isStaff = role === "admin" || role === "super_admin";
  const preview = role ? directory : null;

  const [statsResult, activity] = await Promise.all([
    isStaff ? getProfileStats() : null,
    isStaff ? listActivity(ownResult.user.id, 10) : null,
  ]);

  if (
    (preview && (preview.error || !rowsMatchRole(role, preview.rows))) ||
    statsResult?.error ||
    activity?.error
  ) {
    return <StateMessage tone="error">{ERRORS.load}</StateMessage>;
  }

  const status = completion(own);
  const people = (preview?.rows ?? []).slice(0, isStaff ? 8 : 6).map(toCard);
  const stats = statsResult?.stats;

  return (
    <div className="space-y-10">
      {notice ? <Toast message={notice} /> : null}
      <PageHeader
        eyebrow={role === "super_admin" ? "Super admin" : role === "admin" ? "Admin" : "Dashboard"}
        title={own ? `Welcome back, ${firstName(own.full_name)}` : "Welcome to Harbor"}
        description={
          role === "super_admin"
            ? "Everyone in Harbor, recent changes, and the people you manage."
            : role === "admin"
              ? "Members and admins you can see, and recent changes to them."
              : "Your profile and the members you can see."
        }
        actions={
          <>
            <Link href="/profile" className={primaryButton}>
              {own ? "Edit profile" : "Create profile"}
            </Link>
            <Link href="/profiles" className={secondaryButton}>
              Open directory
            </Link>
          </>
        }
      />
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}

      <section aria-labelledby="summary-title" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex flex-col gap-5 border border-ink/15 p-6 sm:flex-row sm:items-center">
          {own ? (
            <Avatar
              profileId={own.id}
              name={own.full_name}
              hasImage={Boolean(own.avatar_url)}
              version={own.updated_at}
              size="xl"
            />
          ) : (
            <div aria-hidden="true" className="h-28 w-28 shrink-0 rounded-full border border-dashed border-ink/30" />
          )}
          <div className="min-w-0">
            <h2 id="summary-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
              My profile
            </h2>
            {own ? (
              <>
                <p className="mt-2 truncate text-2xl font-semibold text-ink">
                  {own.full_name || "Unnamed profile"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <RoleBadge role={own.role} />
                  <span className="text-sm text-ink/60">Joined {formatDate(own.created_at)}</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink/70">You have not created a profile yet.</p>
            )}
          </div>
        </div>
        <div className="border border-ink/15 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">Profile status</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{status.label}</p>
          <div
            className="mt-4 h-2 w-full bg-ink/10"
            role="progressbar"
            aria-label="Profile completion"
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={status.done}
          >
            <div className="h-2 bg-clay" style={{ width: `${(status.done / 2) * 100}%` }} />
          </div>
          <ul className="mt-4 space-y-1 text-sm text-ink/70">
            <li>{own?.full_name.trim() ? "Name added" : "Name missing"}</li>
            <li>{own?.avatar_url ? "Photo added" : "Photo missing"}</li>
          </ul>
        </div>
      </section>

      {stats ? (
        <section className="space-y-4">
          <SectionTitle title="Overview" />
          <dl className={`grid gap-4 sm:grid-cols-2 ${role === "super_admin" ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            {role === "super_admin" ? (
              <>
                <StatCard label="Total people" value={stats.total} accent />
                <StatCard label="Members" value={stats.members} />
                <StatCard label="Admins" value={stats.admins} />
                <StatCard label="Super admins" value={stats.superAdmins} />
                <StatCard label="With photo" value={stats.withImages} note={`of ${stats.total}`} />
              </>
            ) : (
              <>
                <StatCard label="Members" value={stats.members} accent />
                <StatCard label="Admins" value={stats.admins} />
                <StatCard label="My profile" value={status.label} />
                <StatCard label="With photo" value={stats.withImages} note={`of ${stats.total} you can see`} />
              </>
            )}
          </dl>
        </section>
      ) : null}

      {role ? (
        <section className="space-y-4">
          <SectionTitle
            title={role === "member" ? "Members" : "People"}
            href="/profiles"
            linkLabel={`View all ${preview?.total ?? 0}`}
          />
          <DirectoryTable
            people={people}
            viewerRole={role}
            viewerProfileId={own?.id ?? null}
            empty={role === "member" ? "No members yet." : "No profiles yet."}
          />
        </section>
      ) : null}

      {activity ? (
        <section className="space-y-4">
          <SectionTitle title="Recent activity" />
          <ActivityList items={activity.items} />
        </section>
      ) : null}
    </div>
  );
}
