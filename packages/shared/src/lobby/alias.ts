export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

export function aliasesConflict(left: string, right: string): boolean {
  return normalizeAlias(left) === normalizeAlias(right);
}
