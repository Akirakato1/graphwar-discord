import { useEffect, useState, type FormEvent } from "react";
import type { LobbySlot, LobbySummary } from "@graphwar/shared";

type JoinLobbyViewProps = {
  lobbies: LobbySummary[];
  onBack: () => void;
  onJoin: (roomId: string, form: { alias: string; slot: LobbySlot }) => Promise<void>;
  onLoad: () => Promise<void>;
};

export function JoinLobbyView({ lobbies, onBack, onJoin, onLoad }: JoinLobbyViewProps) {
  const [alias, setAlias] = useState("");
  const [aliasTaken, setAliasTaken] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | undefined>();
  const [slot, setSlot] = useState<LobbySlot>("player");

  useEffect(() => {
    void onLoad();
  }, [onLoad]);

  async function handleJoin(roomId: string, event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setAliasTaken(false);
    setJoiningRoomId(roomId);
    try {
      await onJoin(roomId, { alias, slot });
    } catch (error) {
      if (error instanceof Error && error.message === "Alias is already taken.") {
        setAliasTaken(true);
      }
    } finally {
      setJoiningRoomId(undefined);
    }
  }

  return (
    <section className="panel menu-panel" aria-labelledby="join-lobby-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Available rooms</p>
          <h2 id="join-lobby-title">Join Lobby</h2>
        </div>
        <button className="secondary-action" onClick={() => void onLoad()} type="button">
          Refresh
        </button>
      </div>

      <div className="menu-form">
        <label>
          Alias
          <input
            aria-invalid={aliasTaken ? "true" : undefined}
            required
            value={alias}
            onChange={(event) => {
              setAlias(event.currentTarget.value);
              setAliasTaken(false);
            }}
          />
        </label>
        <label>
          Slot
          <select value={slot} onChange={(event) => setSlot(event.currentTarget.value as LobbySlot)}>
            <option value="player">Player</option>
            <option value="spectator">Spectator</option>
          </select>
        </label>
      </div>

      <div className="lobby-list">
        {lobbies.length === 0 ? (
          <p className="muted">No lobbies available.</p>
        ) : (
          lobbies.map((lobby) => {
            const playerJoinDisabled = slot === "player" && lobby.status === "playing";
            return (
              <form className="lobby-row" key={lobby.roomId} onSubmit={(event) => void handleJoin(lobby.roomId, event)}>
                <div>
                  <strong>{lobby.name}</strong>
                  <span>
                    {lobby.status} - {lobby.playerCount} players - {lobby.spectatorCount} spectators
                  </span>
                </div>
                <button
                  className="primary-action"
                  disabled={playerJoinDisabled || joiningRoomId === lobby.roomId}
                  type="submit"
                >
                  {joiningRoomId === lobby.roomId ? "Joining" : "Join"}
                </button>
              </form>
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
  );
}
