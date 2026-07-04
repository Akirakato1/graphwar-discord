import type { ClientCommand, RoomId, ServerEvent } from "@graphwar/shared";
import WebSocket from "ws";
import { MatchController } from "../match/MatchController";

export class GameRoom {
  readonly clients = new Set<WebSocket>();
  private readonly match: MatchController;

  constructor(private readonly roomId: RoomId) {
    this.match = new MatchController(roomId);
  }

  addClient(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on("close", () => {
      this.clients.delete(socket);
    });
    socket.on("error", () => {
      this.clients.delete(socket);
    });
    this.sendTo(socket, { type: "room-snapshot", roomId: this.roomId, snapshot: this.match.getSnapshot() });
  }

  handleCommand(command: ClientCommand): void {
    if (command.roomId !== this.roomId) {
      this.broadcastRejection(
        command.playerId,
        `Room mismatch: expected ${this.roomId}, received ${command.roomId}`
      );
      return;
    }

    try {
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
          const event = this.match.submitShot(command.playerId, command.functionFamilyId, command.expression);
          this.broadcast(event);
          if (event.type === "shot-resolved") {
            this.broadcast({
              type: "turn-advanced",
              roomId: this.roomId,
              playerId: event.snapshot.turn.activePlayerId,
              turnNumber: event.snapshot.turn.turnNumber
            });
          }
          return;
        }
        case "set-team":
        case "send-chat":
        case "request-rematch":
          this.broadcastRejection(command.playerId, `Unsupported command: ${command.type}`);
          return;
      }
    } catch (error) {
      this.broadcastRejection(command.playerId, error instanceof Error ? error.message : "Command failed");
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

  private broadcastRejection(playerId: string, reason: string): void {
    this.broadcast({ type: "shot-rejected", roomId: this.roomId, playerId, reason });
  }
}
