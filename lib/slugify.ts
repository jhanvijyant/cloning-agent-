export function slugify(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "site";
    }
  })();
  const base = host.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}
