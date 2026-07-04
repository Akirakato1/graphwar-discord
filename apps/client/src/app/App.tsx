import { useEffect } from "react";
import { LobbyPanel } from "../hud/LobbyPanel";
import { MatchHud } from "../hud/MatchHud";
import { useGameStore, type ConnectionStatus, type GameLogEntry } from "./useGameStore";

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

type EventLogProps = {
  entries: GameLogEntry[];
  onClear: () => void;
};

function EventLog({ entries, onClear }: EventLogProps) {
  return (
    <section className="panel event-log" aria-labelledby="event-log-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Recent Events</p>
          <h2 id="event-log-title">Room Log</h2>
        </div>
        <button className="secondary-action" disabled={entries.length === 0} onClick={onClear} type="button">
          Clear
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="muted">Room events will appear here.</p>
      ) : (
        <ol className="log-list" aria-live="polite">
          {entries.map((entry) => (
            <li key={entry.id}>{entry.message}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function App() {
  const clearLog = useGameStore((state) => state.clearLog);
  const connect = useGameStore((state) => state.connect);
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const disconnect = useGameStore((state) => state.disconnect);
  const joinRoom = useGameStore((state) => state.joinRoom);
  const lastError = useGameStore((state) => state.lastError);
  const lastRejection = useGameStore((state) => state.lastRejection);
  const log = useGameStore((state) => state.log);
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

      <div className="app-grid">
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

        <LobbyPanel
          connectionStatus={connectionStatus}
          onSelectMode={selectMode}
          onStartMatch={startMatch}
          snapshot={snapshot}
        />

        <MatchHud
          connectionStatus={connectionStatus}
          lastError={lastError}
          lastRejection={lastRejection}
          onSubmitShot={submitShot}
          session={session}
          snapshot={snapshot}
        />

        <EventLog entries={log} onClear={clearLog} />
      </div>
    </main>
  );
}
