export function normalizeMatchName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/['’`]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeMatchNames(values: readonly string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => normalizeMatchName(value))
        .filter((value) => value.length > 0),
    ),
  ];
}
