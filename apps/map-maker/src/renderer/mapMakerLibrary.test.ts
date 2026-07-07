import { worldBoundsForMapSize, type CustomMapImport } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import {
  currentFileForSavedMap,
  editorStateFromSavedMap,
  importMapFileForSave,
  newMapNameError,
  saveMapNameError,
  saveRequestForEditorState,
  type SavedMapSummary
} from "./mapMakerLibrary";

const savedMaps: SavedMapSummary[] = [
  { filePath: "C:/maps/moon.graphwar-map.json", name: "Moon Arena", updatedAt: "2026-07-07T00:00:00.000Z" },
  { filePath: "C:/maps/sun.graphwar-map.json", name: "Sun Arena", updatedAt: "2026-07-07T00:00:00.000Z" }
];

describe("mapMakerLibrary", () => {
  it("requires new maps to have a non-clashing name", () => {
    expect(newMapNameError("", savedMaps)).toBe("Enter a map name.");
    expect(newMapNameError(" moon arena ", savedMaps)).toBe("A saved map already uses this name.");
    expect(newMapNameError("New Arena", savedMaps)).toBeUndefined();
  });

  it("allows opened maps to keep their current name while blocking clashes with other files", () => {
    const currentFile = currentFileForSavedMap(savedMaps[0]);

    expect(saveMapNameError("Moon Arena", savedMaps, currentFile)).toBeUndefined();
    expect(saveMapNameError("Sun Arena", savedMaps, currentFile)).toBe("A saved map already uses this name.");
  });

  it("overwrites the current file only while the edited name still matches the opened file", () => {
    const currentFile = currentFileForSavedMap(savedMaps[0]);

    expect(saveRequestForEditorState({ mapName: "Moon Arena" }, currentFile, "{}")).toEqual({
      contents: "{}",
      filePath: "C:/maps/moon.graphwar-map.json",
      mapName: "Moon Arena"
    });
    expect(saveRequestForEditorState({ mapName: "Moon Arena Copy" }, currentFile, "{}")).toEqual({
      contents: "{}",
      mapName: "Moon Arena Copy"
    });
  });

  it("loads saved map JSON back into editable state", () => {
    const map: CustomMapImport = {
      format: "graphwar-map",
      version: 1,
      name: "Loaded Arena",
      worldBounds: worldBoundsForMapSize("large"),
      terrain: {
        blobs: [
          {
            id: "rock",
            outer: [
              { x: -2, y: -1 },
              { x: 2, y: -1 },
              { x: 0, y: 2 }
            ],
            holes: []
          }
        ]
      },
      spawnPoints: Array.from({ length: 10 }, (_, index) => ({
        id: `spawn-${index}`,
        position: { x: index - 5, y: 0 }
      })),
      teamSpawnPointIds: {
        "team-a": ["spawn-0"],
        "team-b": ["spawn-1"]
      }
    };

    const state = editorStateFromSavedMap(map);

    expect(state.mapName).toBe("Loaded Arena");
    expect(state.worldBounds).toEqual(worldBoundsForMapSize("large"));
    expect(state.terrainShapes).toEqual([{ id: "rock", points: map.terrain.blobs[0].outer }]);
    expect(state.spawnPoints).toHaveLength(10);
    expect(state.teamSpawnPointIds).toEqual(map.teamSpawnPointIds);
  });

  it("prepares an imported map file for saving into the managed library", () => {
    const map: CustomMapImport = {
      format: "graphwar-map",
      version: 1,
      name: "Imported Arena",
      worldBounds: worldBoundsForMapSize("standard"),
      terrain: { blobs: [] },
      spawnPoints: Array.from({ length: 10 }, (_, index) => ({
        id: `spawn-${index}`,
        position: { x: index, y: 0 }
      })),
      teamSpawnPointIds: {
        "team-a": [],
        "team-b": []
      }
    };

    const imported = importMapFileForSave(JSON.stringify(map), savedMaps);

    expect(imported).toEqual({
      map,
      request: {
        contents: `${JSON.stringify(map, null, 2)}\n`,
        mapName: "Imported Arena"
      }
    });
  });

  it("blocks imported map files when their map name already exists", () => {
    const map: CustomMapImport = {
      format: "graphwar-map",
      version: 1,
      name: "Moon Arena",
      worldBounds: worldBoundsForMapSize("standard"),
      terrain: { blobs: [] },
      spawnPoints: Array.from({ length: 10 }, (_, index) => ({
        id: `spawn-${index}`,
        position: { x: index, y: 0 }
      })),
      teamSpawnPointIds: {
        "team-a": [],
        "team-b": []
      }
    };

    expect(importMapFileForSave(JSON.stringify(map), savedMaps)).toEqual({
      error: "A saved map already uses this name."
    });
  });
});
