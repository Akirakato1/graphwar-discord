import type { AimDirectionId, FunctionFamilyId, MatchModeId, PlayerId, RoomId, TeamId } from "../state/types";

export type JoinRoomCommand = { type: "join-room"; roomId: RoomId; playerId: PlayerId; displayName: string };
export type SelectModeCommand = { type: "select-mode"; roomId: RoomId; playerId: PlayerId; mode: MatchModeId };
export type SetTeamCommand = { type: "set-team"; roomId: RoomId; playerId: PlayerId; teamId: TeamId };
export type StartMatchCommand = { type: "start-match"; roomId: RoomId; playerId: PlayerId };
export type SubmitShotCommand = {
  type: "submit-shot";
  roomId: RoomId;
  playerId: PlayerId;
  functionFamilyId: FunctionFamilyId;
  aimDirection: AimDirectionId;
  expression: string;
};
export type SendChatCommand = { type: "send-chat"; roomId: RoomId; playerId: PlayerId; message: string };
export type RequestRematchCommand = { type: "request-rematch"; roomId: RoomId; playerId: PlayerId };

export type ClientCommand =
  | JoinRoomCommand
  | SelectModeCommand
  | SetTeamCommand
  | StartMatchCommand
  | SubmitShotCommand
  | SendChatCommand
  | RequestRematchCommand;
