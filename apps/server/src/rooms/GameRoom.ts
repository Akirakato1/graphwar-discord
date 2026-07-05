import type { ClientCommand, RoomId, ServerEvent } from "@graphwar/shared";
import WebSocket from "ws";
import { MatchController } from "../match/MatchController";

export class GameRoom {
  readonly clients = new Set<WebSocket>();
  private readonly match: MatchController;

  constructor(
    private readonly roomId: RoomId,
    private readonly onEmpty: () => void = () => {}
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
    this.sendTo(socket, { type: "room-snapshot", roomId: this.roomId, snapshot: this.match.getSnapshot() });
  }

  isEmpty(): boolean {
    return this.clients.size === 0;
  }

  handleCommand(socket: WebSocket, command: ClientCommand): void {
    if (command.roomId !== this.roomId) {
      this.sendRejection(socket, command.playerId, `Room mismatch: expected ${this.roomId}, received ${command.roomId}`);
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
          this.sendRejection(socket, command.playerId, `Unsupported command: ${command.type}`);
          return;
      }
    } catch (error) {
      this.sendRejection(socket, command.playerId, error instanceof Error ? error.message : "Command failed");
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
