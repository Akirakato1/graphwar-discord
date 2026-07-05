import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { GuildSettings, PersistedServerState, PlayerStatsEntry } from "@graphwar/shared";

function defaultSettings(guildId: string): GuildSettings {
  return { guildId, defaultMode: "team-versus", allowSpectators: true };
}

function emptyState(): PersistedServerState {
  return { guilds: {} };
}

function nowIso(): string {
  return new Date().toISOString();
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export class LocalStateStore {
  constructor(private readonly filePath = "apps/server/data/local-state.json") {}

  async getGuildSettings(guildId: string): Promise<GuildSettings> {
    const state = await this.readState();
    return state.guilds[guildId]?.settings ?? defaultSettings(guildId);
  }

  async saveGuildSettings(settings: GuildSettings): Promise<GuildSettings> {
    const state = await this.readState();
    const guild = (state.guilds[settings.guildId] ??= {
      settings: defaultSettings(settings.guildId),
      leaderboard: {}
    });
    guild.settings = settings;
    await this.writeState(state);
    return settings;
  }

  async upsertStatsEntry(guildId: string, discordUserId: string, alias: string): Promise<PlayerStatsEntry> {
    const state = await this.readState();
    const guild = (state.guilds[guildId] ??= { settings: defaultSettings(guildId), leaderboard: {} });
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
  }

  async recordMatchResult(guildId: string, winnerIds: string[], participantIds: string[]): Promise<void> {
    const state = await this.readState();
    const guild = (state.guilds[guildId] ??= { settings: defaultSettings(guildId), leaderboard: {} });
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
}
