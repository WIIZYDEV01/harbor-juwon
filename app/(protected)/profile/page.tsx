import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImageUploader } from "@/components/image-uploader";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/profile-card";
import { ProfileForm } from "@/components/profile-form";
import { RoleBadge } from "@/components/role-badge";
import { StateMessage } from "@/components/state-message";
import { Toast } from "@/components/toast";
import { deleteProfile } from "@/lib/profile/actions";
import { ERRORS, NOTICES, readCodedMessage } from "@/lib/profile/messages";
import { getOwnProfile } from "@/lib/profile/queries";
import { formatDate } from "@/lib/profile/view";

export const dynamic = "force-dynamic";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-ink/60">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const notice = readCodedMessage(NOTICES, params.notice);
  const error = readCodedMessage(ERRORS, params.error);
  const { user, profile, error: loadError } = await getOwnProfile();

  if (!user) return null;
  if (loadError) return <StateMessage tone="error">{ERRORS.load}</StateMessage>;

  return (
    <div className="space-y-8">
      {notice ? <Toast message={notice} /> : null}
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Your name and photo. Your role and account ID stay with the account."
      />
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}

      {profile ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <section className="border border-ink/15 p-6" aria-labelledby="identity-title">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar
                  profileId={profile.id}
                  name={profile.full_name}
                  hasImage={Boolean(profile.avatar_url)}
                  version={profile.updated_at}
                  size="xl"
                />
                <div className="min-w-0">
                  <h2 id="identity-title" className="truncate text-2xl font-semibold text-ink">
                    {profile.full_name || "Unnamed profile"}
                  </h2>
                  <div className="mt-2">
                    <RoleBadge role={profile.role} />
                  </div>
                </div>
              </div>

              <dl className="mt-6 divide-y divide-ink/10 border-t border-ink/10">
                <Detail label="Email">{user.email}</Detail>
                <Detail label="Role">
                  <span className="inline-flex items-center gap-2">
                    <RoleBadge role={profile.role} />
                    <span className="text-ink/60">Read only</span>
                  </span>
                </Detail>
                <Detail label="Account ID">
                  <span className="break-all font-mono text-xs text-ink/70">{profile.user_id}</span>
                  <span className="mt-1 block text-xs text-ink/60">Not editable</span>
                </Detail>
                <Detail label="Created">{formatDate(profile.created_at)}</Detail>
                <Detail label="Last updated">{formatDate(profile.updated_at)}</Detail>
              </dl>

              <div className="mt-6 border-t border-ink/10 pt-6">
                <h3 className="text-base font-semibold text-ink">Edit name</h3>
                <div className="mt-3">
                  <ProfileForm mode="update" defaultName={profile.full_name} />
                </div>
              </div>
            </section>

            <section className="border border-ink/15 p-6" aria-labelledby="photo-title">
              <h2 id="photo-title" className="text-base font-semibold text-ink">
                Profile photo
              </h2>
              <p className="mt-1 text-sm text-ink/70">
                {profile.avatar_url
                  ? "Choose a new file to replace your photo, or remove it."
                  : "Add a photo so people can recognise you."}
              </p>
              <div className="mt-5">
                <ImageUploader hasImage={Boolean(profile.avatar_url)} />
              </div>
            </section>
          </div>

          <section className="border border-clay/40 p-6" aria-labelledby="danger-title">
            <h2 id="danger-title" className="text-base font-semibold text-clay">
              Delete profile
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
              {profile.role === "member"
                ? "This deletes your profile and photo. Your sign-in stays, and you can create the profile again."
                : "This deletes your profile and photo. A new profile starts as a member, and an operator must restore your role."}
            </p>
            <div className="mt-4">
              <ConfirmDialog
                title="Delete this profile?"
                description="Your profile and photo will be removed. This cannot be easily undone."
                confirmLabel="Delete profile"
                pendingLabel="Deleting profile..."
                action={deleteProfile}
                hiddenFields={{ profileId: profile.id, returnPath: "/profile" }}
              />
            </div>
          </section>
        </>
      ) : (
        <section className="max-w-xl border border-ink/15 p-6">
          <h2 className="text-lg font-semibold text-ink">Create profile</h2>
          <p className="mt-2 text-sm text-ink/70">
            Your account email is {user.email}. New profiles start as members.
          </p>
          <div className="mt-4">
            <ProfileForm mode="create" defaultName="" />
          </div>
        </section>
      )}
    </div>
  );
}
