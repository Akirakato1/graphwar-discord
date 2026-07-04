import {
  defaultMatchTuning,
  type FunctionFamilyId,
  type MatchModeId,
  type PlayerId,
  type PlayerState,
  type RoomId,
  type ServerEvent,
  type TeamState,
  type TerrainState,
  type WorldPoint
} from "@graphwar/shared";
import { FunctionRegistry } from "../functions/FunctionRegistry";
import { FreeForAllMapGenerator } from "../maps/FreeForAllMapGenerator";
import type { MapGenerator } from "../maps/MapGenerator";
import { TeamVersusMapGenerator } from "../maps/TeamVersusMapGenerator";
import { FreeForAllMode } from "../modes/FreeForAllMode";
import type { GameMode, LobbyPlayer, TurnPlayer } from "../modes/GameMode";
import { TeamVersusMode } from "../modes/TeamVersusMode";
import { ShotSimulator } from "../simulation/ShotSimulator";
import type { MatchState } from "./MatchState";

const lobbyPosition: WorldPoint = { x: 0, y: 0 };
const emptyTerrain: TerrainState = { blobs: [] };

export class MatchController {
  private readonly lobbyPlayers = new Map<PlayerId, LobbyPlayer>();
  private readonly functionRegistry = new FunctionRegistry();
  private readonly shotSimulator = new ShotSimulator();
  private snapshot: MatchState;

  constructor(private readonly roomId: RoomId) {
    this.snapshot = this.createEmptyLobbySnapshot();
  }

  join(playerId: PlayerId, displayName: string): MatchState {
    this.lobbyPlayers.set(playerId, { id: playerId, displayName });

    if (this.snapshot.phase === "lobby") {
      this.snapshot = this.createLobbySnapshot(this.snapshot.mode);
    }

    return this.getSnapshot();
  }

  startMatch(modeId: MatchModeId): MatchState {
    const lobbyPlayers = this.getOrderedLobbyPlayers();
    if (lobbyPlayers.length === 0) {
      throw new Error("Cannot start match without players");
    }

    const mode = this.createMode(modeId);
    const generator = this.createMapGenerator(modeId);
    const playerIds = lobbyPlayers.map((player) => player.id);
    const teams = mode.buildTeams(lobbyPlayers);
    const teamIdsByPlayerId = this.teamIdsByPlayerId(teams);
    const map = generator.generate(this.mapSeed(playerIds), playerIds);
    const spawnsByPlayerId = new Map(map.spawns.map((spawn) => [spawn.playerId, spawn.position]));
    const players = lobbyPlayers.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      teamId: teamIdsByPlayerId.get(player.id) ?? "",
      position: spawnsByPlayerId.get(player.id) ?? lobbyPosition,
      hp: defaultMatchTuning.soldierHp,
      alive: true
    }));
    const turnOrder = mode.createTurnOrder(this.toTurnPlayers(players));

    this.snapshot = {
      phase: "playing",
      mode: mode.id,
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

  submitShot(playerId: PlayerId, functionFamilyId: FunctionFamilyId, expression: string): ServerEvent {
    if (this.snapshot.phase !== "playing") {
      return this.rejectShot(playerId, "Match is not playing");
    }

    if (this.snapshot.turn.activePlayerId !== playerId) {
      return this.rejectShot(playerId, "Player is not active");
    }

    const shooter = this.snapshot.players.find((player) => player.id === playerId);
    if (!shooter) {
      return this.rejectShot(playerId, "Shooter is missing");
    }

    let shot;
    try {
      shot = this.functionRegistry.create(functionFamilyId, expression);
    } catch (error) {
      return this.rejectShot(playerId, error instanceof Error ? error.message : "Invalid function expression");
    }

    const result = this.shotSimulator.simulate({
      shooter,
      players: this.snapshot.players,
      terrain: this.snapshot.terrain,
      shot
    });

    const nextTurn = this.nextTurn(result.players);
    this.snapshot = {
      ...this.snapshot,
      players: result.players,
      terrain: result.terrain,
      turn: nextTurn
    };

    const mode = this.createMode(this.snapshot.mode);
    const victory = mode.isVictory(this.toTurnPlayers(this.snapshot.players));
    if (victory.ended) {
      this.snapshot = { ...this.snapshot, phase: "ended" };
      return { type: "match-ended", roomId: this.roomId, winnerIds: victory.winnerIds, snapshot: this.getSnapshot() };
    }

    return {
      type: "shot-resolved",
      roomId: this.roomId,
      shooterId: playerId,
      functionFamilyId,
      expression,
      path: result.path,
      impact: result.impact,
      terrain: result.terrain,
      damage: result.damage,
      eliminations: result.eliminations,
      snapshot: this.getSnapshot()
    };
  }

  forcePlayerHpForTest(playerId: PlayerId, hp: number): void {
    const nextHp = Math.max(0, hp);
    this.snapshot = {
      ...this.snapshot,
      players: this.snapshot.players.map((player) =>
        player.id === playerId ? { ...player, hp: nextHp, alive: nextHp > 0 } : player
      )
    };
  }

  getSnapshot(): MatchState {
    return this.snapshot;
  }

  private createEmptyLobbySnapshot(): MatchState {
    return {
      phase: "lobby",
      mode: "team-versus",
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
      players: lobbyPlayers.map((player) => ({
        id: player.id,
        displayName: player.displayName,
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
    const mode = this.createMode(this.snapshot.mode);
    const livingOrder = mode.createTurnOrder(this.toTurnPlayers(players));
    if (livingOrder.length === 0) {
      return {
        activePlayerId: "",
        order: [],
        turnNumber: this.snapshot.turn.turnNumber + 1
      };
    }

    const currentIndex = livingOrder.indexOf(this.snapshot.turn.activePlayerId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % livingOrder.length;

    return {
      activePlayerId: livingOrder[nextIndex],
      order: livingOrder,
      turnNumber: this.snapshot.turn.turnNumber + 1
    };
  }

  private rejectShot(playerId: PlayerId, reason: string): ServerEvent {
    return { type: "shot-rejected", roomId: this.roomId, playerId, reason };
  }

  private getOrderedLobbyPlayers(): LobbyPlayer[] {
    return Array.from(this.lobbyPlayers.values());
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
