import type { ClientCommand, RoomId } from "@graphwar/shared";
import type WebSocket from "ws";
import { parseCommand } from "../protocol/parseCommand";
import { GameRoom } from "./GameRoom";

export class RoomManager {
  private readonly rooms = new Map<RoomId, GameRoom>();

  connect(roomId: RoomId, socket: WebSocket): void {
    const room = this.getOrCreateRoom(roomId);
    room.addClient(socket);

    socket.on("message", (data) => {
      let command: ClientCommand;
      try {
        command = parseCommand(String(data));
      } catch (error) {
        room.sendTo(socket, {
          type: "shot-rejected",
          roomId,
          playerId: "unknown",
          reason: error instanceof Error ? error.message : "Invalid command"
        });
        return;
      }

      try {
        room.handleCommand(command);
      } catch (error) {
        room.sendTo(socket, {
          type: "shot-rejected",
          roomId,
          playerId: command.playerId,
          reason: error instanceof Error ? error.message : "Command failed"
        });
      }
    });
  }

  private getOrCreateRoom(roomId: RoomId): GameRoom {
    const existing = this.rooms.get(roomId);
    if (existing) {
      return existing;
    }

    const room = new GameRoom(roomId);
    this.rooms.set(roomId, room);
    return room;
  }
}
