import { useEffect, useMemo, useState } from "react";
import { GameCanvas, SHOT_ANIMATION_MS, shotEventKey } from "../game-renderer/GameCanvas";
import { findLatestShotResolvedEvent, findSnapshotBeforeLatestShot } from "../game-renderer/renderWorld";
import { LobbyPanel } from "../hud/LobbyPanel";
import { MatchHud } from "../hud/MatchHud";
import { useGameStore, type ConnectionStatus } from "./useGameStore";

function statusText(status: ConnectionStatus): string {
  switch (status) {
    case "idle":
      return "Idle";
    case "connecting":
      return "Connecting";
    case "open":
      return "Connected";
    case "closed":
      return "Closed";
    case "reconnecting":
      return "Reconnecting";
    case "error":
      return "Error";
  }
}

export function App() {
  const connect = useGameStore((state) => state.connect);
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const disconnect = useGameStore((state) => state.disconnect);
  const joinRoom = useGameStore((state) => state.joinRoom);
  const lastError = useGameStore((state) => state.lastError);
  const lastRejection = useGameStore((state) => state.lastRejection);
  const recentEvents = useGameStore((state) => state.recentEvents);
  const selectMode = useGameStore((state) => state.selectMode);
  const session = useGameStore((state) => state.session);
  const snapshot = useGameStore((state) => state.snapshot);
  const startMatch = useGameStore((state) => state.startMatch);
  const submitShot = useGameStore((state) => state.submitShot);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const connected = connectionStatus === "open";
  const connecting = connectionStatus === "connecting" || connectionStatus === "reconnecting";
  const isPlaying = snapshot?.phase === "playing";
  const latestShot = useMemo(() => findLatestShotResolvedEvent(recentEvents), [recentEvents]);
  const latestShotKey = useMemo(() => (latestShot ? shotEventKey(latestShot) : undefined), [latestShot]);
  const snapshotBeforeLatestShot = useMemo(() => findSnapshotBeforeLatestShot(recentEvents), [recentEvents]);
  const [playbackShotKey, setPlaybackShotKey] = useState<string | undefined>();
  const playbackInProgress = Boolean(latestShotKey && playbackShotKey === latestShotKey);
  const displaySnapshot = playbackInProgress && snapshotBeforeLatestShot ? snapshotBeforeLatestShot : snapshot;

  useEffect(() => {
    if (!latestShotKey || !snapshotBeforeLatestShot) {
      setPlaybackShotKey(undefined);
      return undefined;
    }

    setPlaybackShotKey(latestShotKey);
    const timeout = window.setTimeout(() => {
      setPlaybackShotKey((current) => (current === latestShotKey ? undefined : current));
    }, SHOT_ANIMATION_MS);

    return () => window.clearTimeout(timeout);
  }, [latestShotKey, snapshotBeforeLatestShot]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Graphwar Activity Prototype</p>
          <h1>Local Room Control</h1>
        </div>
        <div className="session-pill">
          <span>{session.displayName}</span>
          <span>{session.roomId}</span>
        </div>
      </header>

      <div className={isPlaying ? "app-grid playing-grid" : "app-grid lobby-activity-grid"}>
        <GameCanvas events={recentEvents} snapshot={snapshot} />

        {!isPlaying && (
          <section className="panel connection-panel" aria-labelledby="connection-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Connection</p>
                <h2 id="connection-title">{statusText(connectionStatus)}</h2>
              </div>
              <span className={`connection-light ${connectionStatus}`} aria-hidden="true" />
            </div>

            <dl className="connection-details">
              <div>
                <dt>Room</dt>
                <dd>{session.roomId}</dd>
              </div>
              <div>
                <dt>Player</dt>
                <dd>{session.playerId}</dd>
              </div>
              <div>
                <dt>Server</dt>
                <dd>{session.serverUrl ?? "current host:8787"}</dd>
              </div>
            </dl>

            <div className="connection-actions">
              <button
                className={connected ? "secondary-action" : "primary-action"}
                disabled={connecting}
                onClick={connected ? disconnect : connect}
                type="button"
              >
                {connected ? "Disconnect" : connecting ? "Connecting" : "Connect"}
              </button>
              <button className="secondary-action" disabled={!connected} onClick={joinRoom} type="button">
                Join Room
              </button>
            </div>
          </section>
        )}

        {!isPlaying && (
          <LobbyPanel
            connectionStatus={connectionStatus}
            onSelectMode={selectMode}
            onStartMatch={startMatch}
            snapshot={snapshot}
          />
        )}

        {isPlaying && (
          <MatchHud
            connectionStatus={connectionStatus}
            displaySnapshot={displaySnapshot}
            lastError={lastError}
            lastRejection={lastRejection}
            onSubmitShot={submitShot}
            playbackInProgress={playbackInProgress}
            session={session}
            snapshot={snapshot}
          />
        )}
      </div>
    </main>
  );
}
