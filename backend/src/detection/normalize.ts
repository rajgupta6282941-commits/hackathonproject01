const lookAlikes: Record<string, string> = { '0': 'o', '1': 'l', '5': 's' };

export function normalizeComparable(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[015]/g, (character) => lookAlikes[character] ?? character)
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeHostname(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
