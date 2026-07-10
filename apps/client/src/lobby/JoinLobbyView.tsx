import { useEffect, useState, type SyntheticEvent } from "react";
import type { GuildSettings, LobbySlot, LobbySummary, PlayerColor } from "@graphwar/shared";
import { lobbyDefaultPlayerColor, lobbyPlayerColorPalette } from "./CreateLobbyView";

type JoinLobbyViewProps = {
  lobbies: LobbySummary[];
  onBack: () => void;
  onJoin: (roomId: string, form: { alias: string; slot: LobbySlot; color: PlayerColor }) => Promise<void>;
  onLoad: () => Promise<void>;
  settings?: GuildSettings;
};

type JoinLobbyForm = {
  alias: string;
  slot: LobbySlot;
  color: PlayerColor;
};

export function validateJoinAlias(alias: string): string | undefined {
  return alias.trim() ? undefined : "Enter an alias.";
}

export function isAliasConflictError(error: unknown): boolean {
  return (
    (error instanceof Error && error.message === "Alias is already taken.") ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: unknown }).status === 409)
  );
}

export function joinActionLabel(slot: LobbySlot): string {
  return slot === "spectator" ? "Spectate" : "Join As Player";
}

export function isJoinActionDisabled(lobby: LobbySummary, slot: LobbySlot, joiningRoomId: string | undefined): boolean {
  return joiningRoomId === lobby.roomId || (slot === "player" && lobby.status === "playing");
}

export function availableJoinSlots(settings?: Pick<GuildSettings, "allowSpectators">): LobbySlot[] {
  return settings?.allowSpectators === false ? ["player"] : ["player", "spectator"];
}

export function prepareJoinLobbyForm(form: JoinLobbyForm): JoinLobbyForm {
  return {
    ...form,
    alias: form.alias.trim()
  };
}

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function JoinLobbyView({ lobbies, onBack, onJoin, onLoad, settings }: JoinLobbyViewProps) {
  const [alias, setAlias] = useState("");
  const [aliasTaken, setAliasTaken] = useState(false);
  const [color, setColor] = useState<PlayerColor>(lobbyDefaultPlayerColor);
  const [formError, setFormError] = useState<string | undefined>();
  const [joiningRoomId, setJoiningRoomId] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();

  async function loadLobbies(): Promise<void> {
    setLoadError(undefined);
    try {
      await onLoad();
    } catch (error) {
      setLoadError(messageFromError(error, "Could not load lobbies."));
    }
  }

  useEffect(() => {
    void loadLobbies();
  }, [onLoad]);

  async function handleJoin(roomId: string, slot: LobbySlot, event: SyntheticEvent): Promise<void> {
    event.preventDefault();
    setAliasTaken(false);
    setFormError(undefined);
    const aliasError = validateJoinAlias(alias);
    if (aliasError) {
      setFormError(aliasError);
      return;
    }

    setJoiningRoomId(roomId);
    try {
      await onJoin(roomId, prepareJoinLobbyForm({ alias, slot, color }));
    } catch (error) {
      if (isAliasConflictError(error)) {
        setAliasTaken(true);
        setFormError("Alias is already taken.");
      } else {
        setFormError(messageFromError(error, "Could not join lobby."));
      }
    } finally {
      setJoiningRoomId(undefined);
    }
  }

  return (
    <div className="menu-screen">
      <section className="panel menu-panel" aria-labelledby="join-lobby-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Available rooms</p>
            <h2 id="join-lobby-title">Join Lobby</h2>
          </div>
          <button className="secondary-action" onClick={() => void loadLobbies()} type="button">
            Refresh
          </button>
        </div>

        <div className="menu-form join-lobby-form">
          <label>
            Alias
            <input
              aria-invalid={aliasTaken ? "true" : undefined}
              required
              value={alias}
              onChange={(event) => {
                setAlias(event.currentTarget.value);
                setAliasTaken(false);
                setFormError(undefined);
              }}
            />
          </label>
          <fieldset className="color-selector">
            <legend>Color</legend>
            <div className="color-options">
              {lobbyPlayerColorPalette.map((option) => (
                <label key={option} title={option}>
                  <input
                    aria-label={`Choose color ${option}`}
                    checked={color === option}
                    name="join-player-color"
                    onChange={() => setColor(option)}
                    type="radio"
                    value={option}
                  />
                  <span className="color-swatch" style={{ backgroundColor: option }} />
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {(loadError || formError) && (
          <p className="notice" role="alert">
            {formError ?? loadError}
          </p>
        )}

        <div className="lobby-list">
          {lobbies.length === 0 ? (
            <p className="muted">No lobbies available.</p>
          ) : (
            lobbies.map((lobby) => {
              return (
                <div className="lobby-row" key={lobby.roomId}>
                  <div className="lobby-row-summary">
                    <strong className="lobby-row-name">{lobby.name}</strong>
                    <span>
                      {lobby.status} - {lobby.playerCount} players - {lobby.spectatorCount} spectators
                    </span>
                  </div>
                  <div className="lobby-row-actions" aria-label={`Join ${lobby.name}`}>
                    {availableJoinSlots(settings).map((actionSlot) => (
                      <button
                        className={actionSlot === "player" ? "primary-action" : "secondary-action"}
                        disabled={isJoinActionDisabled(lobby, actionSlot, joiningRoomId)}
                        key={actionSlot}
                        onClick={(event) => void handleJoin(lobby.roomId, actionSlot, event)}
                        type="button"
                      >
                        {joinActionLabel(actionSlot)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="form-actions">
          <button className="secondary-action" onClick={onBack} type="button">
            Back
          </button>
        </div>
      </section>
    </div>
  );
}
