export type MapMakerTool = "select" | "rectangle" | "triangle" | "circle" | "pen" | "spawn" | "team-a" | "team-b";
export type PlacementTool = "rectangle" | "triangle" | "circle" | "spawn";
export type TeamTool = "team-a" | "team-b";

const placementTools = new Set<MapMakerTool>(["rectangle", "triangle", "circle", "spawn"]);

export function placementToolFromPointer(tool: MapMakerTool, button: number): PlacementTool | undefined {
  if (button !== 2 || !placementTools.has(tool)) {
    return undefined;
  }
  return tool as PlacementTool;
}

export function shouldSelectFromPointer(options: { button: number; isSpaceDown: boolean }): boolean {
  return options.button === 0 && !options.isSpaceDown;
}

export function shouldDrawPenPointFromPointer(tool: MapMakerTool, button: number): boolean {
  return tool === "pen" && button === 0;
}

export function shouldAssignTeamFromPointer(tool: MapMakerTool, button: number): tool is TeamTool {
  return button === 0 && (tool === "team-a" || tool === "team-b");
}
