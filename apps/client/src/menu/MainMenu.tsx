import type { CSSProperties } from "react";
import type { AppView } from "../app/useGameStore";
import { equationProjectiles } from "./equationProjectiles";

type MainMenuProps = {
  guildId: string;
  onNavigate: (view: AppView) => void;
};

export function MainMenu({ guildId, onNavigate }: MainMenuProps) {
  function navigate(view: AppView): void {
    onNavigate(view);
  }

  return (
    <section className="menu-screen" aria-labelledby="main-menu-title">
      <div className="equation-stream" aria-hidden="true">
        {equationProjectiles.map((projectile) => (
          <span
            className="menu-equation"
            key={projectile.id}
            style={
              {
                "--equation-lane": projectile.lane,
                "--equation-delay": `${projectile.delaySeconds}s`,
                "--equation-duration": `${projectile.durationSeconds}s`
            } as CSSProperties
            }
          >
            {projectile.expression}
          </span>
        ))}
      </div>
      <div className="main-menu-cardless">
        <div className="main-menu-heading">
          <p className="eyebrow">Guild {guildId}</p>
          <h1 id="main-menu-title">Graphwar</h1>
        </div>
        <div className="menu-actions">
          <button className="primary-action" onClick={() => navigate("create-lobby")} type="button">
            Create Lobby
          </button>
          <button className="secondary-action" onClick={() => navigate("join-lobby")} type="button">
            Join Lobby
          </button>
          <button className="secondary-action" onClick={() => navigate("custom-maps")} type="button">
            Custom Maps
          </button>
          <button className="secondary-action" onClick={() => navigate("settings")} type="button">
            Settings
          </button>
          <button className="secondary-action" onClick={() => navigate("leaderboard")} type="button">
            Leaderboard
          </button>
        </div>
      </div>
    </section>
  );
}
