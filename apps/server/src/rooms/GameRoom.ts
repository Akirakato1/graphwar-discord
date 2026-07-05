import type {
  ClientCommand,
  LobbyPlacementId,
  MatchSnapshot,
  RoomId,
  ServerEvent,
  SubmitShotCommand
} from "@graphwar/shared";
import WebSocket from "ws";
import { LobbyDirectory } from "../lobbies/LobbyDirectory";
import { MatchController } from "../match/MatchController";
import { LocalStateStore } from "../persistence/LocalStateStore";

type LobbyContext = {
  guildId: string;
  lobbies: LobbyDirectory;
  stateStore: LocalStateStore;
};

export class GameRoom {
  readonly clients = new Set<WebSocket>();
  private commandQueue: Promise<void> = Promise.resolve();
  private readonly match: MatchController;

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
        const snapshot = this.match.join(command.playerId, command.displayName);
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
        await context.lobbies.joinLobby(context.guildId, this.roomId, {
          discordUserId: command.discordUserId ?? command.playerId,
          alias: command.alias ?? command.displayName,
          slot: command.slot ?? "player"
        });
        this.syncLobbySnapshot();
        this.broadcast({ type: "player-joined", roomId: this.roomId, playerId: command.playerId });
        this.broadcastRoomSnapshot();
        return;
      }
      case "set-team": {
        const placement = this.resolveLobbyPlacement(command.placement, command.teamId);
        if (!placement) {
          this.sendRejection(socket, command.playerId, "set-team requires a valid lobby placement.");
          return;
        }
        context.lobbies.moveOccupant(
          context.guildId,
          this.roomId,
          command.playerId,
          command.targetPlayerId ?? command.playerId,
          placement
        );
        this.syncLobbySnapshot();
        this.broadcastRoomSnapshot();
        return;
      }
      case "auto-assign-teams": {
        context.lobbies.autoAssignTeams(context.guildId, this.roomId, command.playerId);
        this.syncLobbySnapshot();
        this.broadcastRoomSnapshot();
        return;
      }
      case "start-match": {
        this.syncLobbySnapshot();
        context.lobbies.assertCanStart(context.guildId, this.roomId, command.playerId);
        const lobby = context.lobbies.markPlaying(context.guildId, this.roomId);
        const snapshot = this.match.startMatch(lobby.mode);
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
        if (this.isSpectator(command.playerId)) {
          this.sendRejection(socket, command.playerId, "Spectators cannot submit shots.");
          return;
        }
        await this.handleSubmitShot(socket, command);
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
    return {
      type: "room-snapshot",
      guildId: this.lobbyContext.guildId,
      roomId: this.roomId,
      lobby,
      snapshot: this.match.getSnapshot()
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
        teamId: occupant.placement === "team-a" || occupant.placement === "team-b" ? occupant.placement : undefined
      }));
    return this.match.setLobbyPlayers(lobby.mode, players);
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
    const event = this.match.submitShot(
      command.playerId,
      command.functionFamilyId,
      command.expression,
      command.aimDirection
    );
    if (event.type === "shot-rejected") {
      this.sendTo(socket, event);
      return;
    }

    this.broadcast(this.withResolvedLobbyContext(event));
    if (event.type === "match-ended" && this.lobbyContext) {
      await this.recordMatchResult(event.winnerIds, event.snapshot.players.map((player) => player.id));
    }

    if (event.type === "shot-resolved") {
      this.broadcast({
        type: "turn-advanced",
        roomId: this.roomId,
        playerId: event.snapshot.turn.activePlayerId,
        turnNumber: event.snapshot.turn.turnNumber
      });
    }
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

  private removeClient(socket: WebSocket): void {
    const removed = this.clients.delete(socket);
    if (removed && this.isEmpty()) {
      this.onEmpty();
    }
  }

  private sendRejection(socket: WebSocket, playerId: string, reason: string): void {
    this.sendTo(socket, { type: "shot-rejected", roomId: this.roomId, playerId, reason });
  }
}
