import { readLocalSession, type ClientSession, type LocalSessionStorage } from "./localSession";

export type SessionSource = "local" | "discord";

export type SessionFactoryOptions = {
  href?: string;
  source?: SessionSource;
  storage?: LocalSessionStorage;
};

function readSourceFromHref(href: string | undefined): SessionSource {
  const url = new URL(href ?? "http://localhost:5173/", "http://localhost:5173/");
  return url.searchParams.get("session") === "discord" ? "discord" : "local";
}

export async function readDiscordSession(): Promise<ClientSession> {
  throw new Error("Discord session support is not implemented yet. Use the local session adapter for this checkpoint.");
}

export function createSessionFactory(options: SessionFactoryOptions = {}): () => Promise<ClientSession> {
  const source = options.source ?? readSourceFromHref(options.href);
  if (source === "discord") {
    return readDiscordSession;
  }

  return async () => readLocalSession(options.href, options.storage);
}

export async function readClientSession(options: SessionFactoryOptions = {}): Promise<ClientSession> {
  return createSessionFactory(options)();
}
