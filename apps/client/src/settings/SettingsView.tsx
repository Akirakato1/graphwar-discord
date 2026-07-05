import { useEffect, useState, type FormEvent } from "react";
import type { GuildSettings, MatchModeId } from "@graphwar/shared";

type SettingsViewProps = {
  onBack: () => void;
  onLoad: () => Promise<void>;
  onSave: (settings: GuildSettings) => Promise<void>;
  settings?: GuildSettings;
};

export function SettingsView({ onBack, onLoad, onSave, settings }: SettingsViewProps) {
  const [allowSpectators, setAllowSpectators] = useState(settings?.allowSpectators ?? true);
  const [defaultMode, setDefaultMode] = useState<MatchModeId>(settings?.defaultMode ?? "team-versus");
  const [loadError, setLoadError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function loadSettings(): Promise<void> {
    setLoadError(undefined);
    try {
      await onLoad();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load settings.");
    }
  }

  useEffect(() => {
    void loadSettings();
  }, [onLoad]);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setAllowSpectators(settings.allowSpectators);
    setDefaultMode(settings.defaultMode);
  }, [settings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!settings) {
      return;
    }

    setSaving(true);
    setSaveError(undefined);
    try {
      await onSave({ ...settings, defaultMode, allowSpectators });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-screen">
      <section className="panel menu-panel" aria-labelledby="settings-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Guild defaults</p>
            <h2 id="settings-title">Settings</h2>
          </div>
        </div>
        {(loadError || saveError) && (
          <p className="notice" role="alert">
            {saveError ?? loadError}
          </p>
        )}
        <form className="menu-form" onSubmit={handleSubmit}>
          <label>
            Default mode
            <select value={defaultMode} onChange={(event) => setDefaultMode(event.currentTarget.value as MatchModeId)}>
              <option value="team-versus">Team Versus</option>
              <option value="free-for-all">Free For All</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              checked={allowSpectators}
              onChange={(event) => setAllowSpectators(event.currentTarget.checked)}
              type="checkbox"
            />
            Allow spectators
          </label>
          <div className="form-actions">
            <button className="secondary-action" onClick={onBack} type="button">
              Back
            </button>
            <button className="primary-action" disabled={!settings || saving} type="submit">
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
