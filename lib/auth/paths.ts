export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  if (value.startsWith("/login") || value.startsWith("/signup")) {
    return "/dashboard";
  }
  return value;
}
