export type PlayerSession = {
  playerId: string;
  displayName: string;
  roomId: string;
  source: "local" | "discord";
};
