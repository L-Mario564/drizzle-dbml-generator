export function formatList(items: string[], escapeSpaces: boolean = false) {
  return items.reduce((str, item) => `${str}, ${(
    escapeSpaces && item.includes(' ') ? `"${item}"` : item
  )}`, '').slice(2);
}
