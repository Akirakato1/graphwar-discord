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
});

function spawnVisualState(
  options: Pick<EditorState, "selection" | "teamSpawnPointIds">
): Pick<EditorState, "selection" | "teamSpawnPointIds"> {
  return options;
}
