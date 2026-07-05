export function normalizeAlias(alias: string): string {
  return alias.trim().toLocaleLowerCase();
}

export function aliasesConflict(left: string, right: string): boolean {
  return normalizeAlias(left) === normalizeAlias(right);
}
