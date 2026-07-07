import type { EditorState } from "../editor/editorTypes";
import { isItemSelected } from "../editor/editorModel";

type SpawnVisualState = Pick<EditorState, "selection" | "teamSpawnPointIds">;

export function isSpawnSelected(state: SpawnVisualState, spawnId: string): boolean {
  return isItemSelected(state.selection, { type: "spawn", id: spawnId });
}

export function spawnClassName(state: SpawnVisualState, spawnId: string): string {
  if (state.teamSpawnPointIds["team-a"].includes(spawnId)) {
    return "team-a";
  }
  if (state.teamSpawnPointIds["team-b"].includes(spawnId)) {
    return "team-b";
  }
  return "";
}
