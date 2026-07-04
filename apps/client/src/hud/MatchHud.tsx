import { useState, type FormEvent } from "react";
import type { MatchSnapshot } from "@graphwar/shared";
import type { ConnectionStatus, CommandRejection } from "../app/useGameStore";
import type { ClientSession } from "../sessions/localSession";

type MatchHudProps = {
  connectionStatus: ConnectionStatus;
  lastError?: string;
  lastRejection?: CommandRejection;
  onSubmitShot: (expression: string) => void;
  session: ClientSession;
  snapshot?: MatchSnapshot;
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

export function MatchHud({ connectionStatus, lastError, lastRejection, onSubmitShot, session, snapshot }: MatchHudProps) {
  const [expression, setExpression] = useState("sin(x)");
  const activePlayer = snapshot?.players.find((player) => player.id === snapshot.turn.activePlayerId);
  const isPlaying = snapshot?.phase === "playing";
  const isMyTurn = isPlaying && snapshot.turn.activePlayerId === session.playerId;
  const canSubmitShot = connectionStatus === "open" && isMyTurn && expression.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmitShot(expression);
  }

  return (
    <section className="panel match-hud" aria-labelledby="match-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Status</p>
          <h2 id="match-title">{phaseLabel(snapshot)}</h2>
        </div>
        <span className={isMyTurn ? "turn-badge active-turn" : "turn-badge"}>
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

      {isPlaying ? (
        <form className="shot-form" onSubmit={handleSubmit}>
          <label htmlFor="shot-expression">Function Shot</label>
          <div className="shot-row">
            <input
              autoComplete="off"
              disabled={!isMyTurn}
              id="shot-expression"
              onChange={(event) => setExpression(event.target.value)}
              placeholder="sin(x)"
              value={expression}
            />
            <button className="primary-action" disabled={!canSubmitShot} type="submit">
              Fire
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">Shot input appears once the match is playing.</p>
      )}

      {(lastRejection || lastError) && (
        <div className="notice" role="status">
          {lastRejection ? lastRejection.reason : lastError}
        </div>
      )}
    </section>
  );
}
