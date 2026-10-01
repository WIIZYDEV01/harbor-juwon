import { RoleBadge } from "@/components/role-badge";
import { StateMessage } from "@/components/state-message";
import type { ActivityAction, ActivityItem } from "@/lib/profile/types";

const verbs: Record<ActivityAction, string> = {
  profile_created: "created the profile for",
  profile_updated: "updated the name on",
  profile_deleted: "deleted the profile for",
  image_uploaded: "uploaded a photo for",
  image_replaced: "replaced the photo for",
  image_deleted: "removed the photo for",
  role_changed: "changed the role of",
};

const selfVerbs: Record<ActivityAction, string> = {
  profile_created: "created their profile",
  profile_updated: "updated their name",
  profile_deleted: "deleted their profile",
  image_uploaded: "uploaded a photo",
  image_replaced: "replaced their photo",
  image_deleted: "removed their photo",
  role_changed: "had their role changed",
};

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <StateMessage tone="empty">No activity yet.</StateMessage>;
  }

  return (
    <ol className="divide-y divide-ink/10 border border-ink/15">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">
            <span className="font-semibold">{item.actorName}</span>{" "}
            {item.selfAction ? (
              selfVerbs[item.action]
            ) : (
              <>
                {verbs[item.action]} <span className="font-semibold">{item.targetName}</span>
              </>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <RoleBadge role={item.targetRole} />
            <time dateTime={item.createdAt} className="text-xs tabular-nums text-ink/60">
              {when(item.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
