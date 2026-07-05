import type { AppView } from "../app/useGameStore";

type MainMenuProps = {
  guildId: string;
  onNavigate: (view: AppView) => void;
};

export function MainMenu({ guildId, onNavigate }: MainMenuProps) {
  return (
    <section className="menu-screen" aria-labelledby="main-menu-title">
      <div className="main-menu-cardless">
        <div className="main-menu-heading">
          <p className="eyebrow">Guild {guildId}</p>
          <h1 id="main-menu-title">Graphwar</h1>
        </div>
        <div className="menu-actions">
          <button className="primary-action" onClick={() => onNavigate("create-lobby")} type="button">
            Create Lobby
          </button>
          <button className="secondary-action" onClick={() => onNavigate("join-lobby")} type="button">
            Join Lobby
          </button>
          <button className="secondary-action" onClick={() => onNavigate("custom-maps")} type="button">
            Custom Maps
          </button>
          <button className="secondary-action" onClick={() => onNavigate("settings")} type="button">
            Settings
          </button>
          <button className="secondary-action" onClick={() => onNavigate("leaderboard")} type="button">
            Leaderboard
          </button>
        </div>
      </div>
    </section>
  );
}
