import { validateCustomMapImportForSave } from "./schemas";
import type { CustomMapImport } from "./types";

export function parseCustomMapForSave(input: unknown): CustomMapImport {
  return validateCustomMapImportForSave(input);
}
