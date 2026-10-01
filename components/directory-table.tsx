import Link from "next/link";
import { Avatar } from "@/components/profile-card";
import { RoleBadge } from "@/components/role-badge";
import { StateMessage } from "@/components/state-message";
import type { ProfileCardData, UserRole } from "@/lib/profile/types";

function formatJoined(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function actionLabel(viewerRole: UserRole | null, isSelf: boolean) {
  if (isSelf) return "Edit";
  if (viewerRole === "super_admin") return "Manage";
  return "View";
}

export function DirectoryTable({
  people,
  viewerRole,
  viewerProfileId,
  empty,
}: {
  people: ProfileCardData[];
  viewerRole: UserRole | null;
  viewerProfileId: string | null;
  empty: string;
}) {
  if (people.length === 0) {
    return <StateMessage tone="empty">{empty}</StateMessage>;
  }

  return (
    <>
      <div className="hidden border border-ink/15 md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/15 text-xs uppercase tracking-[0.12em] text-ink/60">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Person</th>
              <th scope="col" className="px-4 py-3 font-semibold">Role</th>
              <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {people.map((person) => {
              const isSelf = person.id === viewerProfileId;
              return (
                <tr key={person.id} className="hover:bg-ink/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        profileId={person.id}
                        name={person.fullName}
                        hasImage={person.hasImage}
                        version={person.version}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">
                          {person.fullName || "Unnamed profile"}
                        </p>
                        {isSelf ? <p className="text-xs text-ink/60">You</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={person.role} />
                  </td>
                  <td className="px-4 py-3 text-ink/70">{formatJoined(person.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={isSelf ? "/profile" : `/profiles/${person.id}`}
                      className="inline-flex min-h-9 items-center rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink hover:bg-ink/5"
                    >
                      {actionLabel(viewerRole, isSelf)}
                      <span className="sr-only"> {person.fullName}</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-ink/10 border border-ink/15 md:hidden">
        {people.map((person) => {
          const isSelf = person.id === viewerProfileId;
          return (
            <li key={person.id}>
              <Link
                href={isSelf ? "/profile" : `/profiles/${person.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]"
              >
                <Avatar
                  profileId={person.id}
                  name={person.fullName}
                  hasImage={person.hasImage}
                  version={person.version}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {person.fullName || "Unnamed profile"}
                    {isSelf ? <span className="font-normal text-ink/60"> · You</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/60">Joined {formatJoined(person.createdAt)}</p>
                </div>
                <RoleBadge role={person.role} />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
