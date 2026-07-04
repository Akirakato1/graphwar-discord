import { clientCommandSchema, type ClientCommand } from "@graphwar/shared";

export function parseCommand(data: string): ClientCommand {
  return clientCommandSchema.parse(JSON.parse(data));
}
