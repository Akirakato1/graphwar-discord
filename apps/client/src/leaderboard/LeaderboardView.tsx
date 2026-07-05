import { useEffect } from "react";
import type { PlayerStatsEntry } from "@graphwar/shared";

type LeaderboardViewProps = {
  entries: PlayerStatsEntry[];
  onBack: () => void;
  onLoad: () => Promise<void>;
};

export function LeaderboardView({ entries, onBack, onLoad }: LeaderboardViewProps) {
  useEffect(() => {
    void onLoad();
  }, [onLoad]);

  return (
    <section className="panel menu-panel" aria-labelledby="leaderboard-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Guild standings</p>
          <h2 id="leaderboard-title">Leaderboard</h2>
        </div>
        <button className="secondary-action" onClick={() => void onLoad()} type="button">
          Refresh
        </button>
      </div>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Alias</th>
            <th>Games played</th>
            <th>Wins</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.discordUserId}>
              <td>{entry.lastAlias}</td>
              <td>{entry.gamesPlayed}</td>
              <td>{entry.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length === 0 && <p className="muted">No games recorded yet.</p>}
      <div className="form-actions">
        <button className="secondary-action" onClick={onBack} type="button">
          Back
        </button>
      </div>
    </section>
  );
}
