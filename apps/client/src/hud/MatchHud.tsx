import type { MatchSnapshot } from "@graphwar/shared";
import type { ConnectionStatus, CommandRejection } from "../app/useGameStore";
import { FunctionInput } from "../input/FunctionInput";
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
  const activePlayer = snapshot?.players.find((player) => player.id === snapshot.turn.activePlayerId);
  const isPlaying = snapshot?.phase === "playing";
  const isMyTurn = isPlaying && snapshot.turn.activePlayerId === session.playerId;
  const canSubmitShot = connectionStatus === "open" && isMyTurn;
  const notice = lastError ?? lastRejection?.reason;

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

      {isPlaying ? (
        <FunctionInput canSubmit={canSubmitShot} disabled={!isMyTurn} onSubmitShot={onSubmitShot} />
      ) : (
        <p className="muted">Shot input appears once the match is playing.</p>
      )}

      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </section>
  );
}
