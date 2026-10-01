import Link from "next/link";

function pageHref(base: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

const linkClass =
  "inline-flex min-h-10 items-center rounded-md border border-ink/20 px-4 text-sm font-semibold text-ink hover:bg-ink/5";

export function Pagination({
  base,
  params,
  page,
  totalPages,
}: {
  base: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={pageHref(base, params, page - 1)} className={linkClass}>
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink/70">
        Page {page} of {totalPages}
      </p>
      {page < totalPages ? (
        <Link href={pageHref(base, params, page + 1)} className={linkClass}>
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
