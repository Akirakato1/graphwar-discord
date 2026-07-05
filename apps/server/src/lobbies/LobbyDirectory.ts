import { randomUUID } from "node:crypto";
import {
  aliasesConflict,
  type CreateLobbyRequest,
  type DiscordUserId,
  type GuildId,
  type JoinLobbyRequest,
  type LobbyJoinResult,
  type LobbyOccupant,
  type LobbyPlacementId,
  type LobbyRuntimeSnapshot,
  type LobbySlot,
  type LobbyStatus,
  type LobbySummary,
  type RoomId
} from "@graphwar/shared";
import type { MatchModeId } from "@graphwar/shared";

export type LobbyDirectoryOptions = {
  now?: () => Date;
  createRoomId?: () => string;
  upsertStatsEntry?: (guildId: string, discordUserId: string, alias: string) => Promise<unknown>;
};

type RuntimeLobby = {
  guildId: GuildId;
  roomId: RoomId;
  name: string;
  mode: MatchModeId;
  status: LobbyStatus;
  leaderDiscordUserId: DiscordUserId;
  occupants: Map<DiscordUserId, LobbyOccupant>;
  createdAt: string;
  startedAt?: string;
};

export class LobbyDirectory {
  private readonly lobbies = new Map<string, RuntimeLobby>();
  private readonly now: () => Date;
  private readonly createRoomId: () => string;
  private readonly upsertStatsEntry: (guildId: string, discordUserId: string, alias: string) => Promise<unknown>;

  constructor(options: LobbyDirectoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createRoomId = options.createRoomId ?? (() => randomUUID().slice(0, 8));
    this.upsertStatsEntry = options.upsertStatsEntry ?? (async () => undefined);
  }

  async createLobby(guildId: string, request: CreateLobbyRequest): Promise<LobbyJoinResult> {
    const roomId = this.createRoomId();
    const name = request.name.trim();

    if (!name) {
      throw new Error("Lobby name is required.");
    }

    const key = this.lobbyKey(guildId, roomId);
    if (this.lobbies.has(key)) {
      throw new Error("Lobby already exists.");
    }

    const lobby: RuntimeLobby = {
      guildId,
      roomId,
      name,
      mode: request.mode,
      status: "open",
      leaderDiscordUserId: request.leaderDiscordUserId,
      occupants: new Map(),
      createdAt: this.now().toISOString()
    };

    this.lobbies.set(key, lobby);

    try {
      return await this.joinLobby(guildId, roomId, {
        discordUserId: request.leaderDiscordUserId,
        alias: request.alias,
        slot: request.initialSlot
      });
    } catch (error) {
      this.lobbies.delete(key);
      throw error;
    }
  }

  async joinLobby(guildId: string, roomId: string, request: JoinLobbyRequest): Promise<LobbyJoinResult> {
    const lobby = this.requireLobby(guildId, roomId);
    const alias = request.alias.trim();
    const existingOccupant = lobby.occupants.get(request.discordUserId);

    if (!alias) {
      throw new Error("Alias is required.");
    }

    if (lobby.status === "playing" && request.slot === "player" && existingOccupant?.slot !== "player") {
      throw new Error("Started lobbies can only be joined as a spectator.");
    }

    for (const occupant of lobby.occupants.values()) {
      if (occupant.discordUserId !== request.discordUserId && aliasesConflict(occupant.alias, alias)) {
        throw new Error("Alias is already taken.");
      }
    }

    const slot = lobby.status === "playing" && existingOccupant?.slot === "player" ? "player" : request.slot;
    const placement = this.resolvePlacement(lobby, slot, existingOccupant);
    const occupant: LobbyOccupant = {
      discordUserId: request.discordUserId,
      playerId: existingOccupant?.playerId ?? request.discordUserId,
      alias,
      slot,
      placement,
      connected: true,
      isLeader: request.discordUserId === lobby.leaderDiscordUserId
    };

    await this.upsertStatsEntry(guildId, request.discordUserId, alias);
    lobby.occupants.set(request.discordUserId, occupant);

    return {
      lobby: this.snapshot(lobby),
      session: {
        guildId,
        roomId,
        discordUserId: request.discordUserId,
        playerId: occupant.playerId,
        alias,
        slot
      }
    };
  }

  listLobbies(guildId: string): LobbySummary[] {
    return Array.from(this.lobbies.values())
      .filter((lobby) => lobby.guildId === guildId)
      .map((lobby) => {
        const occupants = Array.from(lobby.occupants.values());
        const leader = occupants.find((occupant) => occupant.discordUserId === lobby.leaderDiscordUserId);

        return {
          guildId: lobby.guildId,
          roomId: lobby.roomId,
          name: lobby.name,
          mode: lobby.mode,
          status: lobby.status,
          leaderAlias: leader?.alias ?? "",
          leaderDiscordUserId: lobby.leaderDiscordUserId,
          playerCount: occupants.filter((occupant) => occupant.slot === "player").length,
          spectatorCount: occupants.filter((occupant) => occupant.slot === "spectator").length,
          createdAt: lobby.createdAt
        };
      });
  }

  getLobby(guildId: string, roomId: string): LobbyRuntimeSnapshot {
    return this.snapshot(this.requireLobby(guildId, roomId));
  }

  moveOccupant(
    guildId: string,
    roomId: string,
    actorId: string,
    targetId: string,
    placement: LobbyPlacementId
  ): LobbyRuntimeSnapshot {
    const lobby = this.requireLobby(guildId, roomId);

    if (actorId !== targetId && actorId !== lobby.leaderDiscordUserId) {
      throw new Error("Only the lobby leader can move another player.");
    }

    this.assertPlacementAllowed(lobby, placement);

    const occupant = this.requireOccupant(lobby, targetId);
    const slot: LobbySlot = placement === "spectator" ? "spectator" : "player";
    lobby.occupants.set(targetId, { ...occupant, slot, placement });

    return this.snapshot(lobby);
  }

  autoAssignTeams(guildId: string, roomId: string, actorId: string): LobbyRuntimeSnapshot {
    const lobby = this.requireLobby(guildId, roomId);
    this.assertLeader(lobby, actorId);

    if (lobby.mode !== "team-versus") {
      return this.snapshot(lobby);
    }

    let playerIndex = 0;
    for (const occupant of lobby.occupants.values()) {
      if (occupant.slot === "spectator") {
        continue;
      }

      occupant.placement = playerIndex % 2 === 0 ? "team-a" : "team-b";
      playerIndex += 1;
    }

    return this.snapshot(lobby);
  }

  assertCanStart(guildId: string, roomId: string, actorId: string): { canStart: true } {
    const lobby = this.requireLobby(guildId, roomId);
    this.assertLeader(lobby, actorId);

    const blockedReason = this.startBlockedReason(lobby);
    if (blockedReason) {
      throw new Error(blockedReason);
    }

    return { canStart: true };
  }

  markPlaying(guildId: string, roomId: string): LobbyRuntimeSnapshot {
    const lobby = this.requireLobby(guildId, roomId);
    lobby.status = "playing";
    lobby.startedAt = this.now().toISOString();

    return this.snapshot(lobby);
  }

  playerOccupants(guildId: string, roomId: string): LobbyOccupant[] {
    return Array.from(this.requireLobby(guildId, roomId).occupants.values())
      .filter((occupant) => occupant.slot === "player")
      .map((occupant) => ({ ...occupant }));
  }

  private lobbyKey(guildId: string, roomId: string): string {
    return `${guildId}:${roomId}`;
  }

  private requireLobby(guildId: string, roomId: string): RuntimeLobby {
    const lobby = this.lobbies.get(this.lobbyKey(guildId, roomId));

    if (!lobby) {
      throw new Error("Lobby not found.");
    }

    return lobby;
  }

  private requireOccupant(lobby: RuntimeLobby, discordUserId: string): LobbyOccupant {
    const occupant = lobby.occupants.get(discordUserId);

    if (!occupant) {
      throw new Error("Lobby occupant not found.");
    }

    return occupant;
  }

  private assertPlacementAllowed(lobby: RuntimeLobby, placement: LobbyPlacementId): void {
    if (lobby.mode === "team-versus" && placement === "players") {
      throw new Error("Invalid placement for team-versus lobby.");
    }

    if (lobby.mode === "free-for-all" && (placement === "team-a" || placement === "team-b")) {
      throw new Error("Invalid placement for free-for-all lobby.");
    }
  }

  private resolvePlacement(
    lobby: RuntimeLobby,
    slot: LobbySlot,
    existingOccupant: LobbyOccupant | undefined
  ): LobbyPlacementId {
    if (slot === "spectator") {
      return "spectator";
    }

    if (existingOccupant && existingOccupant.slot === "player" && existingOccupant.placement !== "spectator") {
      return existingOccupant.placement;
    }

    if (lobby.mode === "free-for-all") {
      return "players";
    }

    const teamAOccupants = this.countPlayersInPlacement(lobby, "team-a");
    const teamBOccupants = this.countPlayersInPlacement(lobby, "team-b");
    return teamAOccupants <= teamBOccupants ? "team-a" : "team-b";
  }

  private countPlayersInPlacement(lobby: RuntimeLobby, placement: LobbyPlacementId): number {
    return Array.from(lobby.occupants.values()).filter(
      (occupant) => occupant.slot === "player" && occupant.placement === placement
    ).length;
  }

  private startBlockedReason(lobby: RuntimeLobby): string | undefined {
    if (lobby.status === "playing") {
      return "Match has already started.";
    }

    if (lobby.status !== "open") {
      return "Lobby is not open.";
    }

    if (lobby.mode === "free-for-all") {
      const playerCount = Array.from(lobby.occupants.values()).filter((occupant) => occupant.slot === "player").length;
      return playerCount >= 2 ? undefined : "Free for all needs at least two players.";
    }

    if (this.countPlayersInPlacement(lobby, "team-a") < 1) {
      return "Team A needs at least one player.";
    }

    if (this.countPlayersInPlacement(lobby, "team-b") < 1) {
      return "Team B needs at least one player.";
    }

    return undefined;
  }

  private assertLeader(lobby: RuntimeLobby, actorId: string): void {
    if (actorId !== lobby.leaderDiscordUserId) {
      throw new Error("Only the lobby leader can start.");
    }
  }

  private snapshot(lobby: RuntimeLobby): LobbyRuntimeSnapshot {
    const startBlockedReason = this.startBlockedReason(lobby);

    return {
      guildId: lobby.guildId,
      roomId: lobby.roomId,
      name: lobby.name,
      mode: lobby.mode,
      status: lobby.status,
      leaderDiscordUserId: lobby.leaderDiscordUserId,
      occupants: Array.from(lobby.occupants.values()).map((occupant) => ({ ...occupant })),
      canStart: lobby.status === "open" && !startBlockedReason,
      startBlockedReason,
      createdAt: lobby.createdAt,
      startedAt: lobby.startedAt
    };
  }
}
