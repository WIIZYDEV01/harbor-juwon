const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-28 w-28 text-3xl",
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  profileId,
  name,
  hasImage,
  version,
  size = "md",
}: {
  profileId: string;
  name: string;
  hasImage: boolean;
  version?: string;
  size?: keyof typeof sizes;
}) {
  const dimension = sizes[size];
  if (!hasImage) {
    return (
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full bg-ink/10 font-semibold text-ink ${dimension}`}
      >
        {initials(name)}
      </div>
    );
  }

  const query = version ? `?v=${encodeURIComponent(version)}` : "";
  return (
    // Authenticated same-origin route. The bucket stays private.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/profile-image/${profileId}${query}`}
      alt={`Profile photo of ${name || "this person"}`}
      loading="lazy"
      decoding="async"
      className={`shrink-0 rounded-full object-cover ring-1 ring-ink/10 ${dimension}`}
    />
  );
}