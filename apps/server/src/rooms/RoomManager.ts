import type { ClientCommand, RoomId } from "@graphwar/shared";
import type WebSocket from "ws";
import { LobbyDirectory } from "../lobbies/LobbyDirectory";
import { LocalStateStore } from "../persistence/LocalStateStore";
import { parseCommand } from "../protocol/parseCommand";
import { GameRoom } from "./GameRoom";

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  constructor(
    private readonly lobbies: LobbyDirectory = new LobbyDirectory(),
    private readonly stateStore: LocalStateStore = new LocalStateStore()
  ) {}

  connect(guildId: string, roomId: RoomId, socket: WebSocket): void {
    const room = this.getOrCreateRoom(guildId, roomId);
    room.addClient(socket);

    socket.on("message", (data) => {
      void this.handleMessage(roomId, room, socket, data);
    });
  }

  private async handleMessage(
    roomId: RoomId,
    room: GameRoom,
    socket: WebSocket,
    data: WebSocket.RawData
  ): Promise<void> {
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
      await room.enqueueCommand(socket, command);
    } catch (error) {
      room.sendTo(socket, {
        type: "shot-rejected",
        roomId,
        playerId: command.playerId,
        reason: error instanceof Error ? error.message : "Command failed"
      });
    }
  }

  private getOrCreateRoom(guildId: string, roomId: RoomId): GameRoom {
    const key = this.roomKey(guildId, roomId);
    const existing = this.rooms.get(key);
    if (existing) {
      return existing;
    }

    const room = new GameRoom(
      roomId,
      () => {
        if (this.rooms.get(key) === room && room.isEmpty()) {
          if (room.shouldRetainWhenEmpty()) {
            return;
          }
          this.rooms.delete(key);
        }
      },
      this.hasLobby(guildId, roomId) ? { guildId, lobbies: this.lobbies, stateStore: this.stateStore } : undefined
    );
    this.rooms.set(key, room);
    return room;
  }

  private roomKey(guildId: string, roomId: RoomId): string {
    return `${guildId}:${roomId}`;
  }

  private hasLobby(guildId: string, roomId: RoomId): boolean {
    try {
      this.lobbies.getLobby(guildId, roomId);
      return true;
    } catch {
      return false;
    }
  }
}
