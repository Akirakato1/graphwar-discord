import { validateCustomMapImportForSave, type CustomMapImport } from "@graphwar/shared";

export function parseCustomMapFileText(text: string): CustomMapImport {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Custom map file must be valid JSON.");
  }

  return validateCustomMapImportForSave(payload);
}
