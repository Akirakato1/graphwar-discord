import { useState, type FormEvent } from "react";
import type { LobbySlot, MatchModeId } from "@graphwar/shared";

type CreateLobbyViewProps = {
  defaultAlias: string;
  onBack: () => void;
  onCreate: (form: { name: string; alias: string; mode: MatchModeId; initialSlot: LobbySlot }) => Promise<void>;
};

export function CreateLobbyView({ defaultAlias, onBack, onCreate }: CreateLobbyViewProps) {
  const [alias, setAlias] = useState(defaultAlias);
  const [initialSlot, setInitialSlot] = useState<LobbySlot>("player");
  const [mode, setMode] = useState<MatchModeId>("team-versus");
  const [name, setName] = useState("Graphwar Lobby");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({ name, alias, mode, initialSlot });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel menu-panel" aria-labelledby="create-lobby-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">New lobby</p>
          <h2 id="create-lobby-title">Create Lobby</h2>
        </div>
      </div>
      <form className="menu-form" onSubmit={handleSubmit}>
        <label>
          Lobby name
          <input required value={name} onChange={(event) => setName(event.currentTarget.value)} />
        </label>
        <label>
          Alias
          <input required value={alias} onChange={(event) => setAlias(event.currentTarget.value)} />
        </label>
        <label>
          Match mode
          <select value={mode} onChange={(event) => setMode(event.currentTarget.value as MatchModeId)}>
            <option value="team-versus">Team Versus</option>
            <option value="free-for-all">Free For All</option>
          </select>
        </label>
        <label>
          Initial slot
          <select value={initialSlot} onChange={(event) => setInitialSlot(event.currentTarget.value as LobbySlot)}>
            <option value="player">Player</option>
            <option value="spectator">Spectator</option>
          </select>
        </label>
        <div className="form-actions">
          <button className="secondary-action" onClick={onBack} type="button">
            Back
          </button>
          <button className="primary-action" disabled={submitting} type="submit">
            {submitting ? "Creating" : "Create"}
          </button>
        </div>
      </form>
    </section>
  );
}
