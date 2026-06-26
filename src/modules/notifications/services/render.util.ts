/**
 * Minimal `{{key}}` template renderer (D62). Unknown / null keys render empty.
 * Whitespace inside the braces is tolerated: `{{ orderNumber }}`.
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown> = {},
): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    return JSON.stringify(value);
  });
}
