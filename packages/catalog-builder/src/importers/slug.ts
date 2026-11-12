/**
 * Slug generator (docs/03 §3). It only proposes: the result is stored in the
 * curated data and never recomputed.
 */
export function proposeSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
