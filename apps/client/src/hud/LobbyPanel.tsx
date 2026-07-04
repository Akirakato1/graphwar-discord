import type { MatchModeId, MatchSnapshot, PlayerState } from "@graphwar/shared";
import type { ConnectionStatus } from "../app/useGameStore";

const modeOptions: Array<{ id: MatchModeId; label: string }> = [
  { id: "team-versus", label: "Team Versus" },
  { id: "free-for-all", label: "Free For All" }
];

type LobbyPanelProps = {
  connectionStatus: ConnectionStatus;
  onSelectMode: (mode: MatchModeId) => void;
  onStartMatch: () => void;
  snapshot?: MatchSnapshot;
};

function playerLabel(players: PlayerState[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.displayName ?? playerId;
}

export function LobbyPanel({ connectionStatus, onSelectMode, onStartMatch, snapshot }: LobbyPanelProps) {
  const players = snapshot?.players ?? [];
  const teams = snapshot?.teams ?? [];
  const phase = snapshot?.phase ?? "lobby";
  const mode = snapshot?.mode ?? "team-versus";
  const canEditLobby = connectionStatus === "open" && phase === "lobby";
  const canStartMatch = canEditLobby && players.length > 0;

  return (
    <section className="panel lobby-panel" aria-labelledby="lobby-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Lobby</p>
          <h2 id="lobby-title">Roster And Teams</h2>
        </div>
        <button className="primary-action" type="button" onClick={onStartMatch} disabled={!canStartMatch}>
          Start Match
        </button>
      </div>

      <div className="segmented-control" role="group" aria-label="Match mode">
        {modeOptions.map((option) => (
          <button
            aria-pressed={mode === option.id}
            className={mode === option.id ? "selected" : ""}
            disabled={!canEditLobby}
            key={option.id}
            onClick={() => onSelectMode(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="lobby-grid">
        <div className="surface-list">
          <h3>Players</h3>
          {players.length === 0 ? (
            <p className="muted">Connect another tab to populate the room.</p>
          ) : (
            <ul className="roster-list">
              {players.map((player) => (
                <li data-testid={`player-${player.id}`} key={player.id}>
                  <span className={player.alive ? "status-dot alive" : "status-dot knocked"} aria-hidden="true" />
                  <span className="player-name">{player.displayName}</span>
                  <span className="player-meta">{player.hp} HP</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-list">
          <h3>{mode === "team-versus" ? "Teams" : "Free For All"}</h3>
          {teams.length === 0 ? (
            <p className="muted">Team assignments appear after joining.</p>
          ) : (
            <ul className="team-list">
              {teams.map((team, index) => (
                <li key={team.id}>
                  <span className="team-name">
                    {mode === "team-versus" ? `Team ${index + 1}` : playerLabel(players, team.playerIds[0] ?? team.id)}
                  </span>
                  <span className="team-members">
                    {team.playerIds.map((playerId) => playerLabel(players, playerId)).join(", ") || "No players"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
