// Combining diacritical marks (U+0300–U+036F). Built from an ASCII-only
// pattern so the source file stays free of literal combining characters.
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Converts an arbitrary string into a URL-safe slug.
 *   "Men's Winter Jacket!" -> "mens-winter-jacket"
 */
export function slugify(input: string): string {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(DIACRITICS, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric -> hyphen
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}
