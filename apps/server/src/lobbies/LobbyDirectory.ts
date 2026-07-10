import { randomUUID } from "node:crypto";
import {
  aliasesConflict,
  defaultLobbyGameplaySettings,
  defaultMapSizePreset,
  defaultPlayerColor,
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
  type MapSizePresetId,
  normalizeCraterRadius,
  normalizeDamagePerHit,
  normalizeInputMode,
  normalizeMaxFunctionLength,
  normalizePlayerColor,
  normalizeTurnDurationSeconds,
  type RoomId
} from "@graphwar/shared";
import type { PlayerColor } from "@graphwar/shared";
import type { AimDirectionId, FunctionInputMode, MatchModeId } from "@graphwar/shared";

export type LobbyDirectoryOptions = {
  now?: () => Date;
  createRoomId?: () => string;
  createSessionToken?: () => string;
  upsertStatsEntry?: (guildId: string, discordUserId: string, alias: string) => Promise<unknown>;
  resolveCustomMapName?: (guildId: string, mapId: string) => Promise<string | undefined>;
};

export type LobbySessionIdentity = {
  guildId: GuildId;
  roomId: RoomId;
  discordUserId: DiscordUserId;
  playerId: string;
  alias: string;
  avatarUrl?: string;
  color: PlayerColor;
  slot: LobbySlot;
  sessionToken: string;
};

export type FunctionDraftState = {
  expression: string;
  aimDirection: AimDirectionId;
};

type RuntimeLobby = {
  guildId: GuildId;
  roomId: RoomId;
  name: string;
  mode: MatchModeId;
  status: LobbyStatus;
  leaderDiscordUserId: DiscordUserId;
  occupants: Map<DiscordUserId, LobbyOccupant>;
  sessionTokens: Map<DiscordUserId, string>;
  functionDrafts: Map<DiscordUserId, FunctionDraftState>;
  maxFunctionLength: number;
  damagePerHit: number;
  craterRadius: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  advancedFunctions: boolean;
  functionPreview: boolean;
  functionHistory: boolean;
  turnTimerEnabled: boolean;
  turnDurationSeconds: number;
  inputMode: FunctionInputMode;
  mapSizePreset?: MapSizePresetId;
  createdAt: string;
  startedAt?: string;
  mapId?: string;
  mapName?: string;
};

export class LobbyDirectory {
  private readonly lobbies = new Map<string, RuntimeLobby>();
  private readonly mutationQueues = new Map<string, Promise<void>>();
  private readonly now: () => Date;
  private readonly createRoomId: () => string;
  private readonly createSessionToken: () => string;
  private readonly upsertStatsEntry: (guildId: string, discordUserId: string, alias: string) => Promise<unknown>;
  private readonly resolveCustomMapName: (guildId: string, mapId: string) => Promise<string | undefined>;

  constructor(options: LobbyDirectoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createRoomId = options.createRoomId ?? (() => randomUUID().slice(0, 8));
    this.createSessionToken = options.createSessionToken ?? (() => randomUUID());
    this.upsertStatsEntry = options.upsertStatsEntry ?? (async () => undefined);
    this.resolveCustomMapName = options.resolveCustomMapName ?? (async () => undefined);
  }

  async createLobby(guildId: string, request: CreateLobbyRequest): Promise<LobbyJoinResult> {
    const roomId = this.createRoomId();
    const name = request.name.trim();
    const mapId = request.mapId?.trim();
    const mapName = mapId ? await this.resolveCustomMapName(guildId, mapId) : undefined;

    if (!name) {
      throw new Error("Lobby name is required.");
    }

    if (mapId && !mapName) {
      throw new Error("Custom map not found.");
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
      sessionTokens: new Map(),
      functionDrafts: new Map(),
      maxFunctionLength: normalizeMaxFunctionLength(request.maxFunctionLength),
      damagePerHit: normalizeDamagePerHit(request.damagePerHit),
      craterRadius: normalizeCraterRadius(request.craterRadius),
      uniqueFunctionHits: request.uniqueFunctionHits ?? defaultLobbyGameplaySettings.uniqueFunctionHits,
      friendlyFire:
        request.mode === "team-versus" ? request.friendlyFire ?? defaultLobbyGameplaySettings.friendlyFire : false,
      advancedFunctions: request.advancedFunctions ?? defaultLobbyGameplaySettings.advancedFunctions,
      functionPreview: request.functionPreview ?? defaultLobbyGameplaySettings.functionPreview,
      functionHistory: request.functionHistory ?? defaultLobbyGameplaySettings.functionHistory,
      turnTimerEnabled: request.turnTimerEnabled ?? defaultLobbyGameplaySettings.turnTimerEnabled,
      turnDurationSeconds: normalizeTurnDurationSeconds(request.turnDurationSeconds),
      inputMode: normalizeInputMode(request.inputMode),
      mapSizePreset: mapId ? undefined : request.mapSizePreset ?? defaultMapSizePreset,
      createdAt: this.now().toISOString(),
      mapId,
      mapName
    };

    this.lobbies.set(key, lobby);

    try {
      return await this.joinLobby(guildId, roomId, {
        discordUserId: request.leaderDiscordUserId,
        alias: request.alias,
        avatarUrl: request.avatarUrl,
        color: request.color,
        slot: request.initialSlot
      });
    } catch (error) {
      this.lobbies.delete(key);
      throw error;
    }
  }

  async joinLobby(guildId: string, roomId: string, request: JoinLobbyRequest): Promise<LobbyJoinResult> {
    return this.enqueueLobbyMutation(guildId, roomId, () => this.joinLobbyUnlocked(guildId, roomId, request));
  }

  private async joinLobbyUnlocked(guildId: string, roomId: string, request: JoinLobbyRequest): Promise<LobbyJoinResult> {
    const lobby = this.requireLobby(guildId, roomId);
    const alias = request.alias.trim();
    const existingOccupant = lobby.occupants.get(request.discordUserId);

    if (!alias) {
      throw new Error("Alias is required.");
    }

    if (lobby.status === "playing" && request.slot === "player" && existingOccupant?.slot !== "player") {
      throw new Error("Started lobbies can only be joined as a spectator.");
    }

    if (lobby.status === "ended") {
      throw new Error("Lobby has ended.");
    }

    for (const occupant of lobby.occupants.values()) {
      if (occupant.discordUserId !== request.discordUserId && aliasesConflict(occupant.alias, alias)) {
        throw new Error("Alias is already taken.");
      }
    }

    const slot = lobby.status === "playing" && existingOccupant?.slot === "player" ? "player" : request.slot;
    const placement = this.resolvePlacement(lobby, slot, existingOccupant);
    const color = normalizePlayerColor(request.color, existingOccupant?.color ?? defaultPlayerColor);
    const occupant: LobbyOccupant = {
      discordUserId: request.discordUserId,
      playerId: existingOccupant?.playerId ?? request.discordUserId,
      alias,
      ...(request.avatarUrl ?? existingOccupant?.avatarUrl
        ? { avatarUrl: request.avatarUrl ?? existingOccupant?.avatarUrl }
        : {}),
      color,
      slot,
      placement,
      connected: true,
      isLeader: request.discordUserId === lobby.leaderDiscordUserId
    };

    await this.upsertStatsEntry(guildId, request.discordUserId, alias);
    const sessionToken = this.createSessionToken();
    lobby.occupants.set(request.discordUserId, occupant);
    lobby.sessionTokens.set(request.discordUserId, sessionToken);

    return {
      lobby: this.snapshot(lobby),
      session: {
        guildId,
        roomId,
        discordUserId: request.discordUserId,
        playerId: occupant.playerId,
        alias,
        ...(occupant.avatarUrl ? { avatarUrl: occupant.avatarUrl } : {}),
        color,
        slot,
        sessionToken
      }
    };
  }

  listLobbies(guildId: string): LobbySummary[] {
    return Array.from(this.lobbies.values())
      .filter((lobby) => lobby.guildId === guildId && lobby.status !== "ended")
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
          damagePerHit: lobby.damagePerHit,
          craterRadius: lobby.craterRadius,
          uniqueFunctionHits: lobby.uniqueFunctionHits,
          friendlyFire: lobby.friendlyFire,
          advancedFunctions: lobby.advancedFunctions,
          functionPreview: lobby.functionPreview,
          functionHistory: lobby.functionHistory,
          turnTimerEnabled: lobby.turnTimerEnabled,
          turnDurationSeconds: lobby.turnDurationSeconds,
          inputMode: lobby.inputMode,
          ...(lobby.mapSizePreset ? { mapSizePreset: lobby.mapSizePreset } : {}),
          mapId: lobby.mapId,
          mapName: lobby.mapName,
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

    if (lobby.status !== "open") {
      throw new Error("Cannot move occupants after match has started.");
    }

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

    if (lobby.status !== "open") {
      throw new Error("Cannot move occupants after match has started.");
    }

    this.assertLeader(lobby, actorId);

    if (lobby.mode !== "team-versus") {
      return this.snapshot(lobby);
    }

    let playerIndex = 0;
    for (const occupant of lobby.occupants.values()) {
      occupant.slot = "player";
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

    if (lobby.status !== "open") {
      throw new Error("Match has already started.");
    }

    const blockedReason = this.startBlockedReason(lobby);
    if (blockedReason) {
      throw new Error(blockedReason);
    }

    lobby.status = "playing";
    lobby.startedAt = this.now().toISOString();

    return this.snapshot(lobby);
  }

  markEnded(guildId: string, roomId: string): LobbyRuntimeSnapshot {
    const lobby = this.requireLobby(guildId, roomId);

    lobby.status = "ended";

    return this.snapshot(lobby);
  }

  cancelLobby(guildId: string, roomId: string, actorId: string): LobbyRuntimeSnapshot {
    const lobby = this.requireLobby(guildId, roomId);

    if (actorId !== lobby.leaderDiscordUserId) {
      throw new Error("Only the lobby leader can cancel.");
    }

    if (lobby.status !== "open") {
      throw new Error("Only open lobbies can be cancelled.");
    }

    lobby.status = "ended";

    return this.snapshot(lobby);
  }

  playerOccupants(guildId: string, roomId: string): LobbyOccupant[] {
    return Array.from(this.requireLobby(guildId, roomId).occupants.values())
      .filter((occupant) => occupant.slot === "player")
      .map((occupant) => ({ ...occupant }));
  }

  validateSession(guildId: string, roomId: string, sessionToken: string | undefined): LobbySessionIdentity {
    return this.requireSession(guildId, roomId, sessionToken).identity;
  }

  markConnected(guildId: string, roomId: string, sessionToken: string | undefined): LobbyRuntimeSnapshot {
    const { identity, lobby, occupant } = this.requireSession(guildId, roomId, sessionToken);
    lobby.occupants.set(identity.discordUserId, { ...occupant, connected: true });
    return this.snapshot(lobby);
  }

  markDisconnected(guildId: string, roomId: string, sessionToken: string | undefined): LobbyRuntimeSnapshot | undefined {
    try {
      const { identity, lobby, occupant } = this.requireSession(guildId, roomId, sessionToken);
      lobby.occupants.set(identity.discordUserId, { ...occupant, connected: false });
      return this.snapshot(lobby);
    } catch {
      return undefined;
    }
  }

  isOpenLeaderSession(guildId: string, roomId: string, sessionToken: string | undefined): boolean {
    try {
      const { identity, lobby } = this.requireSession(guildId, roomId, sessionToken);
      return lobby.status === "open" && identity.discordUserId === lobby.leaderDiscordUserId;
    } catch {
      return false;
    }
  }

  saveFunctionDraft(
    guildId: string,
    roomId: string,
    sessionToken: string | undefined,
    draft: FunctionDraftState
  ): FunctionDraftState {
    const { identity, lobby } = this.requireSession(guildId, roomId, sessionToken);
    const expression = draft.expression.trim();
    if (!expression) {
      throw new Error("Function draft expression is required.");
    }

    const stored = { expression, aimDirection: draft.aimDirection };
    lobby.functionDrafts.set(identity.discordUserId, stored);
    return { ...stored };
  }

  readFunctionDraft(
    guildId: string,
    roomId: string,
    sessionToken: string | undefined
  ): FunctionDraftState | undefined {
    try {
      const { identity, lobby } = this.requireSession(guildId, roomId, sessionToken);
      const draft = lobby.functionDrafts.get(identity.discordUserId);
      return draft ? { ...draft } : undefined;
    } catch {
      return undefined;
    }
  }

  private lobbyKey(guildId: string, roomId: string): string {
    return `${guildId}:${roomId}`;
  }

  private enqueueLobbyMutation<T>(guildId: string, roomId: string, task: () => Promise<T>): Promise<T> {
    const key = this.lobbyKey(guildId, roomId);
    const previous = this.mutationQueues.get(key) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(task);
    const stored = queued.then(
      () => undefined,
      () => undefined
    );
    this.mutationQueues.set(key, stored);
    void stored.then(() => {
      if (this.mutationQueues.get(key) === stored) {
        this.mutationQueues.delete(key);
      }
    });
    return queued;
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

  private requireSession(
    guildId: string,
    roomId: string,
    sessionToken: string | undefined
  ): { identity: LobbySessionIdentity; lobby: RuntimeLobby; occupant: LobbyOccupant } {
    if (!sessionToken) {
      throw new Error("Lobby session token is required.");
    }

    const lobby = this.requireLobby(guildId, roomId);
    for (const [discordUserId, token] of lobby.sessionTokens.entries()) {
      if (token !== sessionToken) {
        continue;
      }

      const occupant = this.requireOccupant(lobby, discordUserId);
      return {
        lobby,
        occupant,
        identity: {
          guildId,
          roomId,
          discordUserId,
          playerId: occupant.playerId,
          alias: occupant.alias,
          ...(occupant.avatarUrl ? { avatarUrl: occupant.avatarUrl } : {}),
          color: occupant.color,
          slot: occupant.slot,
          sessionToken
        }
      };
    }

    throw new Error("Invalid lobby session.");
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
    if (lobby.status === "ended") {
      return "Lobby has ended.";
    }

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
      maxFunctionLength: lobby.maxFunctionLength,
      damagePerHit: lobby.damagePerHit,
      craterRadius: lobby.craterRadius,
      uniqueFunctionHits: lobby.uniqueFunctionHits,
      friendlyFire: lobby.friendlyFire,
      advancedFunctions: lobby.advancedFunctions,
      functionPreview: lobby.functionPreview,
      functionHistory: lobby.functionHistory,
      turnTimerEnabled: lobby.turnTimerEnabled,
      turnDurationSeconds: lobby.turnDurationSeconds,
      inputMode: lobby.inputMode,
      ...(lobby.mapSizePreset ? { mapSizePreset: lobby.mapSizePreset } : {}),
      mapId: lobby.mapId,
      mapName: lobby.mapName,
      createdAt: lobby.createdAt,
      startedAt: lobby.startedAt
    };
  }
}
