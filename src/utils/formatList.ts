export function formatList(items: string[]) {
  return items.reduce((str, item) => `${str}, ${item}`, '').slice(2);
}
