import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/profile-card";
import { ProfileForm } from "@/components/profile-form";
import { RoleBadge } from "@/components/role-badge";
import { RoleForm } from "@/components/role-form";
import { StateMessage } from "@/components/state-message";
import { secondaryButton } from "@/components/styles";
import { Toast } from "@/components/toast";
import { deleteProfile } from "@/lib/profile/actions";
import { ERRORS, NOTICES, readCodedMessage } from "@/lib/profile/messages";
import { getOwnProfile, getVisibleProfile } from "@/lib/profile/queries";
import { isUuid } from "@/lib/profile/validate";
import { formatDate } from "@/lib/profile/view";

export const dynamic = "force-dynamic";

export default async function ProfileDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const notice = readCodedMessage(NOTICES, query.notice);
  const error = readCodedMessage(ERRORS, query.error);

  if (!isUuid(id)) {
    return <StateMessage tone="error">{ERRORS.permission}</StateMessage>;
  }

  const [ownResult, visible] = await Promise.all([getOwnProfile(), getVisibleProfile(id)]);

  if (ownResult.error || visible.error) {
    return <StateMessage tone="error">{ERRORS.load}</StateMessage>;
  }

  if (!visible.profile) {
    return (
      <div className="space-y-4">
        <StateMessage tone="error">{ERRORS.permission}</StateMessage>
        <Link href="/profiles" className={secondaryButton}>
          Back to directory
        </Link>
      </div>
    );
  }

  const profile = visible.profile;
  const isSelf = ownResult.profile?.id === profile.id;
  const canAdminister = ownResult.profile?.role === "super_admin" && !isSelf;

  return (
    <div className="space-y-8">
      {notice ? <Toast message={notice} /> : null}
      <PageHeader
        eyebrow="Profile"
        title={profile.full_name || "Unnamed profile"}
        actions={
          <Link href="/profiles" className={secondaryButton}>
            Back to directory
          </Link>
        }
      />
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}

      <div className={`grid gap-6 ${canAdminister ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        <section className="max-w-2xl border border-ink/15 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar
              profileId={profile.id}
              name={profile.full_name}
              hasImage={Boolean(profile.avatar_url)}
              version={profile.updated_at}
              size="xl"
            />
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold text-ink">
                {profile.full_name || "Unnamed profile"}
              </p>
              <div className="mt-2">
                <RoleBadge role={profile.role} />
              </div>
              <p className="mt-3 text-sm text-ink/60">Joined {formatDate(profile.created_at)}</p>
              {isSelf ? (
                <Link href="/profile" className="mt-3 inline-flex text-sm font-semibold underline">
                  Edit my profile
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {canAdminister ? (
          <div className="space-y-6">
            <section className="border border-ink/15 p-6">
              <h2 className="text-base font-semibold text-ink">Edit name</h2>
              <div className="mt-3">
                <ProfileForm mode="admin" defaultName={profile.full_name} profileId={profile.id} />
              </div>
            </section>
            <section className="border border-ink/15 p-6">
              <h2 className="text-base font-semibold text-ink">Change role</h2>
              <div className="mt-3">
                <RoleForm profileId={profile.id} currentRole={profile.role} />
              </div>
            </section>
            <section className="border border-clay/40 p-6">
              <h2 className="text-base font-semibold text-clay">Delete profile</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                This removes the profile and its photo. The sign-in account stays.
              </p>
              <div className="mt-4">
                <ConfirmDialog
                  title="Delete this profile?"
                  description="The profile and its photo will be removed. This cannot be easily undone."
                  confirmLabel="Delete profile"
                  pendingLabel="Deleting profile..."
                  action={deleteProfile}
                  hiddenFields={{ profileId: profile.id, returnPath: "/profiles" }}
                />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
