import Link from "next/link";
import { primaryButton, textInput } from "@/components/styles";
import { roleLabel, type UserRole } from "@/lib/profile/types";

export function DirectoryFilters({
  action,
  query,
  role,
  roles,
}: {
  action: string;
  query: string;
  role: string;
  roles: UserRole[];
}) {
  const filtered = Boolean(query || role);

  return (
    <form
      action={action}
      method="get"
      role="search"
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
    >
      <div>
        <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-ink">
          Search by name
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={80}
          placeholder="Type a name"
          className={textInput}
        />
      </div>
      <div>
        <label htmlFor="role-filter" className="mb-1.5 block text-sm font-medium text-ink">
          Role
        </label>
        <select id="role-filter" name="role" defaultValue={role} className={textInput}>
          <option value="">All roles</option>
          {roles.map((item) => (
            <option key={item} value={item}>
              {roleLabel(item)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={`${primaryButton} min-h-11`}>
          Search
        </button>
        {filtered ? (
          <Link
            href={action}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink underline"
          >
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
