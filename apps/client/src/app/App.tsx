import { useEffect, useMemo, useState } from "react";
import { GameCanvas, SHOT_ANIMATION_MS, shotEventKey } from "../game-renderer/GameCanvas";
import { findLatestShotResolvedEvent, findSnapshotBeforeLatestShot } from "../game-renderer/renderWorld";
import { MatchHud } from "../hud/MatchHud";
import { LeaderboardView } from "../leaderboard/LeaderboardView";
import { CreateLobbyView } from "../lobby/CreateLobbyView";
import { JoinLobbyView } from "../lobby/JoinLobbyView";
import { LobbySetupView } from "../lobby/LobbySetupView";
import { MainMenu } from "../menu/MainMenu";
import { SettingsView } from "../settings/SettingsView";
import { useGameStore, type SelectedLobbySession } from "./useGameStore";
import type { ClientSession } from "../sessions/localSession";
import type { LobbyOccupant, LobbyRuntimeSnapshot } from "@graphwar/shared";

type LocalLobbyIdentityInput = {
  currentLobby?: LobbyRuntimeSnapshot;
  selectedLobbySession?: SelectedLobbySession;
  session: ClientSession;
};

type LocalLobbyIdentity = {
  effectiveSession: ClientSession;
  localOccupant?: LobbyOccupant;
  spectator: boolean;
};

export function resolveLocalLobbyIdentity({
  currentLobby,
  selectedLobbySession,
  session
}: LocalLobbyIdentityInput): LocalLobbyIdentity {
  const selectedPlayerId = selectedLobbySession?.playerId ?? session.playerId;
  const selectedDiscordUserId = selectedLobbySession?.discordUserId ?? session.discordUserId;
  const localOccupant =
    currentLobby?.occupants.find((occupant) => occupant.playerId === selectedPlayerId) ??
    currentLobby?.occupants.find((occupant) => occupant.discordUserId === selectedDiscordUserId);
  const alias = localOccupant?.alias ?? selectedLobbySession?.alias ?? session.displayName;
  const effectiveSession: ClientSession = {
    ...session,
    guildId: selectedLobbySession?.guildId ?? session.guildId,
    roomId: selectedLobbySession?.roomId ?? session.roomId,
    discordUserId: localOccupant?.discordUserId ?? selectedDiscordUserId,
    playerId: localOccupant?.playerId ?? selectedPlayerId,
    defaultAlias: alias,
    displayName: alias
  };

  return {
    effectiveSession,
    localOccupant,
    spectator: localOccupant ? localOccupant.slot === "spectator" : selectedLobbySession?.slot === "spectator"
  };
}

export function App() {
  const autoAssignTeams = useGameStore((state) => state.autoAssignTeams);
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
  const disconnect = useGameStore((state) => state.disconnect);
  const joinLobby = useGameStore((state) => state.joinLobby);
  const selectedLobbySession = useGameStore((state) => state.selectedLobbySession);
  const session = useGameStore((state) => state.session);
  const setTeam = useGameStore((state) => state.setTeam);
  const startMatch = useGameStore((state) => state.startMatch);
  const lobbyIdentity = resolveLocalLobbyIdentity({ currentLobby, selectedLobbySession, session });

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
    if (!currentLobby) {
      return (
        <section className="lobby-setup-screen" aria-labelledby="lobby-setup-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Lobby setup</p>
              <h1 id="lobby-setup-title">Selected lobby</h1>
            </div>
          </div>
          <div className="notice" role="status">
            Waiting for lobby snapshot.
          </div>
        </section>
      );
    }

    return (
      <LobbySetupView
        currentDiscordUserId={lobbyIdentity.effectiveSession.discordUserId}
        currentPlayerId={lobbyIdentity.effectiveSession.playerId}
        lobby={currentLobby}
        onAutoAssign={autoAssignTeams}
        onBack={() => {
          disconnect();
          setView("main-menu");
        }}
        onMove={setTeam}
        onStart={startMatch}
      />
    );
  }

  return <GameActivity />;
}

function GameActivity() {
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const lastError = useGameStore((state) => state.lastError);
  const lastRejection = useGameStore((state) => state.lastRejection);
  const recentEvents = useGameStore((state) => state.recentEvents);
  const currentLobby = useGameStore((state) => state.currentLobby);
  const selectedLobbySession = useGameStore((state) => state.selectedLobbySession);
  const session = useGameStore((state) => state.session);
  const snapshot = useGameStore((state) => state.snapshot);
  const submitShot = useGameStore((state) => state.submitShot);

  const latestShot = useMemo(() => findLatestShotResolvedEvent(recentEvents), [recentEvents]);
  const latestShotKey = useMemo(() => (latestShot ? shotEventKey(latestShot) : undefined), [latestShot]);
  const snapshotBeforeLatestShot = useMemo(() => findSnapshotBeforeLatestShot(recentEvents), [recentEvents]);
  const [playbackShotKey, setPlaybackShotKey] = useState<string | undefined>();
  const playbackInProgress = Boolean(latestShotKey && playbackShotKey === latestShotKey);
  const displaySnapshot = playbackInProgress && snapshotBeforeLatestShot ? snapshotBeforeLatestShot : snapshot;
  const lobbyIdentity = resolveLocalLobbyIdentity({ currentLobby, selectedLobbySession, session });

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
        <GameSessionPill selectedLobbySession={selectedLobbySession} session={session} />
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
          session={lobbyIdentity.effectiveSession}
          snapshot={snapshot}
          spectator={lobbyIdentity.spectator}
        />
      </div>
    </main>
  );
}

export function GameSessionPill({
  selectedLobbySession,
  session
}: {
  selectedLobbySession?: SelectedLobbySession;
  session: ClientSession;
}) {
  return (
    <div className="session-pill">
      <span>{selectedLobbySession?.alias ?? session.displayName}</span>
      <span>{selectedLobbySession?.roomId ?? session.roomId ?? "No lobby selected"}</span>
      <span>{selectedLobbySession?.playerId ?? session.playerId}</span>
    </div>
  );
}
