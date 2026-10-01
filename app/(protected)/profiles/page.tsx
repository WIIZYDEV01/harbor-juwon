import { DirectoryFilters } from "@/components/directory-filters";
import { DirectoryTable } from "@/components/directory-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StateMessage } from "@/components/state-message";
import { Toast } from "@/components/toast";
import { ERRORS, NOTICES, readCodedMessage } from "@/lib/profile/messages";
import { getOwnProfile, listDirectory } from "@/lib/profile/queries";
import { isUserRole, roleLabel, visibleRoles } from "@/lib/profile/types";
import { rowsMatchRole, toCard } from "@/lib/profile/view";

export const dynamic = "force-dynamic";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; q?: string; role?: string; page?: string }>;
}) {
  const params = await searchParams;
  const notice = readCodedMessage(NOTICES, params.notice);
  const error = readCodedMessage(ERRORS, params.error);
  const query = (params.q ?? "").trim().slice(0, 80);
  const roleParam = params.role ?? "";
  const role = isUserRole(roleParam) ? roleParam : null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [ownResult, list] = await Promise.all([
    getOwnProfile(),
    listDirectory({ query, role, page }),
  ]);
  if (ownResult.error) return <StateMessage tone="error">{ERRORS.load}</StateMessage>;

  const viewerRole = ownResult.profile?.role ?? null;
  if (!viewerRole) {
    return (
      <div className="space-y-6">
        <PageHeader title="Directory" description="Create your profile to open the directory." />
        <StateMessage tone="empty">Create your profile to see the directory.</StateMessage>
      </div>
    );
  }

  if (list.error || !rowsMatchRole(viewerRole, list.rows)) {
    return <StateMessage tone="error">{ERRORS.load}</StateMessage>;
  }

  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const people = list.rows.map(toCard);
  const emptyText = query
    ? `No one matches “${query}”.`
    : role
      ? `No ${roleLabel(role).toLowerCase()}s found.`
      : "No profiles yet.";

  return (
    <div className="space-y-6">
      {notice ? <Toast message={notice} /> : null}
      <PageHeader
        eyebrow="People"
        title="Directory"
        description={
          viewerRole === "super_admin"
            ? "Everyone in Harbor."
            : viewerRole === "admin"
              ? "Members and admins."
              : "Members of Harbor."
        }
      />
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      <DirectoryFilters
        action="/profiles"
        query={query}
        role={role ?? ""}
        roles={visibleRoles(viewerRole)}
      />
      <p className="text-sm text-ink/70" aria-live="polite">
        {list.total === 1 ? "1 person" : `${list.total} people`}
      </p>
      <DirectoryTable
        people={people}
        viewerRole={viewerRole}
        viewerProfileId={ownResult.profile?.id ?? null}
        empty={emptyText}
      />
      <Pagination
        base="/profiles"
        params={{ q: query || undefined, role: role ?? undefined }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
