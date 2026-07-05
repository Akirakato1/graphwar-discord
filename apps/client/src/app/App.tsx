import { useEffect, useMemo, useState } from "react";
import { GameCanvas, SHOT_ANIMATION_MS, shotEventKey } from "../game-renderer/GameCanvas";
import { findLatestShotResolvedEvent, findSnapshotBeforeLatestShot } from "../game-renderer/renderWorld";
import { MatchHud } from "../hud/MatchHud";
import { LeaderboardView } from "../leaderboard/LeaderboardView";
import { CreateLobbyView } from "../lobby/CreateLobbyView";
import { JoinLobbyView } from "../lobby/JoinLobbyView";
import { MainMenu } from "../menu/MainMenu";
import { SettingsView } from "../settings/SettingsView";
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
  const createLobby = useGameStore((state) => state.createLobby);
  const currentLobby = useGameStore((state) => state.currentLobby);
  const leaderboard = useGameStore((state) => state.leaderboard);
  const lobbies = useGameStore((state) => state.lobbies);
  const loadLeaderboard = useGameStore((state) => state.loadLeaderboard);
  const loadLobbies = useGameStore((state) => state.loadLobbies);
  const loadSettings = useGameStore((state) => state.loadSettings);
  const saveSettings = useGameStore((state) => state.saveSettings);
  const settings = useGameStore((state) => state.settings);
  const setView = useGameStore((state) => state.setView);
  const view = useGameStore((state) => state.view);
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const disconnect = useGameStore((state) => state.disconnect);
  const joinLobby = useGameStore((state) => state.joinLobby);
  const session = useGameStore((state) => state.session);
  const startMatch = useGameStore((state) => state.startMatch);

  if (view === "main-menu") {
    return <MainMenu guildId={session.guildId} onNavigate={setView} />;
  }

  if (view === "create-lobby") {
    return <CreateLobbyView defaultAlias={session.defaultAlias} onBack={() => setView("main-menu")} onCreate={createLobby} />;
  }

  if (view === "join-lobby") {
    return <JoinLobbyView lobbies={lobbies} onBack={() => setView("main-menu")} onJoin={joinLobby} onLoad={loadLobbies} />;
  }

  if (view === "settings") {
    return (
      <SettingsView settings={settings} onBack={() => setView("main-menu")} onLoad={loadSettings} onSave={saveSettings} />
    );
  }

  if (view === "leaderboard") {
    return <LeaderboardView entries={leaderboard} onBack={() => setView("main-menu")} onLoad={loadLeaderboard} />;
  }

  if (view === "lobby-setup") {
    return (
      <LobbySetupPlaceholder
        connectionStatus={connectionStatus}
        lobbyName={currentLobby?.name ?? "Selected lobby"}
        lobbyStatus={currentLobby?.status ?? "open"}
        onBack={() => {
          disconnect();
          setView("main-menu");
        }}
        onStartMatch={startMatch}
      />
    );
  }

  return <GameActivity />;
}

function LobbySetupPlaceholder({
  connectionStatus,
  lobbyName,
  lobbyStatus,
  onBack,
  onStartMatch
}: {
  connectionStatus: ConnectionStatus;
  lobbyName: string;
  lobbyStatus: string;
  onBack: () => void;
  onStartMatch: () => void;
}) {
  return (
    <main className="app-shell">
      <section className="panel menu-panel" aria-labelledby="lobby-setup-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Lobby setup</p>
            <h2 id="lobby-setup-title">{lobbyName}</h2>
          </div>
          <span className={`connection-light ${connectionStatus}`} aria-hidden="true" />
        </div>
        <dl className="connection-details">
          <div>
            <dt>Status</dt>
            <dd>{lobbyStatus}</dd>
          </div>
          <div>
            <dt>Connection</dt>
            <dd>{statusText(connectionStatus)}</dd>
          </div>
        </dl>
        <div className="connection-actions">
          <button className="secondary-action" onClick={onBack} type="button">
            Back
          </button>
          <button className="primary-action" onClick={onStartMatch} type="button">
            Start Match
          </button>
        </div>
      </section>
    </main>
  );
}

function GameActivity() {
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const lastError = useGameStore((state) => state.lastError);
  const lastRejection = useGameStore((state) => state.lastRejection);
  const recentEvents = useGameStore((state) => state.recentEvents);
  const session = useGameStore((state) => state.session);
  const snapshot = useGameStore((state) => state.snapshot);
  const submitShot = useGameStore((state) => state.submitShot);

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

      <div className="app-grid playing-grid">
        <GameCanvas events={recentEvents} snapshot={snapshot} />
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
      </div>
    </main>
  );
}
