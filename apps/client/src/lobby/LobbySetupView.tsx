import type { LobbyPlacementId, LobbyRuntimeSnapshot } from "@graphwar/shared";

type LobbySetupViewProps = {
  currentDiscordUserId?: string;
  currentPlayerId: string;
  lobby: LobbyRuntimeSnapshot;
  onAutoAssign: () => void;
  onBack: () => void;
  onMove: (targetPlayerId: string, placement: LobbyPlacementId) => void;
  onStart: () => void;
};

function occupantsFor(lobby: LobbyRuntimeSnapshot, placement: LobbyPlacementId) {
  return lobby.occupants.filter((occupant) => occupant.placement === placement);
}

export function LobbySetupView({
  currentDiscordUserId,
  currentPlayerId,
  lobby,
  onAutoAssign,
  onBack,
  onMove,
  onStart
}: LobbySetupViewProps) {
  const currentOccupant = lobby.occupants.find(
    (occupant) => occupant.playerId === currentPlayerId || occupant.discordUserId === currentDiscordUserId
  );
  const isLeader = currentOccupant?.isLeader ?? lobby.leaderDiscordUserId === currentDiscordUserId;
  const currentOccupantPlayerId = currentOccupant?.playerId ?? currentPlayerId;
  const canMove = (targetPlayerId: string) => isLeader || targetPlayerId === currentOccupantPlayerId;
  const boxes: Array<{ placement: LobbyPlacementId; title: string }> =
    lobby.mode === "team-versus"
      ? [
          { placement: "team-a", title: "Team A" },
          { placement: "team-b", title: "Team B" },
          { placement: "spectator", title: "Spectators" }
        ]
      : [
          { placement: "players", title: "Players" },
          { placement: "spectator", title: "Spectators" }
        ];

  return (
    <section className="lobby-setup-screen" aria-labelledby="lobby-setup-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{lobby.mode === "team-versus" ? "Team Versus" : "Free For All"}</p>
          <h1 id="lobby-setup-title">{lobby.name}</h1>
        </div>
        <div className="setup-actions">
          {lobby.mode === "team-versus" && isLeader && (
            <button type="button" onClick={onAutoAssign}>
              Auto Assign
            </button>
          )}
          <button className="primary-action" disabled={!isLeader || !lobby.canStart} onClick={onStart} type="button">
            Start Match
          </button>
          <button className="secondary-action" onClick={onBack} type="button">
            Main Menu
          </button>
        </div>
      </div>

      <div className="setup-grid">
        {boxes.map((box) => (
          <section className="setup-column" key={box.placement} aria-label={box.title}>
            <h2>{box.title}</h2>
            <ul className="roster-list">
              {occupantsFor(lobby, box.placement).map((occupant) => (
                <li key={occupant.discordUserId} data-testid={`setup-player-${occupant.playerId}`}>
                  <span className="player-name">
                    {occupant.alias}
                    {occupant.isLeader ? " Leader" : ""}
                  </span>
                  <span className="setup-move-actions">
                    {boxes
                      .filter((target) => target.placement !== box.placement)
                      .map((target) => (
                        <button
                          aria-label={`Move ${occupant.alias} to ${target.title}`}
                          disabled={!canMove(occupant.playerId)}
                          key={target.placement}
                          onClick={() => onMove(occupant.playerId, target.placement)}
                          type="button"
                        >
                          {target.title}
                        </button>
                      ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {lobby.startBlockedReason && (
        <div className="notice" role="status">
          {lobby.startBlockedReason}
        </div>
      )}
    </section>
  );
}
