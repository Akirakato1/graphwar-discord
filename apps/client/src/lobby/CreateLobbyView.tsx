import { useEffect, useState, type FormEvent } from "react";
import type { GuildSettings, LobbySlot, MatchModeId } from "@graphwar/shared";

type CreateLobbyViewProps = {
  defaultAlias: string;
  onBack: () => void;
  onCreate: (form: { name: string; alias: string; mode: MatchModeId; initialSlot: LobbySlot }) => Promise<void>;
  settings?: GuildSettings;
};

type CreateLobbyForm = {
  name: string;
  alias: string;
  mode: MatchModeId;
  initialSlot: LobbySlot;
};

export function prepareCreateLobbyForm(form: CreateLobbyForm): { form: CreateLobbyForm } {
  return {
    form: {
      ...form,
      name: form.name.trim(),
      alias: form.alias.trim()
    }
  };
}

export function createLobbyErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not create lobby.";
}

export function availableInitialSlots(settings?: Pick<GuildSettings, "allowSpectators">): LobbySlot[] {
  return settings?.allowSpectators === false ? ["player"] : ["player", "spectator"];
}

export function createLobbyInitialForm(defaultAlias: string, settings?: Pick<GuildSettings, "defaultMode" | "allowSpectators">): CreateLobbyForm {
  return {
    name: "Graphwar Lobby",
    alias: defaultAlias,
    mode: settings?.defaultMode ?? "team-versus",
    initialSlot: availableInitialSlots(settings)[0]
  };
}

export function CreateLobbyView({ defaultAlias, onBack, onCreate, settings }: CreateLobbyViewProps) {
  const initialForm = createLobbyInitialForm(defaultAlias, settings);
  const [alias, setAlias] = useState(initialForm.alias);
  const [formError, setFormError] = useState<string | undefined>();
  const [initialSlot, setInitialSlot] = useState<LobbySlot>(initialForm.initialSlot);
  const [mode, setMode] = useState<MatchModeId>(initialForm.mode);
  const [name, setName] = useState(initialForm.name);
  const [submitting, setSubmitting] = useState(false);
  const slots = availableInitialSlots(settings);

  useEffect(() => {
    setMode(settings?.defaultMode ?? "team-versus");
    setInitialSlot((currentSlot) => (availableInitialSlots(settings).includes(currentSlot) ? currentSlot : "player"));
  }, [settings?.allowSpectators, settings?.defaultMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setFormError(undefined);
    try {
      await onCreate(prepareCreateLobbyForm({ name, alias, mode, initialSlot }).form);
    } catch (error) {
      setFormError(createLobbyErrorMessage(error));
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
      {formError && (
        <p className="notice" role="alert">
          {formError}
        </p>
      )}
      <form className="menu-form" onSubmit={handleSubmit}>
        <label>
          Lobby name
          <input
            required
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setFormError(undefined);
            }}
          />
        </label>
        <label>
          Alias
          <input
            required
            value={alias}
            onChange={(event) => {
              setAlias(event.currentTarget.value);
              setFormError(undefined);
            }}
          />
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
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {slot === "player" ? "Player" : "Spectator"}
              </option>
            ))}
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
