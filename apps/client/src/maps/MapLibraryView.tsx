import { useRef, useState, type ChangeEvent } from "react";
import type { CustomMapSummary } from "@graphwar/shared";

type MapLibraryViewProps = {
  currentDiscordUserId: string;
  customMaps: CustomMapSummary[];
  onBack: () => void;
  onDelete: (mapId: string) => Promise<void>;
  onImportText: (text: string) => Promise<void>;
};

export function MapLibraryView({
  currentDiscordUserId,
  customMaps,
  onBack,
  onDelete,
  onImportText
}: MapLibraryViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | undefined>();
  const [workingMapId, setWorkingMapId] = useState<string | undefined>();
  const [importing, setImporting] = useState(false);

  async function importFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    setMessage(undefined);
    try {
      await onImportText(await file.text());
      setMessage("Custom map saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import custom map.");
    } finally {
      input.value = "";
      setImporting(false);
    }
  }

  async function deleteMap(mapId: string): Promise<void> {
    setWorkingMapId(mapId);
    setMessage(undefined);
    try {
      await onDelete(mapId);
      setMessage("Custom map deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete custom map.");
    } finally {
      setWorkingMapId(undefined);
    }
  }

  return (
    <section className="map-library-screen" aria-labelledby="custom-maps-title">
      <div className="panel map-library-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Guild library</p>
            <h2 id="custom-maps-title">Custom Maps</h2>
          </div>
          <button className="secondary-action" onClick={onBack} type="button">
            Back
          </button>
        </div>

        <div className="map-library-import">
          <input
            accept=".graphwar-map.json,application/json,.json"
            aria-label="Custom map file"
            onChange={(event) => void importFile(event)}
            ref={fileInputRef}
            type="file"
          />
          <button
            className="primary-action"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {importing ? "Loading" : "Load Custom Map"}
          </button>
        </div>

        {message ? (
          <p className="notice" role="status">
            {message}
          </p>
        ) : null}

        {customMaps.length === 0 ? (
          <p className="map-library-empty">No custom maps yet.</p>
        ) : (
          <ul className="map-library-list">
            {customMaps.map((map) => {
              const owned = map.ownerDiscordUserId === currentDiscordUserId;
              return (
                <li key={map.id}>
                  <div>
                    <strong>{map.name}</strong>
                    <span>{owned ? "Owned by you" : "Guild map"}</span>
                  </div>
                  {owned ? (
                    <button
                      className="secondary-action"
                      disabled={workingMapId === map.id}
                      onClick={() => void deleteMap(map.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
