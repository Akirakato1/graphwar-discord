import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCustomMapImportForSave } from "@graphwar/shared";
import type { CustomMapImport, GuildSettings, PersistedCustomMap, PersistedServerState, PlayerStatsEntry } from "@graphwar/shared";

export const defaultLocalStateFilePath = fileURLToPath(new URL("../../data/local-state.json", import.meta.url));

function defaultSettings(guildId: string): GuildSettings {
  return { guildId, defaultMode: "team-versus", allowSpectators: true };
}

function emptyState(): PersistedServerState {
  return { guilds: {} };
}

function nowIso(): string {
  return new Date().toISOString();
}

type PersistedGuildState = PersistedServerState["guilds"][string] & {
  customMaps: NonNullable<PersistedServerState["guilds"][string]["customMaps"]>;
};

function ensureGuild(state: PersistedServerState, guildId: string): PersistedGuildState {
  const guild = (state.guilds[guildId] ??= {
    settings: defaultSettings(guildId),
    leaderboard: {},
    customMaps: {}
  });
  guild.customMaps ??= {};
  return guild as PersistedGuildState;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export class LocalStateStore {
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath = defaultLocalStateFilePath) {}

  async getGuildSettings(guildId: string): Promise<GuildSettings> {
    const state = await this.readState();
    return state.guilds[guildId]?.settings ?? defaultSettings(guildId);
  }

  async saveGuildSettings(settings: GuildSettings): Promise<GuildSettings> {
    return this.enqueueMutation(async () => {
      const state = await this.readState();
      const guild = ensureGuild(state, settings.guildId);
      guild.settings = settings;
      await this.writeState(state);
      return settings;
    });
  }

  async upsertStatsEntry(guildId: string, discordUserId: string, alias: string): Promise<PlayerStatsEntry> {
    return this.enqueueMutation(async () => {
      const state = await this.readState();
      const guild = ensureGuild(state, guildId);
      const existing = guild.leaderboard[discordUserId];
      const entry: PlayerStatsEntry = {
        guildId,
        discordUserId,
        lastAlias: alias,
        gamesPlayed: existing?.gamesPlayed ?? 0,
        wins: existing?.wins ?? 0,
        eliminations: existing?.eliminations ?? 0,
        damageDealt: existing?.damageDealt ?? 0,
        updatedAt: nowIso()
      };
      guild.leaderboard[discordUserId] = entry;
      await this.writeState(state);
      return entry;
    });
  }

  async recordMatchResult(guildId: string, winnerIds: string[], participantIds: string[]): Promise<void> {
    return this.enqueueMutation(async () => {
      const state = await this.readState();
      const guild = ensureGuild(state, guildId);
      const winners = new Set(winnerIds);
      for (const participantId of participantIds) {
        const existing =
          guild.leaderboard[participantId] ??
          ({
            guildId,
            discordUserId: participantId,
            lastAlias: participantId,
            gamesPlayed: 0,
            wins: 0,
            eliminations: 0,
            damageDealt: 0,
            updatedAt: nowIso()
          } satisfies PlayerStatsEntry);
        guild.leaderboard[participantId] = {
          ...existing,
          gamesPlayed: existing.gamesPlayed + 1,
          wins: existing.wins + (winners.has(participantId) ? 1 : 0),
          updatedAt: nowIso()
        };
      }
      await this.writeState(state);
    });
  }

  async listCustomMaps(guildId: string): Promise<PersistedCustomMap[]> {
    const state = await this.readState();
    return Object.values(state.guilds[guildId]?.customMaps ?? {}).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  async getCustomMap(guildId: string, mapId: string): Promise<PersistedCustomMap | undefined> {
    const state = await this.readState();
    return state.guilds[guildId]?.customMaps?.[mapId];
  }

  async saveCustomMap(
    guildId: string,
    ownerDiscordUserId: string,
    inputMap: CustomMapImport
  ): Promise<PersistedCustomMap> {
    return this.enqueueMutation(async () => {
      const map = validateCustomMapImportForSave(inputMap);
      const state = await this.readState();
      const guild = ensureGuild(state, guildId);
      const now = nowIso();
      const persisted: PersistedCustomMap = {
        ...map,
        id: randomUUID(),
        guildId,
        ownerDiscordUserId,
        createdAt: now,
        updatedAt: now
      };
      guild.customMaps[persisted.id] = persisted;
      await this.writeState(state);
      return persisted;
    });
  }

  async deleteCustomMap(guildId: string, mapId: string, actorDiscordUserId: string): Promise<void> {
    return this.enqueueMutation(async () => {
      const state = await this.readState();
      const guild = ensureGuild(state, guildId);
      const existing = guild.customMaps[mapId];
      if (!existing) {
        throw new Error("Custom map not found.");
      }
      if (existing.ownerDiscordUserId !== actorDiscordUserId) {
        throw new Error("Only the map owner can delete this custom map.");
      }
      delete guild.customMaps[mapId];
      await this.writeState(state);
    });
  }

  async getLeaderboard(guildId: string): Promise<PlayerStatsEntry[]> {
    const state = await this.readState();
    return Object.values(state.guilds[guildId]?.leaderboard ?? {}).sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      return right.gamesPlayed - left.gamesPlayed;
    });
  }

  private async readState(): Promise<PersistedServerState> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as PersistedServerState;
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) {
        return emptyState();
      }
      throw error;
    }
  }

  private async writeState(state: PersistedServerState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(operation, operation);
    this.mutationQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}
