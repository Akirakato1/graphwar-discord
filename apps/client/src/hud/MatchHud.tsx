import { useEffect, useState } from "react";
import type { AimDirectionId, FunctionInputMode, MatchSnapshot } from "@graphwar/shared";
import type { ConnectionStatus, CommandRejection } from "../app/useGameStore";
import { DirectionDial } from "../input/DirectionDial";
import { FunctionInput } from "../input/FunctionInput";
import type { ClientSession } from "../sessions/localSession";

type MatchHudProps = {
  advancedFunctionsEnabled?: boolean;
  aimDirection?: AimDirectionId;
  connectionStatus: ConnectionStatus;
  displaySnapshot?: MatchSnapshot;
  expression?: string;
  lastError?: string;
  lastRejection?: CommandRejection;
  nowMs?: number;
  onAimDirectionChange?: (direction: AimDirectionId) => void;
  onExpressionChange?: (expression: string) => void;
  onForfeit?: () => void;
  onSubmitShot: (expression: string, aimDirection: AimDirectionId) => void;
  playbackInProgress?: boolean;
  session: ClientSession;
  snapshot?: MatchSnapshot;
  spectator?: boolean;
  inputMode?: FunctionInputMode;
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

function remainingTurnSeconds(snapshot: MatchSnapshot | undefined, nowMs: number): number | undefined {
  const deadlineAt = snapshot?.turn.deadlineAt;
  if (!deadlineAt) {
    return undefined;
  }

  const deadlineMs = Date.parse(deadlineAt);
  if (!Number.isFinite(deadlineMs)) {
    return undefined;
  }

  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function MatchHud({
  advancedFunctionsEnabled = false,
  aimDirection: controlledAimDirection,
  connectionStatus,
  displaySnapshot,
  expression,
  inputMode = "hybrid",
  lastError,
  lastRejection,
  nowMs,
  onAimDirectionChange,
  onExpressionChange,
  onForfeit,
  onSubmitShot,
  playbackInProgress = false,
  session,
  snapshot,
  spectator = false
}: MatchHudProps) {
  const [internalAimDirection, setInternalAimDirection] = useState<AimDirectionId>("east");
  const [clockMs, setClockMs] = useState(nowMs ?? Date.now());
  const aimDirection = controlledAimDirection ?? internalAimDirection;
  const setAimDirection = onAimDirectionChange ?? setInternalAimDirection;
  const activePlayer = snapshot?.players.find((player) => player.id === snapshot.turn.activePlayerId);
  const localPlayer = snapshot?.players.find((player) => player.id === session.playerId);
  const displayLocalPlayer = displaySnapshot?.players.find((player) => player.id === session.playerId) ?? localPlayer;
  const isPlaying = snapshot?.phase === "playing";
  const isMyTurn = isPlaying && snapshot.turn.activePlayerId === session.playerId;
  const displayNowMs = nowMs ?? clockMs;
  const turnSecondsRemaining = remainingTurnSeconds(snapshot, displayNowMs);
  const turnExpired = turnSecondsRemaining !== undefined && turnSecondsRemaining <= 0;
  const canSubmitShot = connectionStatus === "open" && isMyTurn && !playbackInProgress && !turnExpired;
  const canForfeit = connectionStatus === "open" && isPlaying && !spectator && Boolean(localPlayer?.alive) && !playbackInProgress;
  const notice = lastError ?? lastRejection?.reason;

  useEffect(() => {
    if (nowMs !== undefined || !isPlaying || !snapshot?.turn.deadlineAt) {
      return undefined;
    }

    const interval = window.setInterval(() => setClockMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isPlaying, nowMs, snapshot?.turn.deadlineAt]);

  function handleForfeit(): void {
    if (!canForfeit || !onForfeit) {
      return;
    }

    const confirmed =
      typeof window !== "undefined"
        ? window.confirm("Forfeit this match? You will be marked dead and returned to the main menu.")
        : false;

    if (confirmed) {
      onForfeit();
    }
  }

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

        <div className={turnSecondsRemaining !== undefined ? "play-control-strip has-turn-timer" : "play-control-strip"}>
          <div className="own-hp" data-testid="own-hp">
            <span>HP</span>
            <strong>{displayLocalPlayer ? `${displayLocalPlayer.hp} HP` : "-- HP"}</strong>
          </div>
          {turnSecondsRemaining !== undefined ? (
            <div className="turn-timer" aria-label="Turn time remaining">
              <span>Timer</span>
              <strong>{turnSecondsRemaining}s</strong>
            </div>
          ) : null}
          <button
            aria-label="Forfeit match"
            className="forfeit-action"
            disabled={!canForfeit}
            onClick={handleForfeit}
            title="Forfeit match"
            type="button"
          >
            FF
          </button>
          <DirectionDial disabled={false} onChange={setAimDirection} value={aimDirection} />
        </div>

        <FunctionInput
          advancedFunctionsEnabled={advancedFunctionsEnabled}
          canSubmit={canSubmitShot}
          disabled={false}
          expression={expression}
          inputMode={inputMode}
          onExpressionChange={onExpressionChange}
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
