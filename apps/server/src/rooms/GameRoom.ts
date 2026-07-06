import type {
  ClientCommand,
  LobbyPlacementId,
  MatchSnapshot,
  RoomId,
  ServerEvent,
  SubmitShotCommand
} from "@graphwar/shared";
import WebSocket from "ws";
import { LobbyDirectory, type LobbySessionIdentity } from "../lobbies/LobbyDirectory";
import { CustomMapSpawner } from "../maps/CustomMapSpawner";
import { MatchController } from "../match/MatchController";
import { LocalStateStore } from "../persistence/LocalStateStore";

type LobbyContext = {
  guildId: string;
  lobbies: LobbyDirectory;
  stateStore: LocalStateStore;
};

export class GameRoom {
  readonly clients = new Set<WebSocket>();
  private readonly lobbySessions = new WeakMap<WebSocket, LobbySessionIdentity>();
  private commandQueue: Promise<void> = Promise.resolve();
  private readonly match: MatchController;
  private readonly customMapSpawner = new CustomMapSpawner();

  constructor(
    private readonly roomId: RoomId,
    private readonly onEmpty: () => void = () => {},
    private readonly lobbyContext?: LobbyContext
  ) {
    this.match = new MatchController(roomId);
  }

  addClient(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on("close", () => {
      this.removeClient(socket);
    });
    socket.on("error", () => {
      this.removeClient(socket);
    });
    try {
      this.sendTo(socket, this.createRoomSnapshotEvent());
    } catch (error) {
      this.sendRejection(socket, "unknown", error instanceof Error ? error.message : "Room snapshot failed");
    }
  }

  isEmpty(): boolean {
    return this.clients.size === 0;
  }

  shouldRetainWhenEmpty(): boolean {
    if (!this.lobbyContext) {
      return false;
    }

    try {
      return this.lobbyContext.lobbies.getLobby(this.lobbyContext.guildId, this.roomId).status === "playing";
    } catch {
      return false;
    }
  }

  enqueueCommand(socket: WebSocket, command: ClientCommand): Promise<void> {
    const next = this.commandQueue.then(
      () => this.handleCommand(socket, command),
      () => this.handleCommand(socket, command)
    );
    this.commandQueue = next.catch(() => undefined);
    return next;
  }

  async handleCommand(socket: WebSocket, command: ClientCommand): Promise<void> {
    if (command.roomId !== this.roomId) {
      this.sendRejection(socket, command.playerId, `Room mismatch: expected ${this.roomId}, received ${command.roomId}`);
      return;
    }

    if (this.lobbyContext && command.guildId && command.guildId !== this.lobbyContext.guildId) {
      this.sendRejection(
        socket,
        command.playerId,
        `Guild mismatch: expected ${this.lobbyContext.guildId}, received ${command.guildId}`
      );
      return;
    }

    try {
      if (this.lobbyContext) {
        await this.handleLobbyCommand(socket, command);
        return;
      }

      await this.handleLegacyCommand(socket, command);
    } catch (error) {
      this.sendRejection(socket, command.playerId, error instanceof Error ? error.message : "Command failed");
    }
  }

  private async handleLegacyCommand(socket: WebSocket, command: ClientCommand): Promise<void> {
    switch (command.type) {
      case "join-room": {
        const snapshot = this.match.join(command.playerId, command.displayName, undefined, command.avatarUrl);
        this.broadcast({ type: "player-joined", roomId: this.roomId, playerId: command.playerId });
        this.broadcast({ type: "room-snapshot", roomId: this.roomId, snapshot });
        return;
      }
      case "select-mode": {
        const snapshot = this.match.selectMode(command.mode);
        this.broadcast({ type: "room-snapshot", roomId: this.roomId, snapshot });
        return;
      }
      case "start-match": {
        const snapshot = this.match.startMatch(this.match.getSnapshot().mode);
        this.broadcast({ type: "match-started", roomId: this.roomId, snapshot });
        this.broadcast({
          type: "turn-started",
          roomId: this.roomId,
          playerId: snapshot.turn.activePlayerId,
          turnNumber: snapshot.turn.turnNumber
        });
        return;
      }
      case "submit-shot": {
        await this.handleSubmitShot(socket, command);
        return;
      }
      case "set-team":
      case "auto-assign-teams":
      case "send-chat":
      case "request-rematch":
        this.sendRejection(socket, command.playerId, `Unsupported command: ${command.type}`);
        return;
    }
  }

  private async handleLobbyCommand(socket: WebSocket, command: ClientCommand): Promise<void> {
    const context = this.requireLobbyContext();

    switch (command.type) {
      case "join-room": {
        const session = context.lobbies.validateSession(context.guildId, this.roomId, command.sessionToken);
        if (
          command.playerId !== session.playerId ||
          (command.discordUserId !== undefined && command.discordUserId !== session.discordUserId)
        ) {
          this.sendRejection(socket, command.playerId, "Command actor does not match socket session.");
          return;
        }
        context.lobbies.markConnected(context.guildId, this.roomId, session.sessionToken);
        this.lobbySessions.set(socket, session);
        this.syncLobbySnapshot();
        this.broadcast({ type: "player-joined", roomId: this.roomId, playerId: session.playerId });
        this.broadcastRoomSnapshot();
        return;
      }
      case "set-team": {
        const session = this.requireLobbySession(socket, command);
        if (!session) {
          return;
        }
        const placement = this.resolveLobbyPlacement(command.placement, command.teamId);
        if (!placement) {
          this.sendRejection(socket, command.playerId, "set-team requires a valid lobby placement.");
          return;
        }
        context.lobbies.moveOccupant(
          context.guildId,
          this.roomId,
          session.discordUserId,
          command.targetPlayerId ?? session.discordUserId,
          placement
        );
        this.syncLobbySnapshot();
        this.broadcastRoomSnapshot();
        return;
      }
      case "auto-assign-teams": {
        const session = this.requireLobbySession(socket, command);
        if (!session) {
          return;
        }
        context.lobbies.autoAssignTeams(context.guildId, this.roomId, session.discordUserId);
        this.syncLobbySnapshot();
        this.broadcastRoomSnapshot();
        return;
      }
      case "start-match": {
        const session = this.requireLobbySession(socket, command);
        if (!session) {
          return;
        }
        this.syncLobbySnapshot();
        context.lobbies.assertCanStart(context.guildId, this.roomId, session.discordUserId);
        const openLobby = context.lobbies.getLobby(context.guildId, this.roomId);
        const generatedMap = openLobby.mapId
          ? this.customMapSpawner.generate(
              openLobby.mode,
              await this.loadCustomMap(context, openLobby.mapId),
              openLobby.occupants
                .filter((occupant) => occupant.slot === "player")
                .map((occupant) => ({ playerId: occupant.playerId, placement: occupant.placement }))
            )
          : undefined;
        const lobby = context.lobbies.markPlaying(context.guildId, this.roomId);
        const snapshot = this.match.startMatch(lobby.mode, generatedMap, {
          maxFunctionLength: lobby.maxFunctionLength,
          mapSizePreset: openLobby.mapId ? undefined : lobby.mapSizePreset,
          damagePerHit: lobby.damagePerHit,
          uniqueFunctionHits: lobby.uniqueFunctionHits,
          friendlyFire: lobby.friendlyFire
        });
        this.broadcast({ type: "match-started", guildId: context.guildId, roomId: this.roomId, lobby, snapshot });
        this.broadcast({
          type: "turn-started",
          roomId: this.roomId,
          playerId: snapshot.turn.activePlayerId,
          turnNumber: snapshot.turn.turnNumber
        });
        return;
      }
      case "submit-shot": {
        const session = this.requireLobbySession(socket, command);
        if (!session) {
          return;
        }
        if (this.isSpectator(session.playerId)) {
          this.sendRejection(socket, command.playerId, "Spectators cannot submit shots.");
          return;
        }
        await this.handleSubmitShot(socket, { ...command, playerId: session.playerId });
        return;
      }
      case "select-mode":
      case "send-chat":
      case "request-rematch":
        this.sendRejection(socket, command.playerId, `Unsupported command: ${command.type}`);
        return;
    }
  }

  broadcast(event: ServerEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  sendTo(socket: WebSocket, event: ServerEvent): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }

  private createRoomSnapshotEvent(): ServerEvent {
    if (!this.lobbyContext) {
      return { type: "room-snapshot", roomId: this.roomId, snapshot: this.match.getSnapshot() };
    }

    const lobby = this.lobbyContext.lobbies.getLobby(this.lobbyContext.guildId, this.roomId);
    const snapshot = this.syncLobbySnapshot();
    return {
      type: "room-snapshot",
      guildId: this.lobbyContext.guildId,
      roomId: this.roomId,
      lobby,
      snapshot
    };
  }

  private syncLobbySnapshot(): MatchSnapshot {
    const context = this.requireLobbyContext();
    const current = this.match.getSnapshot();
    if (current.phase !== "lobby") {
      return current;
    }

    const lobby = context.lobbies.getLobby(context.guildId, this.roomId);
    const players = lobby.occupants
      .filter((occupant) => occupant.slot === "player")
      .map((occupant) => ({
        id: occupant.playerId,
        displayName: occupant.alias,
        avatarUrl: occupant.avatarUrl,
        color: occupant.color,
        teamId: occupant.placement === "team-a" || occupant.placement === "team-b" ? occupant.placement : undefined
      }));
    return this.match.setLobbyPlayers(lobby.mode, players, {
      mapSizePreset: lobby.mapId ? undefined : lobby.mapSizePreset
    });
  }

  private broadcastRoomSnapshot(): void {
    this.broadcast(this.createRoomSnapshotEvent());
  }

  private isSpectator(playerId: string): boolean {
    const context = this.requireLobbyContext();
    const lobby = context.lobbies.getLobby(context.guildId, this.roomId);
    return lobby.occupants.find((occupant) => occupant.playerId === playerId)?.slot === "spectator";
  }

  private async handleSubmitShot(socket: WebSocket, command: SubmitShotCommand): Promise<void> {
    const events = this.match.submitShot(
      command.playerId,
      command.functionFamilyId,
      command.expression,
      command.aimDirection
    );
    const firstEvent = events[0];
    if (firstEvent.type === "shot-rejected") {
      this.sendTo(socket, firstEvent);
      return;
    }

    this.broadcast(this.withResolvedLobbyContext(firstEvent));

    const matchEnded = events[1];
    if (matchEnded) {
      this.broadcast(this.withResolvedLobbyContext(matchEnded));
      if (this.lobbyContext) {
        await this.recordMatchResult(matchEnded.winnerIds, matchEnded.snapshot.players.map((player) => player.id));
      }
      return;
    }

    this.broadcast({
      type: "turn-advanced",
      roomId: this.roomId,
      playerId: firstEvent.snapshot.turn.activePlayerId,
      turnNumber: firstEvent.snapshot.turn.turnNumber
    });
  }

  private withLobbyContext(event: ServerEvent): ServerEvent {
    if (!this.lobbyContext) {
      return event;
    }

    if (
      event.type === "room-snapshot" ||
      event.type === "match-started" ||
      event.type === "shot-resolved" ||
      event.type === "match-ended"
    ) {
      return {
        ...event,
        guildId: this.lobbyContext.guildId,
        lobby: this.lobbyContext.lobbies.getLobby(this.lobbyContext.guildId, this.roomId)
      };
    }

    return event;
  }

  private withResolvedLobbyContext(event: ServerEvent): ServerEvent {
    if (event.type === "match-ended" && this.lobbyContext) {
      const lobby = this.lobbyContext.lobbies.markEnded(this.lobbyContext.guildId, this.roomId);
      return { ...event, guildId: this.lobbyContext.guildId, lobby };
    }

    return this.withLobbyContext(event);
  }

  private async recordMatchResult(winnerIds: string[], participantIds: string[]): Promise<void> {
    if (!this.lobbyContext) {
      return;
    }

    try {
      await this.lobbyContext.stateStore.recordMatchResult(this.lobbyContext.guildId, winnerIds, participantIds);
    } catch {
      // Match resolution is authoritative; leaderboard persistence must not hide the completed match from clients.
    }
  }

  private async loadCustomMap(context: LobbyContext, mapId: string) {
    const map = await context.stateStore.getCustomMap(context.guildId, mapId);
    if (!map) {
      throw new Error("Custom map not found.");
    }
    return map;
  }

  private resolveLobbyPlacement(
    placement: LobbyPlacementId | undefined,
    teamId: string | undefined
  ): LobbyPlacementId | undefined {
    if (placement) {
      return placement;
    }

    if (teamId === "team-a" || teamId === "team-b") {
      return teamId;
    }

    return undefined;
  }

  private requireLobbyContext(): LobbyContext {
    if (!this.lobbyContext) {
      throw new Error("Lobby context is not available.");
    }
    return this.lobbyContext;
  }

  private requireLobbySession(socket: WebSocket, command: ClientCommand): LobbySessionIdentity | undefined {
    const session = this.lobbySessions.get(socket);
    if (!session) {
      this.sendRejection(socket, command.playerId, "Join lobby before sending commands.");
      return undefined;
    }

    if (command.playerId !== session.playerId || (command.sessionToken && command.sessionToken !== session.sessionToken)) {
      this.sendRejection(socket, command.playerId, "Command actor does not match socket session.");
      return undefined;
    }

    return session;
  }

  private removeClient(socket: WebSocket): void {
    const session = this.lobbySessions.get(socket);
    if (session && this.lobbyContext) {
      this.lobbySessions.delete(socket);
      this.lobbyContext.lobbies.markDisconnected(this.lobbyContext.guildId, this.roomId, session.sessionToken);
      try {
        this.broadcastRoomSnapshot();
      } catch {
        // Disconnect snapshots are best-effort; room cleanup below still owns lifecycle.
      }
    }

    const removed = this.clients.delete(socket);
    if (removed && this.isEmpty()) {
      this.onEmpty();
    }
  }

  private sendRejection(socket: WebSocket, playerId: string, reason: string): void {
    this.sendTo(socket, { type: "shot-rejected", roomId: this.roomId, playerId, reason });
  }
}
