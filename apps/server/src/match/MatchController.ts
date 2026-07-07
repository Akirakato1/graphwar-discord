import {
  defaultLobbyGameplaySettings,
  defaultMatchTuning,
  defaultMaxFunctionLength,
  defaultMapSizePreset,
  normalizeCraterRadius,
  normalizeDamagePerHit,
  type AimDirectionId,
  type FunctionFamilyId,
  type MapSizePresetId,
  type MatchModeId,
  type PlayerId,
  type PlayerState,
  type RoomId,
  type ServerEvent,
  type TeamState,
  type TerrainState,
  type WorldBounds,
  type WorldPoint,
  normalizeMaxFunctionLength,
  worldBoundsForMapSize
} from "@graphwar/shared";
import { FunctionRegistry } from "../functions/FunctionRegistry";
import type { ShotFunction } from "../functions/ShotFunction";
import { FreeForAllMapGenerator } from "../maps/FreeForAllMapGenerator";
import { cloneWorldBounds, type GeneratedMap, type MapGenerator } from "../maps/MapGenerator";
import { TeamVersusMapGenerator } from "../maps/TeamVersusMapGenerator";
import { FreeForAllMode } from "../modes/FreeForAllMode";
import type { GameMode, LobbyPlayer, TurnPlayer } from "../modes/GameMode";
import { teamVersusTeamIds } from "../modes/TeamAssignment";
import { TeamVersusMode } from "../modes/TeamVersusMode";
import { ShotSimulator } from "../simulation/ShotSimulator";
import type { MatchState } from "./MatchState";

const lobbyPosition: WorldPoint = { x: 0, y: 0 };
const emptyTerrain: TerrainState = { blobs: [] };

type ShotRejectedEvent = Extract<ServerEvent, { type: "shot-rejected" }>;
type ShotResolvedEvent = Extract<ServerEvent, { type: "shot-resolved" }>;
type MatchEndedEvent = Extract<ServerEvent, { type: "match-ended" }>;

export type ShotSubmissionEvents =
  | [ShotRejectedEvent]
  | [ShotResolvedEvent]
  | [ShotResolvedEvent, MatchEndedEvent];

export type MatchStartOptions = {
  maxFunctionLength?: number;
  mapSizePreset?: MapSizePresetId;
  damagePerHit?: number;
  craterRadius?: number;
  uniqueFunctionHits?: boolean;
  friendlyFire?: boolean;
  advancedFunctions?: boolean;
};

export type LobbySnapshotOptions = {
  mapSizePreset?: MapSizePresetId;
  worldBounds?: WorldBounds;
};

type MatchRules = {
  damagePerHit: number;
  craterRadius: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  advancedFunctions: boolean;
};

const duplicateHitRejection = "That function already hit this target. Try a different function.";

function cloneSnapshot(snapshot: MatchState): MatchState {
  return structuredClone(snapshot);
}

export class MatchController {
  private readonly lobbyPlayers = new Map<PlayerId, LobbyPlayer>();
  private readonly functionRegistry = new FunctionRegistry();
  private readonly shotSimulator = new ShotSimulator();
  private readonly successfulHitKeys = new Set<string>();
  private matchRules: MatchRules = { ...defaultLobbyGameplaySettings };
  private maxFunctionLength: number = defaultMaxFunctionLength;
  private lobbyWorldBounds: WorldBounds = worldBoundsForMapSize(defaultMapSizePreset);
  private snapshot: MatchState;

  constructor(private readonly roomId: RoomId) {
    this.snapshot = this.createEmptyLobbySnapshot();
  }

  join(
    playerId: PlayerId,
    displayName: string,
    color?: LobbyPlayer["color"],
    avatarUrl?: LobbyPlayer["avatarUrl"]
  ): MatchState {
    if (this.snapshot.phase !== "lobby") {
      throw new Error("Cannot join after match has started");
    }

    this.lobbyPlayers.set(playerId, { id: playerId, displayName, color, avatarUrl });
    this.snapshot = this.createLobbySnapshot(this.snapshot.mode);

    return this.getSnapshot();
  }

  selectMode(modeId: MatchModeId): MatchState {
    if (this.snapshot.phase !== "lobby") {
      throw new Error("Match has already started");
    }

    this.snapshot = this.createLobbySnapshot(modeId);
    return this.getSnapshot();
  }

  setLobbyPlayers(modeId: MatchModeId, players: LobbyPlayer[], options: LobbySnapshotOptions = {}): MatchState {
    if (this.snapshot.phase !== "lobby") {
      throw new Error("Match has already started");
    }

    this.lobbyWorldBounds = this.resolveLobbyWorldBounds(options);
    this.lobbyPlayers.clear();
    for (const player of players) {
      this.lobbyPlayers.set(player.id, { ...player });
    }
    this.snapshot = this.createLobbySnapshot(modeId);

    return this.getSnapshot();
  }

  startMatch(modeId: MatchModeId, generatedMap?: GeneratedMap, options: MatchStartOptions = {}): MatchState {
    if (this.snapshot.phase !== "lobby") {
      throw new Error("Match has already started");
    }

    const lobbyPlayers = this.getOrderedLobbyPlayers();
    if (lobbyPlayers.length === 0) {
      throw new Error("Cannot start match without players");
    }

    const mode = this.createMode(modeId);
    this.maxFunctionLength = normalizeMaxFunctionLength(options.maxFunctionLength);
    this.matchRules = {
      damagePerHit: normalizeDamagePerHit(options.damagePerHit),
      craterRadius: normalizeCraterRadius(options.craterRadius),
      uniqueFunctionHits: options.uniqueFunctionHits ?? defaultLobbyGameplaySettings.uniqueFunctionHits,
      friendlyFire: options.friendlyFire ?? defaultLobbyGameplaySettings.friendlyFire,
      advancedFunctions: options.advancedFunctions ?? defaultLobbyGameplaySettings.advancedFunctions
    };
    this.successfulHitKeys.clear();
    const worldBounds = cloneWorldBounds(
      generatedMap?.worldBounds ??
        (options.mapSizePreset ? worldBoundsForMapSize(options.mapSizePreset) : this.lobbyWorldBounds)
    );
    this.lobbyWorldBounds = cloneWorldBounds(worldBounds);
    const playerIds = lobbyPlayers.map((player) => player.id);
    const teams = mode.buildTeams(lobbyPlayers);
    const teamIdsByPlayerId = this.teamIdsByPlayerId(teams);
    const map = generatedMap ?? this.createMap(modeId, teams, playerIds, worldBounds);
    const spawnsByPlayerId = new Map(map.spawns.map((spawn) => [spawn.playerId, spawn.position]));
    const players = lobbyPlayers.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      color: player.color,
      teamId: teamIdsByPlayerId.get(player.id) ?? "",
      position: spawnsByPlayerId.get(player.id) ?? lobbyPosition,
      hp: defaultMatchTuning.soldierHp,
      alive: true
    }));
    const turnOrder = mode.createTurnOrder(this.toTurnPlayers(players));

    this.snapshot = {
      phase: "playing",
      mode: mode.id,
      worldBounds: cloneWorldBounds(map.worldBounds),
      players,
      teams,
      terrain: map.terrain,
      turn: {
        activePlayerId: turnOrder[0] ?? "",
        order: turnOrder,
        turnNumber: 1
      }
    };

    return this.getSnapshot();
  }

  submitShot(
    playerId: PlayerId,
    functionFamilyId: FunctionFamilyId,
    expression: string,
    aimDirection: AimDirectionId = "east"
  ): ShotSubmissionEvents {
    if (this.snapshot.phase !== "playing") {
      return [this.rejectShot(playerId, "Match is not playing")];
    }

    if (this.snapshot.turn.activePlayerId !== playerId) {
      return [this.rejectShot(playerId, "Player is not active")];
    }

    const shooter = this.snapshot.players.find((player) => player.id === playerId);
    if (!shooter) {
      return [this.rejectShot(playerId, "Shooter is missing")];
    }

    let shot;
    try {
      shot = this.functionRegistry.create(functionFamilyId, expression, {
        advancedFunctions: this.matchRules.advancedFunctions
      });
    } catch (error) {
      return [this.rejectShot(playerId, error instanceof Error ? error.message : "Invalid function expression")];
    }

    const result = this.shotSimulator.simulate({
      shooter,
      players: this.snapshot.players,
      terrain: this.snapshot.terrain,
      shot,
      aimDirection,
      maxFunctionLength: this.maxFunctionLength,
      worldBounds: this.snapshot.worldBounds,
      damagePerHit: this.matchRules.damagePerHit,
      craterRadius: this.matchRules.craterRadius,
      allowFriendlyFire: this.snapshot.mode !== "team-versus" || this.matchRules.friendlyFire
    });
    const duplicateHitKey = this.uniqueHitKey(playerId, functionFamilyId, shot, aimDirection, result);
    if (duplicateHitKey && this.successfulHitKeys.has(duplicateHitKey)) {
      return [this.rejectShot(playerId, duplicateHitRejection)];
    }

    const nextTurn = this.nextTurn(result.players);
    this.snapshot = {
      ...this.snapshot,
      players: result.players,
      terrain: result.terrain,
      turn: nextTurn
    };
    if (duplicateHitKey) {
      this.successfulHitKeys.add(duplicateHitKey);
    }

    const shotResolved: ShotResolvedEvent = {
      type: "shot-resolved",
      roomId: this.roomId,
      shooterId: playerId,
      functionFamilyId,
      aimDirection,
      expression,
      path: result.path,
      impact: result.impact,
      terrain: result.terrain,
      damage: result.damage,
      eliminations: result.eliminations,
      snapshot: this.getSnapshot()
    };

    const mode = this.createMode(this.snapshot.mode);
    const victory = mode.isVictory(this.toTurnPlayers(this.snapshot.players));
    if (victory.ended) {
      this.snapshot = { ...this.snapshot, phase: "ended" };
      return [
        shotResolved,
        { type: "match-ended", roomId: this.roomId, winnerIds: victory.winnerIds, snapshot: this.getSnapshot() }
      ];
    }

    return [shotResolved];
  }

  forcePlayerHpForTest(playerId: PlayerId, hp: number): void {
    if (!this.snapshot.players.some((player) => player.id === playerId)) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    const nextHp = Math.max(0, hp);
    this.snapshot = {
      ...this.snapshot,
      players: this.snapshot.players.map((player) =>
        player.id === playerId ? { ...player, hp: nextHp, alive: nextHp > 0 } : player
      )
    };
  }

  getSnapshot(): MatchState {
    return cloneSnapshot(this.snapshot);
  }

  private createEmptyLobbySnapshot(): MatchState {
    return {
      phase: "lobby",
      mode: "team-versus",
      worldBounds: cloneWorldBounds(this.lobbyWorldBounds),
      players: [],
      teams: [],
      terrain: emptyTerrain,
      turn: {
        activePlayerId: "",
        order: [],
        turnNumber: 1
      }
    };
  }

  private createLobbySnapshot(modeId: MatchModeId): MatchState {
    const lobbyPlayers = this.getOrderedLobbyPlayers();
    const mode = this.createMode(modeId);
    const teams = mode.buildTeams(lobbyPlayers);
    const teamIdsByPlayerId = this.teamIdsByPlayerId(teams);
    const playerIds = lobbyPlayers.map((player) => player.id);

    return {
      phase: "lobby",
      mode: mode.id,
      worldBounds: cloneWorldBounds(this.lobbyWorldBounds),
      players: lobbyPlayers.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        color: player.color,
        teamId: teamIdsByPlayerId.get(player.id) ?? "",
        position: lobbyPosition,
        hp: defaultMatchTuning.soldierHp,
        alive: true
      })),
      teams,
      terrain: emptyTerrain,
      turn: {
        activePlayerId: playerIds[0] ?? "",
        order: playerIds,
        turnNumber: 1
      }
    };
  }

  private nextTurn(players: PlayerState[]): MatchState["turn"] {
    const previousOrder = this.snapshot.turn.order;
    const livingPlayerIds = new Set(players.filter((player) => player.alive).map((player) => player.id));

    if (previousOrder.length === 0 || livingPlayerIds.size === 0) {
      return {
        activePlayerId: "",
        order: [...previousOrder],
        turnNumber: this.snapshot.turn.turnNumber + 1
      };
    }

    const activeIndex = previousOrder.indexOf(this.snapshot.turn.activePlayerId);
    const startIndex = activeIndex >= 0 ? activeIndex : previousOrder.length - 1;
    for (let offset = 1; offset <= previousOrder.length; offset += 1) {
      const nextPlayerId = previousOrder[(startIndex + offset) % previousOrder.length];
      if (livingPlayerIds.has(nextPlayerId)) {
        return {
          activePlayerId: nextPlayerId,
          order: [...previousOrder],
          turnNumber: this.snapshot.turn.turnNumber + 1
        };
      }
    }

    return {
      activePlayerId: "",
      order: [...previousOrder],
      turnNumber: this.snapshot.turn.turnNumber + 1
    };
  }

  private rejectShot(playerId: PlayerId, reason: string): ShotRejectedEvent {
    return { type: "shot-rejected", roomId: this.roomId, playerId, reason };
  }

  private uniqueHitKey(
    shooterId: PlayerId,
    functionFamilyId: FunctionFamilyId,
    shot: ShotFunction,
    aimDirection: AimDirectionId,
    result: ReturnType<ShotSimulator["simulate"]>
  ): string | undefined {
    if (!this.matchRules.uniqueFunctionHits || result.impact.reason !== "player-hit" || !result.impact.targetPlayerId) {
      return undefined;
    }

    return [
      shooterId,
      result.impact.targetPlayerId,
      functionFamilyId,
      aimDirection,
      shot.canonicalExpression
    ].join("|");
  }

  private getOrderedLobbyPlayers(): LobbyPlayer[] {
    return Array.from(this.lobbyPlayers.values());
  }

  private resolveLobbyWorldBounds(options: LobbySnapshotOptions): WorldBounds {
    if (options.worldBounds) {
      return cloneWorldBounds(options.worldBounds);
    }

    if (options.mapSizePreset) {
      return worldBoundsForMapSize(options.mapSizePreset);
    }

    return cloneWorldBounds(this.lobbyWorldBounds);
  }

  private toTurnPlayers(players: PlayerState[]): TurnPlayer[] {
    return players.map((player) => ({ id: player.id, teamId: player.teamId, alive: player.alive }));
  }

  private teamIdsByPlayerId(teams: TeamState[]): Map<PlayerId, string> {
    const teamIds = new Map<PlayerId, string>();
    for (const team of teams) {
      for (const playerId of team.playerIds) {
        teamIds.set(playerId, team.id);
      }
    }
    return teamIds;
  }

  private createMap(
    modeId: MatchModeId,
    teams: TeamState[],
    playerIds: PlayerId[],
    worldBounds: WorldBounds
  ): GeneratedMap {
    const seed = this.mapSeed(playerIds);
    if (modeId === "team-versus" && this.hasTeamVersusTeams(teams)) {
      return new TeamVersusMapGenerator().generateForTeams(seed, teams, worldBounds);
    }

    const generator = this.createMapGenerator(modeId);
    const mapPlayerIds = this.createMapPlayerIds(modeId, teams, playerIds);
    return generator.generate(seed, mapPlayerIds, worldBounds);
  }

  private hasTeamVersusTeams(teams: TeamState[]): boolean {
    const teamIds = new Set(teams.map((team) => team.id));
    return teamVersusTeamIds.every((teamId) => teamIds.has(teamId));
  }

  private createMapPlayerIds(modeId: MatchModeId, teams: TeamState[], fallbackPlayerIds: PlayerId[]): PlayerId[] {
    if (modeId !== "team-versus") {
      return fallbackPlayerIds;
    }

    const playerIdsByTeamId = new Map(teams.map((team) => [team.id, team.playerIds]));
    const teamAPlayerIds = playerIdsByTeamId.get(teamVersusTeamIds[0]);
    const teamBPlayerIds = playerIdsByTeamId.get(teamVersusTeamIds[1]);
    if (!teamAPlayerIds || !teamBPlayerIds) {
      return fallbackPlayerIds;
    }

    const playerIds: PlayerId[] = [];
    const maxTeamSize = Math.max(teamAPlayerIds.length, teamBPlayerIds.length);
    for (let index = 0; index < maxTeamSize; index += 1) {
      const teamAPlayerId = teamAPlayerIds[index];
      const teamBPlayerId = teamBPlayerIds[index];
      if (teamAPlayerId !== undefined) {
        playerIds.push(teamAPlayerId);
      }
      if (teamBPlayerId !== undefined) {
        playerIds.push(teamBPlayerId);
      }
    }

    return playerIds;
  }

  private mapSeed(playerIds: PlayerId[]): string {
    return `${this.roomId}:${playerIds.join(",")}`;
  }

  private createMode(modeId: MatchModeId): GameMode {
    if (modeId === "team-versus") {
      return new TeamVersusMode();
    }
    return new FreeForAllMode();
  }

  private createMapGenerator(modeId: MatchModeId): MapGenerator {
    if (modeId === "team-versus") {
      return new TeamVersusMapGenerator();
    }
    return new FreeForAllMapGenerator();
  }
}
