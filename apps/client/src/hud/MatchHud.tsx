import { useState } from "react";
import type { AimDirectionId, MatchSnapshot } from "@graphwar/shared";
import type { ConnectionStatus, CommandRejection } from "../app/useGameStore";
import { DirectionDial } from "../input/DirectionDial";
import { FunctionInput } from "../input/FunctionInput";
import type { ClientSession } from "../sessions/localSession";

type MatchHudProps = {
  advancedFunctionsEnabled?: boolean;
  connectionStatus: ConnectionStatus;
  displaySnapshot?: MatchSnapshot;
  lastError?: string;
  lastRejection?: CommandRejection;
  onSubmitShot: (expression: string, aimDirection: AimDirectionId) => void;
  playbackInProgress?: boolean;
  session: ClientSession;
  snapshot?: MatchSnapshot;
  spectator?: boolean;
};

function phaseLabel(snapshot: MatchSnapshot | undefined): string {
  if (!snapshot) {
    return "Waiting for room snapshot";
  }

  if (snapshot.phase === "lobby") {
    return `Lobby open in ${snapshot.mode}`;
  }

  if (snapshot.phase === "ended") {
    return "Match ended";
  }

  return `Turn ${snapshot.turn.turnNumber}`;
}

export function MatchHud({
  advancedFunctionsEnabled = false,
  connectionStatus,
  displaySnapshot,
  lastError,
  lastRejection,
  onSubmitShot,
  playbackInProgress = false,
  session,
  snapshot,
  spectator = false
}: MatchHudProps) {
  const [aimDirection, setAimDirection] = useState<AimDirectionId>("east");
  const activePlayer = snapshot?.players.find((player) => player.id === snapshot.turn.activePlayerId);
  const localPlayer = snapshot?.players.find((player) => player.id === session.playerId);
  const displayLocalPlayer = displaySnapshot?.players.find((player) => player.id === session.playerId) ?? localPlayer;
  const isPlaying = snapshot?.phase === "playing";
  const isMyTurn = isPlaying && snapshot.turn.activePlayerId === session.playerId;
  const canSubmitShot = connectionStatus === "open" && isMyTurn && !playbackInProgress;
  const notice = lastError ?? lastRejection?.reason;

  if (isPlaying && spectator) {
    return (
      <section className="panel match-hud compact-match-hud spectator-hud" aria-labelledby="match-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Spectating</p>
            <h2 id="match-title">{activePlayer ? `${activePlayer.displayName}'s Turn` : "No Active Turn"}</h2>
          </div>
          <span className="turn-badge" data-testid="active-turn">
            {activePlayer ? `${activePlayer.displayName}'s Turn` : "No Active Turn"}
          </span>
        </div>
      </section>
    );
  }

  if (isPlaying) {
    return (
      <section className="panel match-hud compact-match-hud" aria-labelledby="match-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Turn {snapshot.turn.turnNumber}</p>
            <h2 id="match-title">{activePlayer ? `${activePlayer.displayName}'s Turn` : "No Active Turn"}</h2>
          </div>
          <span className={isMyTurn ? "turn-badge active-turn" : "turn-badge"} data-testid="active-turn">
            {isMyTurn ? "Your Turn" : activePlayer ? `${activePlayer.displayName}'s Turn` : "No Active Turn"}
          </span>
        </div>

        <div className="play-control-strip">
          <div className="own-hp" data-testid="own-hp">
            <span>HP</span>
            <strong>{displayLocalPlayer ? `${displayLocalPlayer.hp} HP` : "-- HP"}</strong>
          </div>
          <DirectionDial disabled={!isMyTurn || playbackInProgress} onChange={setAimDirection} value={aimDirection} />
        </div>

        <FunctionInput
          advancedFunctionsEnabled={advancedFunctionsEnabled}
          canSubmit={canSubmitShot}
          disabled={!isMyTurn || playbackInProgress}
          onSubmitShot={(expression) => onSubmitShot(expression, aimDirection)}
        />

        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel match-hud" aria-labelledby="match-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Status</p>
          <h2 id="match-title">{phaseLabel(snapshot)}</h2>
        </div>
        <span className={isMyTurn ? "turn-badge active-turn" : "turn-badge"} data-testid="active-turn">
          {isMyTurn ? "Your Turn" : activePlayer ? `${activePlayer.displayName}'s Turn` : "No Active Turn"}
        </span>
      </div>

      <dl className="status-grid">
        <div>
          <dt>Phase</dt>
          <dd>{snapshot?.phase ?? "loading"}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{snapshot?.mode ?? "unknown"}</dd>
        </div>
        <div>
          <dt>Active Player</dt>
          <dd>{activePlayer?.displayName ?? "none"}</dd>
        </div>
      </dl>

      <p className="muted">Shot input appears once the match is playing.</p>

      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </section>
  );
}
