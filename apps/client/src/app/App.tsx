import { useEffect, useMemo, useState } from "react";
import { GameCanvas, SHOT_ANIMATION_MS, shotEventKey } from "../game-renderer/GameCanvas";
import { computeFunctionPreview } from "../game-renderer/functionPreview";
import { findLatestShotResolvedEvent, findSnapshotBeforeLatestShot } from "../game-renderer/renderWorld";
import { MatchHud } from "../hud/MatchHud";
import { LeaderboardView } from "../leaderboard/LeaderboardView";
import { CreateLobbyView } from "../lobby/CreateLobbyView";
import { JoinLobbyView } from "../lobby/JoinLobbyView";
import { LobbySetupView } from "../lobby/LobbySetupView";
import { MapLibraryView } from "../maps/MapLibraryView";
import { parseCustomMapFileText } from "../maps/mapFile";
import { MatchEndModal } from "../match-end/MatchEndModal";
import { MainMenu } from "../menu/MainMenu";
import { SettingsView } from "../settings/SettingsView";
import { useGameStore, type AppView, type SelectedLobbySession } from "./useGameStore";
import type { ClientSession } from "../sessions/localSession";
import type { AimDirectionId, LobbyOccupant, LobbyRuntimeSnapshot, ServerEvent } from "@graphwar/shared";

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

type AppProps = {
  viewOverride?: AppView;
};

export function App(props?: AppProps): JSX.Element;
export function App({ viewOverride }: AppProps = {}) {
  const autoAssignTeams = useGameStore((state) => state.autoAssignTeams);
  const createLobby = useGameStore((state) => state.createLobby);
  const currentLobby = useGameStore((state) => state.currentLobby);
  const customMaps = useGameStore((state) => state.customMaps);
  const deleteCustomMap = useGameStore((state) => state.deleteCustomMap);
  const leaderboard = useGameStore((state) => state.leaderboard);
  const lobbies = useGameStore((state) => state.lobbies);
  const loadCustomMaps = useGameStore((state) => state.loadCustomMaps);
  const loadLeaderboard = useGameStore((state) => state.loadLeaderboard);
  const loadLobbies = useGameStore((state) => state.loadLobbies);
  const loadSettings = useGameStore((state) => state.loadSettings);
  const saveSettings = useGameStore((state) => state.saveSettings);
  const saveCustomMap = useGameStore((state) => state.saveCustomMap);
  const settings = useGameStore((state) => state.settings);
  const setView = useGameStore((state) => state.setView);
  const storeView = useGameStore((state) => state.view);
  const cancelLobby = useGameStore((state) => state.cancelLobby);
  const joinLobby = useGameStore((state) => state.joinLobby);
  const returnToMenu = useGameStore((state) => state.returnToMenu);
  const selectedLobbySession = useGameStore((state) => state.selectedLobbySession);
  const session = useGameStore((state) => state.session);
  const setTeam = useGameStore((state) => state.setTeam);
  const startMatch = useGameStore((state) => state.startMatch);
  const lobbyIdentity = resolveLocalLobbyIdentity({ currentLobby, selectedLobbySession, session });
  const view = viewOverride ?? storeView;

  useEffect(() => {
    if ((view === "create-lobby" || view === "join-lobby" || view === "settings") && !settings) {
      void loadSettings();
    }
  }, [loadSettings, settings, view]);

  useEffect(() => {
    if (view === "create-lobby" || view === "custom-maps") {
      void loadCustomMaps();
    }
  }, [loadCustomMaps, view]);

  if (view === "main-menu") {
    return <MainMenu guildId={session.guildId} onNavigate={setView} />;
  }

  if (view === "create-lobby") {
    return (
      <CreateLobbyView
        defaultAlias={session.defaultAlias}
        customMaps={customMaps}
        onBack={() => setView("main-menu")}
        onCreate={createLobby}
        settings={settings}
      />
    );
  }

  if (view === "custom-maps") {
    return (
      <MapLibraryView
        currentDiscordUserId={session.discordUserId}
        customMaps={customMaps}
        onBack={() => setView("main-menu")}
        onDelete={deleteCustomMap}
        onImportText={(text) => saveCustomMap(parseCustomMapFileText(text))}
      />
    );
  }

  if (view === "join-lobby") {
    return (
      <JoinLobbyView
        lobbies={lobbies}
        onBack={() => setView("main-menu")}
        onJoin={joinLobby}
        onLoad={loadLobbies}
        settings={settings}
      />
    );
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
        onBack={returnToMenu}
        onCancelLobby={cancelLobby}
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
  const returnToMenu = useGameStore((state) => state.returnToMenu);
  const currentLobby = useGameStore((state) => state.currentLobby);
  const forfeitMatch = useGameStore((state) => state.forfeitMatch);
  const selectedLobbySession = useGameStore((state) => state.selectedLobbySession);
  const session = useGameStore((state) => state.session);
  const snapshot = useGameStore((state) => state.snapshot);
  const submitShot = useGameStore((state) => state.submitShot);
  const [aimDirection, setAimDirection] = useState<AimDirectionId>("east");
  const [draftExpression, setDraftExpression] = useState("sin(x)");

  const latestShot = useMemo(() => findLatestShotResolvedEvent(recentEvents), [recentEvents]);
  const latestShotKey = useMemo(() => (latestShot ? shotEventKey(latestShot) : undefined), [latestShot]);
  const latestMatchEnded = useMemo(() => findLatestMatchEndedEvent(recentEvents), [recentEvents]);
  const snapshotBeforeLatestShot = useMemo(() => findSnapshotBeforeLatestShot(recentEvents), [recentEvents]);
  const [completedPlaybackShotKey, setCompletedPlaybackShotKey] = useState<string | undefined>();
  const playbackInProgress = Boolean(
    latestShotKey && snapshotBeforeLatestShot && completedPlaybackShotKey !== latestShotKey
  );
  const displaySnapshot = playbackInProgress && snapshotBeforeLatestShot ? snapshotBeforeLatestShot : snapshot;
  const showMatchEndModal = Boolean(latestMatchEnded && !playbackInProgress);
  const canvasEvents = useMemo(
    () => (showMatchEndModal ? recentEvents.filter((event) => event.type !== "shot-resolved") : recentEvents),
    [recentEvents, showMatchEndModal]
  );
  const lobbyIdentity = resolveLocalLobbyIdentity({ currentLobby, selectedLobbySession, session });
  const previewPath = useMemo(
    () =>
      currentLobby?.functionPreview === false || lobbyIdentity.spectator
        ? undefined
        : computeFunctionPreview({
            advancedFunctions: currentLobby?.advancedFunctions ?? false,
            aimDirection,
            expression: draftExpression,
            maxFunctionLength: currentLobby?.maxFunctionLength ?? 50,
            playerId: lobbyIdentity.effectiveSession.playerId,
            snapshot: displaySnapshot
          }),
    [
      aimDirection,
      currentLobby?.advancedFunctions,
      currentLobby?.functionPreview,
      currentLobby?.maxFunctionLength,
      displaySnapshot,
      draftExpression,
      lobbyIdentity.effectiveSession.playerId,
      lobbyIdentity.spectator
    ]
  );

  useEffect(() => {
    if (!latestShotKey || !snapshotBeforeLatestShot) {
      setCompletedPlaybackShotKey(undefined);
      return undefined;
    }

    setCompletedPlaybackShotKey((current) => (current === latestShotKey ? current : undefined));
    const timeout = window.setTimeout(() => {
      setCompletedPlaybackShotKey(latestShotKey);
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
        <GameCanvas events={canvasEvents} previewPath={previewPath} snapshot={displaySnapshot} />
        <MatchHud
          advancedFunctionsEnabled={currentLobby?.advancedFunctions ?? false}
          aimDirection={aimDirection}
          connectionStatus={connectionStatus}
          displaySnapshot={displaySnapshot}
          expression={draftExpression}
          lastError={lastError}
          lastRejection={lastRejection}
          onAimDirectionChange={setAimDirection}
          onExpressionChange={setDraftExpression}
          onForfeit={forfeitMatch}
          onSubmitShot={submitShot}
          playbackInProgress={playbackInProgress}
          session={lobbyIdentity.effectiveSession}
          snapshot={snapshot}
          spectator={lobbyIdentity.spectator}
        />
      </div>
      {showMatchEndModal && latestMatchEnded ? (
        <MatchEndModal event={latestMatchEnded} onReturnToMenu={returnToMenu} />
      ) : null}
    </main>
  );
}

function findLatestMatchEndedEvent(events: ServerEvent[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "match-ended") {
      return event;
    }
  }

  return undefined;
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
