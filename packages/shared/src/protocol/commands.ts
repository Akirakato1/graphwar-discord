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
  avatarUrl?: string;
  displayName: string;
  slot?: LobbySlot;
  sessionToken?: string;
};
export type SelectModeCommand = {
  type: "select-mode";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  mode: MatchModeId;
  sessionToken?: string;
};
export type SetTeamCommand = {
  type: "set-team";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  targetPlayerId?: PlayerId;
  placement?: LobbyPlacementId;
  teamId?: TeamId;
  sessionToken?: string;
};
export type AutoAssignTeamsCommand = {
  type: "auto-assign-teams";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  sessionToken?: string;
};
export type CancelLobbyCommand = {
  type: "cancel-lobby";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  sessionToken?: string;
};
export type StartMatchCommand = {
  type: "start-match";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  sessionToken?: string;
};
export type SubmitShotCommand = {
  type: "submit-shot";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  functionFamilyId: FunctionFamilyId;
  aimDirection: AimDirectionId;
  expression: string;
  sessionToken?: string;
};
export type SendChatCommand = {
  type: "send-chat";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  message: string;
  sessionToken?: string;
};
export type RequestRematchCommand = {
  type: "request-rematch";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  sessionToken?: string;
};

export type ClientCommand =
  | JoinRoomCommand
  | SelectModeCommand
  | SetTeamCommand
  | AutoAssignTeamsCommand
  | CancelLobbyCommand
  | StartMatchCommand
  | SubmitShotCommand
  | SendChatCommand
  | RequestRematchCommand;
