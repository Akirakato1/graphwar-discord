import type { LobbyPlacementId, LobbyRuntimeSnapshot } from "@graphwar/shared";

type LobbySetupViewProps = {
  currentDiscordUserId?: string;
  currentPlayerId: string;
  lobby: LobbyRuntimeSnapshot;
  onAutoAssign: () => void;
  onBack: () => void;
  onCancelLobby?: () => void;
  onMove: (targetPlayerId: string, placement: LobbyPlacementId) => void;
  onStart: () => void;
};

function occupantsFor(lobby: LobbyRuntimeSnapshot, placement: LobbyPlacementId) {
  return lobby.occupants.filter((occupant) => occupant.placement === placement);
}

const groupActionLabels: Record<LobbyPlacementId, string> = {
  "team-a": "Join A",
  "team-b": "Join B",
  players: "Join Players",
  spectator: "Join Spectator"
};

function inputModeLabel(inputMode: LobbyRuntimeSnapshot["inputMode"]): string {
  return inputMode === "hybrid" ? "Hybrid" : inputMode === "keypad" ? "Keypad" : "Keyboard";
}

type GroupMoveActionInput = {
  currentPlacement?: LobbyPlacementId;
  currentPlayerId?: string;
  isLeader: boolean;
  targetPlacement: LobbyPlacementId;
};

export function groupMoveAction({
  currentPlacement,
  currentPlayerId,
  targetPlacement
}: GroupMoveActionInput):
  | { label: string; targetPlayerId: string; placement: LobbyPlacementId; disabled: boolean }
  | undefined {
  if (!currentPlayerId) {
    return undefined;
  }

  return {
    label: groupActionLabels[targetPlacement],
    targetPlayerId: currentPlayerId,
    placement: targetPlacement,
    disabled: currentPlacement === targetPlacement
  };
}

export function shouldConfirmLobbyCancellation({
  currentDiscordUserId,
  currentPlayerId,
  lobby
}: {
  currentDiscordUserId?: string;
  currentPlayerId: string;
  lobby: LobbyRuntimeSnapshot;
}): boolean {
  if (lobby.status !== "open") {
    return false;
  }

  const currentOccupant = lobby.occupants.find(
    (occupant) => occupant.playerId === currentPlayerId || occupant.discordUserId === currentDiscordUserId
  );

  return currentOccupant?.isLeader ?? lobby.leaderDiscordUserId === currentDiscordUserId;
}

export function LobbySetupView({
  currentDiscordUserId,
  currentPlayerId,
  lobby,
  onAutoAssign,
  onBack,
  onCancelLobby,
  onMove,
  onStart
}: LobbySetupViewProps) {
  const currentOccupant = lobby.occupants.find(
    (occupant) => occupant.playerId === currentPlayerId || occupant.discordUserId === currentDiscordUserId
  );
  const isLeader = currentOccupant?.isLeader ?? lobby.leaderDiscordUserId === currentDiscordUserId;
  const currentOccupantPlayerId = currentOccupant?.playerId ?? currentPlayerId;
  const currentPlacement = currentOccupant?.placement;
  const canMoveCurrentOccupant = Boolean(currentOccupant) && (isLeader || currentOccupant?.playerId === currentOccupantPlayerId);
  const backDeletesLobby = shouldConfirmLobbyCancellation({ currentDiscordUserId, currentPlayerId, lobby });
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
  const handleBack = () => {
    if (!backDeletesLobby) {
      onBack();
      return;
    }

    const confirmed =
      typeof window !== "undefined"
        ? window.confirm("Leaving will delete this lobby for everyone. Return to main menu and delete lobby?")
        : false;

    if (confirmed) {
      onCancelLobby?.();
    }
  };

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
          <button className="secondary-action" onClick={handleBack} type="button">
            Main Menu
          </button>
        </div>
      </div>

      <div className="rules-summary" aria-label="Match rules">
        <span>Damage {lobby.damagePerHit}</span>
        <span>Crater {lobby.craterRadius}</span>
        <span>Unique hits {lobby.uniqueFunctionHits ? "On" : "Off"}</span>
        <span>Advanced functions {lobby.advancedFunctions ? "On" : "Off"}</span>
        <span>Preview {lobby.functionPreview ? "On" : "Off"}</span>
        <span>History {lobby.functionHistory ? "On" : "Off"}</span>
        <span>Timer {lobby.turnTimerEnabled ? `${lobby.turnDurationSeconds}s` : "Off"}</span>
        <span>Input {inputModeLabel(lobby.inputMode)}</span>
        {lobby.mode === "team-versus" ? <span>Friendly fire {lobby.friendlyFire ? "On" : "Off"}</span> : null}
      </div>

      <div className="setup-grid">
        {boxes.map((box) => (
          <section className="setup-column" key={box.placement} aria-label={box.title}>
            <div className="setup-column-header">
              <h2>{box.title}</h2>
              {(() => {
                const action = groupMoveAction({
                  currentPlacement,
                  currentPlayerId: currentOccupantPlayerId,
                  isLeader,
                  targetPlacement: box.placement
                });

                return action ? (
                  <button
                    className="setup-group-join"
                    disabled={!canMoveCurrentOccupant || action.disabled}
                    onClick={() => onMove(action.targetPlayerId, action.placement)}
                    type="button"
                  >
                    {action.label}
                  </button>
                ) : null;
              })()}
            </div>
            <ul className="roster-list">
              {occupantsFor(lobby, box.placement).map((occupant) => (
                <li key={occupant.discordUserId} data-testid={`setup-player-${occupant.playerId}`}>
                  <span
                    className="player-name setup-player-name"
                    style={{ color: (occupant as typeof occupant & { color?: string }).color }}
                  >
                    {occupant.isLeader ? (
                      <span aria-label="Lobby leader" className="leader-crown" role="img">
                        ♛
                      </span>
                    ) : null}
                    {occupant.alias}
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
