import { useEffect, useState, type FormEvent } from "react";
import {
  damagePerHitBounds,
  defaultMapSizePreset,
  defaultLobbyGameplaySettings,
  defaultPlayerColor,
  normalizeDamagePerHit,
  playerColorPalette,
  type CustomMapSummary,
  type GuildSettings,
  type LobbySlot,
  type MapSizePresetId,
  type MatchModeId,
  type PlayerColor
} from "@graphwar/shared";

const fallbackPlayerColorPalette = [
  "#4cc9f0",
  "#f72585",
  "#ffd166",
  "#06d6a0",
  "#f77f00",
  "#b5179e",
  "#90be6d",
  "#577590",
  "#f94144",
  "#43aa8b"
] as const satisfies readonly string[];

export const lobbyPlayerColorPalette =
  Array.isArray(playerColorPalette) && playerColorPalette.length === 10
    ? playerColorPalette
    : (fallbackPlayerColorPalette as readonly PlayerColor[]);

export const lobbyDefaultPlayerColor =
  defaultPlayerColor ?? (lobbyPlayerColorPalette[0] as PlayerColor);

const MIN_FUNCTION_LENGTH = 20;
const MAX_FUNCTION_LENGTH = 100;
const DEFAULT_FUNCTION_LENGTH = 50;

type CreateLobbyViewProps = {
  customMaps?: CustomMapSummary[];
  defaultAlias: string;
  onBack: () => void;
  onCreate: (form: {
    name: string;
    alias: string;
    mode: MatchModeId;
    initialSlot: LobbySlot;
    color: PlayerColor;
    maxFunctionLength: number;
    damagePerHit: number;
    uniqueFunctionHits: boolean;
    friendlyFire: boolean;
    advancedFunctions: boolean;
    mapId?: string;
    mapSizePreset?: MapSizePresetId;
  }) => Promise<void>;
  settings?: GuildSettings;
};

type CreateLobbyForm = {
  name: string;
  alias: string;
  mode: MatchModeId;
  initialSlot: LobbySlot;
  color: PlayerColor;
  maxFunctionLength: number;
  damagePerHit: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  advancedFunctions: boolean;
  mapId?: string;
  mapSizePreset?: MapSizePresetId;
};

function boundedFunctionLength(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_FUNCTION_LENGTH;
  }

  return Math.min(MAX_FUNCTION_LENGTH, Math.max(MIN_FUNCTION_LENGTH, Math.round(value)));
}

export function prepareCreateLobbyForm(form: CreateLobbyForm): { form: CreateLobbyForm } {
  const { mapSizePreset, ...rest } = form;

  return {
    form: {
      ...rest,
      name: form.name.trim(),
      alias: form.alias.trim(),
      maxFunctionLength: boundedFunctionLength(form.maxFunctionLength),
      damagePerHit: normalizeDamagePerHit(form.damagePerHit),
      uniqueFunctionHits: form.uniqueFunctionHits,
      friendlyFire: form.mode === "team-versus" ? form.friendlyFire : false,
      advancedFunctions: form.advancedFunctions,
      ...(form.mapId ? {} : { mapSizePreset: mapSizePreset ?? defaultMapSizePreset })
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
    initialSlot: availableInitialSlots(settings)[0],
    color: lobbyDefaultPlayerColor,
    maxFunctionLength: DEFAULT_FUNCTION_LENGTH,
    damagePerHit: defaultLobbyGameplaySettings.damagePerHit,
    uniqueFunctionHits: defaultLobbyGameplaySettings.uniqueFunctionHits,
    friendlyFire: defaultLobbyGameplaySettings.friendlyFire,
    advancedFunctions: defaultLobbyGameplaySettings.advancedFunctions,
    mapSizePreset: defaultMapSizePreset
  };
}

export function CreateLobbyView({ customMaps = [], defaultAlias, onBack, onCreate, settings }: CreateLobbyViewProps) {
  const initialForm = createLobbyInitialForm(defaultAlias, settings);
  const [alias, setAlias] = useState(initialForm.alias);
  const [color, setColor] = useState<PlayerColor>(initialForm.color);
  const [formError, setFormError] = useState<string | undefined>();
  const [initialSlot, setInitialSlot] = useState<LobbySlot>(initialForm.initialSlot);
  const [mapId, setMapId] = useState("");
  const [mapSizePreset, setMapSizePreset] = useState<MapSizePresetId>(initialForm.mapSizePreset ?? defaultMapSizePreset);
  const [maxFunctionLength, setMaxFunctionLength] = useState(initialForm.maxFunctionLength);
  const [damagePerHit, setDamagePerHit] = useState(initialForm.damagePerHit);
  const [uniqueFunctionHits, setUniqueFunctionHits] = useState(initialForm.uniqueFunctionHits);
  const [friendlyFire, setFriendlyFire] = useState(initialForm.friendlyFire);
  const [advancedFunctions, setAdvancedFunctions] = useState(initialForm.advancedFunctions);
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
      await onCreate(
        prepareCreateLobbyForm({
          name,
          alias,
          mode,
          initialSlot,
          color,
          maxFunctionLength,
          damagePerHit,
          uniqueFunctionHits,
          friendlyFire,
          advancedFunctions,
          ...(mapId ? { mapId } : { mapSizePreset })
        }).form
      );
    } catch (error) {
      setFormError(createLobbyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="menu-screen">
      <section className="panel menu-panel create-lobby-panel" aria-labelledby="create-lobby-title">
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
      <form className="menu-form create-lobby-form" onSubmit={handleSubmit}>
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
        <fieldset className="color-selector">
          <legend>Color</legend>
          <div className="color-options">
            {lobbyPlayerColorPalette.map((option) => (
              <label key={option} title={option}>
                <input
                  aria-label={`Choose color ${option}`}
                  checked={color === option}
                  name="player-color"
                  onChange={() => setColor(option)}
                  type="radio"
                  value={option}
                />
                <span className="color-swatch" style={{ backgroundColor: option }} />
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Max function length
          <input
            max={MAX_FUNCTION_LENGTH}
            min={MIN_FUNCTION_LENGTH}
            type="number"
            value={maxFunctionLength}
            onChange={(event) => {
              setMaxFunctionLength(Number(event.currentTarget.value));
              setFormError(undefined);
            }}
          />
        </label>
        <label>
          Damage
          <input
            max={damagePerHitBounds.max}
            min={damagePerHitBounds.min}
            type="number"
            value={damagePerHit}
            onChange={(event) => {
              setDamagePerHit(Number(event.currentTarget.value));
              setFormError(undefined);
            }}
          />
        </label>
        <label className="toggle-row">
          <input
            checked={uniqueFunctionHits}
            onChange={(event) => {
              setUniqueFunctionHits(event.currentTarget.checked);
              setFormError(undefined);
            }}
            type="checkbox"
          />
          Unique function hits
        </label>
        <label className="toggle-row">
          <input
            checked={advancedFunctions}
            onChange={(event) => {
              setAdvancedFunctions(event.currentTarget.checked);
              setFormError(undefined);
            }}
            type="checkbox"
          />
          Advanced functions
        </label>
        {mode === "team-versus" ? (
          <label className="toggle-row">
            <input
              checked={friendlyFire}
              onChange={(event) => {
                setFriendlyFire(event.currentTarget.checked);
                setFormError(undefined);
              }}
              type="checkbox"
            />
            Friendly fire
          </label>
        ) : null}
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
        <label>
          Map
          <select className="map-select" value={mapId} onChange={(event) => setMapId(event.currentTarget.value)}>
            <option value="">Default Map</option>
            {customMaps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
        </label>
        {!mapId ? (
          <label>
            Map size
            <select
              value={mapSizePreset}
              onChange={(event) => setMapSizePreset(event.currentTarget.value as MapSizePresetId)}
            >
              <option value="small">Small</option>
              <option value="standard">Standard</option>
              <option value="large">Large</option>
              <option value="huge">Huge</option>
            </select>
          </label>
        ) : null}
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
    </div>
  );
}
