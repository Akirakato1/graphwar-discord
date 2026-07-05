import type {
  AimDirectionId,
  FunctionFamilyId,
  MatchModeId,
  PlayerId,
  RoomId,
  TeamId
} from "../state/types";
import type { DiscordUserId, GuildId, LobbyPlacementId, LobbySlot } from "../lobby/types";

export type JoinRoomCommand = {
  type: "join-room";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  discordUserId?: DiscordUserId;
  alias?: string;
  displayName: string;
  slot?: LobbySlot;
};
export type SelectModeCommand = {
  type: "select-mode";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  mode: MatchModeId;
};
export type SetTeamCommand = {
  type: "set-team";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  targetPlayerId?: PlayerId;
  placement?: LobbyPlacementId;
  teamId?: TeamId;
};
export type AutoAssignTeamsCommand = {
  type: "auto-assign-teams";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
};
export type StartMatchCommand = { type: "start-match"; guildId?: GuildId; roomId: RoomId; playerId: PlayerId };
export type SubmitShotCommand = {
  type: "submit-shot";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  functionFamilyId: FunctionFamilyId;
  aimDirection: AimDirectionId;
  expression: string;
};
export type SendChatCommand = { type: "send-chat"; guildId?: GuildId; roomId: RoomId; playerId: PlayerId; message: string };
export type RequestRematchCommand = { type: "request-rematch"; guildId?: GuildId; roomId: RoomId; playerId: PlayerId };

export type ClientCommand =
  | JoinRoomCommand
  | SelectModeCommand
  | SetTeamCommand
  | AutoAssignTeamsCommand
  | StartMatchCommand
  | SubmitShotCommand
  | SendChatCommand
  | RequestRematchCommand;
