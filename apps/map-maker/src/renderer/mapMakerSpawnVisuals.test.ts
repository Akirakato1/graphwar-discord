import { describe, expect, it } from "vitest";
import type { EditorState } from "../editor/editorTypes";
import { isSpawnSelected, spawnClassName } from "./mapMakerSpawnVisuals";

describe("mapMakerSpawnVisuals", () => {
  it("keeps team fill classes while marking selected spawns with a separate ring", () => {
    const state = spawnVisualState({
      selection: { type: "spawn", id: "spawn-1" },
      teamSpawnPointIds: {
        "team-a": ["spawn-1"],
        "team-b": []
      }
    });

    expect(spawnClassName(state, "spawn-1")).toBe("team-a");
    expect(isSpawnSelected(state, "spawn-1")).toBe(true);
  });

  it("does not add a fill-changing selected class to unassigned selected spawns", () => {
    const state = spawnVisualState({
      selection: { type: "spawn", id: "spawn-1" },
      teamSpawnPointIds: {
        "team-a": [],
        "team-b": []
      }
    });

    expect(spawnClassName(state, "spawn-1")).toBe("");
    expect(isSpawnSelected(state, "spawn-1")).toBe(true);
  });

  it("marks spawns as selected when they are part of a multi-selection", () => {
    const state = spawnVisualState({
      selection: {
        type: "multi",
        items: [
          { type: "terrain", id: "terrain-1" },
          { type: "spawn", id: "spawn-1" }
        ]
      },
      teamSpawnPointIds: {
        "team-a": [],
        "team-b": ["spawn-1"]
      }
    });

    expect(spawnClassName(state, "spawn-1")).toBe("team-b");
    expect(isSpawnSelected(state, "spawn-1")).toBe(true);
  });
});

function spawnVisualState(
  options: Pick<EditorState, "selection" | "teamSpawnPointIds">
): Pick<EditorState, "selection" | "teamSpawnPointIds"> {
  return options;
}
