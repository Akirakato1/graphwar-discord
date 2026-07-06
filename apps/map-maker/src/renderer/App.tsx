import {
  defaultMapSizePreset,
  mapSizePresets,
  worldBoundsForMapSize,
  type CustomMapTeamId,
  type MapSizePresetId,
  type WorldPoint
} from "@graphwar/shared";
import { useMemo, useState, type MouseEvent, type PointerEvent } from "react";
import {
  addDefaultSpawnSet,
  addCircleTerrain,
  addPenPoint,
  addRectangleTerrain,
  addSpawnPoint,
  addTriangleTerrain,
  closePenShape,
  createEmptyEditorState,
  deleteSelected,
  getTerrainBounds,
  moveSelected,
  removeMostRecentPenPoint,
  resizeSelectedTerrain,
  selectAtPoint,
  selectItem,
  toggleTeamSpawn
} from "../editor/editorModel";
import type { Bounds, EditorState } from "../editor/editorTypes";
import { stringifyEditorMap } from "../editor/mapExport";
import { createViewBoxGeometry, screenPointToWorldPoint } from "./viewBoxGeometry";

type Tool = "select" | "rectangle" | "triangle" | "circle" | "pen" | "spawn" | "team-a" | "team-b";
type ResizeHandle = "nw" | "ne" | "se" | "sw";
type DragState =
  | {
      type: "move";
      lastPoint: WorldPoint;
    }
  | {
      type: "resize";
      handle: ResizeHandle;
      shapeId: string;
    }
  | null;

type SetupDraft = {
  mapName: string;
  mapSizePreset: MapSizePresetId;
};

const tools: Array<{ id: Tool; label: string }> = [
  { id: "select", label: "Select" },
  { id: "rectangle", label: "Rect" },
  { id: "triangle", label: "Tri" },
  { id: "circle", label: "Circle" },
  { id: "pen", label: "Pen" },
  { id: "spawn", label: "Spawn" },
  { id: "team-a", label: "Team A" },
  { id: "team-b", label: "Team B" }
];

export function App() {
  const [setupDraft, setSetupDraft] = useState<SetupDraft>({
    mapName: "Custom Arena",
    mapSizePreset: defaultMapSizePreset
  });
  const [state, setState] = useState<EditorState | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [drag, setDrag] = useState<DragState>(null);
  const [message, setMessage] = useState("Ready");

  const selectedTerrain = useMemo(() => {
    if (state?.selection?.type !== "terrain") {
      return undefined;
    }
    return state.terrainShapes.find((shape) => shape.id === state.selection?.id);
  }, [state]);

  const selectedBounds = selectedTerrain ? getTerrainBounds(selectedTerrain) : undefined;
  const viewGeometry = state ? createViewBoxGeometry(state.worldBounds) : undefined;

  if (!state || !viewGeometry) {
    return (
      <main className="map-maker-setup-screen">
        <form
          className="map-maker-setup-panel"
          onSubmit={(event) => {
            event.preventDefault();
            setState(
              createEmptyEditorState({
                mapName: setupDraft.mapName,
                worldBounds: worldBoundsForMapSize(setupDraft.mapSizePreset)
              })
            );
            setMessage("Ready");
          }}
        >
          <h1>Map Maker</h1>
          <label className="setup-field">
            <span>Map name</span>
            <input
              className="map-name-input"
              onChange={(event) => setSetupDraft((current) => ({ ...current, mapName: event.currentTarget.value }))}
              value={setupDraft.mapName}
            />
          </label>
          <div className="setup-field">
            <span>Map size</span>
            <div className="size-preset-strip" role="group" aria-label="Map size preset">
              {mapSizePresets.map((preset) => (
                <button
                  className={setupDraft.mapSizePreset === preset.id ? "active" : ""}
                  key={preset.id}
                  onClick={() => setSetupDraft((current) => ({ ...current, mapSizePreset: preset.id }))}
                  type="button"
                >
                  {titleCase(preset.id)}
                </button>
              ))}
            </div>
          </div>
          <p className="setup-size-readout">
            {boundsLabel(worldBoundsForMapSize(setupDraft.mapSizePreset))}
          </p>
          <button className="primary-action" type="submit">
            Start Editor
          </button>
        </form>
      </main>
    );
  }

  const editorState = state;
  const editorViewGeometry = viewGeometry;

  function updateState(updater: (current: EditorState) => EditorState) {
    setState((current) => (current ? updater(current) : current));
  }

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    if (drag) {
      return;
    }

    const point = eventToWorldPoint(event, editorState.worldBounds);
    if (tool === "rectangle") {
      updateState((current) => addRectangleTerrain(current, point, 7, 3.5));
      return;
    }
    if (tool === "triangle") {
      updateState((current) => addTriangleTerrain(current, point, 7, 5));
      return;
    }
    if (tool === "circle") {
      updateState((current) => addCircleTerrain(current, point, 3.5, 28));
      return;
    }
    if (tool === "spawn") {
      updateState((current) => addSpawnPoint(current, point));
      return;
    }
    if (tool === "pen") {
      updateState((current) => {
        if (current.penPoints.length >= 3 && distance(current.penPoints[0], point) < 0.9) {
          return closePenShape(current);
        }
        return addPenPoint(current, point);
      });
    }
  }

  function handleCanvasPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (tool !== "select") {
      return;
    }

    const point = eventToWorldPoint(event, editorState.worldBounds);
    const selected = selectAtPoint(editorState, point);
    setState(selected);
    if (selected.selection) {
      setDrag({ type: "move", lastPoint: point });
    }
  }

  function handleCanvasPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag) {
      return;
    }

    const point = eventToWorldPoint(event, editorState.worldBounds);
    if (drag.type === "move") {
      const delta = { x: point.x - drag.lastPoint.x, y: point.y - drag.lastPoint.y };
      updateState((current) => moveSelected(current, delta));
      setDrag({ type: "move", lastPoint: point });
      return;
    }

    updateState((current) => {
      const shape = current.terrainShapes.find((item) => item.id === drag.shapeId);
      if (!shape) {
        return current;
      }
      return resizeSelectedTerrain(selectItem(current, { type: "terrain", id: shape.id }), boundsFromHandle(shape, drag.handle, point));
    });
  }

  function handlePointerEnd() {
    setDrag(null);
  }

  function handleContextMenu(event: MouseEvent<SVGSVGElement>) {
    if (tool !== "pen") {
      return;
    }
    event.preventDefault();
    updateState((current) => removeMostRecentPenPoint(current));
  }

  function assignSpawnTeam(spawnId: string, teamId: CustomMapTeamId) {
    updateState((current) => toggleTeamSpawn(current, spawnId, teamId));
  }

  function addTenSpawns() {
    updateState((current) => addDefaultSpawnSet(current));
  }

  async function exportMap() {
    try {
      const contents = stringifyEditorMap(editorState);
      const result = await window.graphwarMapMaker?.saveMap({
        defaultPath: `${slugify(editorState.mapName || "custom-arena")}.graphwar-map.json`,
        contents
      });
      setMessage(result?.canceled ? "Export canceled" : `Saved ${result?.filePath ?? "map file"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed");
    }
  }

  return (
    <main className="map-maker-shell">
      <header className="map-maker-toolbar">
        <input
          aria-label="Map name"
          className="map-name-input"
          onChange={(event) => updateState((current) => ({ ...current, mapName: event.currentTarget.value }))}
          value={editorState.mapName}
        />
        <div aria-label="Tools" className="tool-strip">
          {tools.map((item) => (
            <button
              className={tool === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setTool(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button onClick={() => updateState((current) => closePenShape(current))} type="button">
          Close Pen
        </button>
        <button onClick={addTenSpawns} type="button">
          10 Spawns
        </button>
        <button onClick={() => updateState((current) => deleteSelected(current))} type="button">
          Delete
        </button>
        <button className="primary-action" onClick={() => void exportMap()} type="button">
          Export
        </button>
      </header>

      <section className="map-maker-body">
        <aside className="map-maker-sidebar" aria-label="Map status">
          <Stat label="Terrain" value={editorState.terrainShapes.length} />
          <Stat label="Spawns" value={editorState.spawnPoints.length} />
          <Stat label="Team A" value={editorState.teamSpawnPointIds["team-a"].length} />
          <Stat label="Team B" value={editorState.teamSpawnPointIds["team-b"].length} />
          <p className="status-message">{message}</p>
          <p className="compact-help">Left click places with the active tool. In Pen mode, click near the first node to close or right click to undo the latest node.</p>
        </aside>

        <section className="map-maker-canvas" aria-label="Map canvas">
          <svg
            onClick={handleCanvasClick}
            onContextMenu={handleContextMenu}
            onPointerDown={handleCanvasPointerDown}
            onPointerLeave={handlePointerEnd}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handlePointerEnd}
            role="img"
            viewBox={editorViewGeometry.viewBox}
          >
            <rect
              className="world-bg"
              height={editorViewGeometry.worldHeight}
              width={editorViewGeometry.worldWidth}
              x={editorState.worldBounds.minX}
              y={editorViewGeometry.minSvgY}
            />
            <g className="grid-lines">
              {Array.from({ length: Math.round(editorViewGeometry.worldWidth / 5) + 1 }, (_, index) => {
                const x = editorState.worldBounds.minX + index * 5;
                return <line key={`x-${x}`} x1={x} x2={x} y1={editorViewGeometry.minSvgY} y2={editorViewGeometry.maxSvgY} />;
              })}
              {Array.from({ length: Math.round(editorViewGeometry.worldHeight / 5) + 1 }, (_, index) => {
                const y = editorViewGeometry.minSvgY + index * 5;
                return <line key={`y-${y}`} x1={editorState.worldBounds.minX} x2={editorState.worldBounds.maxX} y1={y} y2={y} />;
              })}
            </g>
            <line className="axis-line" x1={editorState.worldBounds.minX} x2={editorState.worldBounds.maxX} y1={0} y2={0} />
            <line className="axis-line" x1={0} x2={0} y1={editorViewGeometry.minSvgY} y2={editorViewGeometry.maxSvgY} />

            {editorState.terrainShapes.map((shape) => (
              <path
                className={editorState.selection?.type === "terrain" && editorState.selection.id === shape.id ? "terrain-shape selected" : "terrain-shape"}
                d={shapePath(shape.points)}
                key={shape.id}
                onPointerDown={(event) => {
                  if (tool === "select") {
                    event.stopPropagation();
                    const point = eventToWorldPoint(event, editorState.worldBounds);
                    updateState((current) => selectItem(current, { type: "terrain", id: shape.id }));
                    setDrag({ type: "move", lastPoint: point });
                  }
                }}
              />
            ))}

            {editorState.penPoints.length > 0 ? (
              <g>
                <polyline className="pen-line" fill="none" points={editorState.penPoints.map(svgPoint).join(" ")} />
                {editorState.penPoints.map((point, index) => (
                  <circle className="pen-node" cx={point.x} cy={-point.y} key={`${point.x}-${point.y}-${index}`} r="0.28" />
                ))}
              </g>
            ) : null}

            {editorState.spawnPoints.map((spawn) => (
              <circle
                className={`spawn ${spawnClass(editorState, spawn.id)}`}
                cx={spawn.position.x}
                cy={-spawn.position.y}
                key={spawn.id}
                onClick={(event) => {
                  if (tool === "team-a" || tool === "team-b") {
                    event.stopPropagation();
                    assignSpawnTeam(spawn.id, tool);
                  }
                }}
                onPointerDown={(event) => {
                  if (tool === "select") {
                    event.stopPropagation();
                    const point = eventToWorldPoint(event, editorState.worldBounds);
                    updateState((current) => selectItem(current, { type: "spawn", id: spawn.id }));
                    setDrag({ type: "move", lastPoint: point });
                  }
                }}
                r="0.55"
              />
            ))}

            {selectedBounds && selectedTerrain ? (
              <TransformBox
                bounds={selectedBounds}
                onHandlePointerDown={(handle) => setDrag({ type: "resize", handle, shapeId: selectedTerrain.id })}
              />
            ) : null}
          </svg>
        </section>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="map-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TransformBox({
  bounds,
  onHandlePointerDown
}: {
  bounds: Bounds;
  onHandlePointerDown: (handle: ResizeHandle) => void;
}) {
  const handles: Array<{ handle: ResizeHandle; point: WorldPoint }> = [
    { handle: "nw", point: { x: bounds.minX, y: bounds.maxY } },
    { handle: "ne", point: { x: bounds.maxX, y: bounds.maxY } },
    { handle: "se", point: { x: bounds.maxX, y: bounds.minY } },
    { handle: "sw", point: { x: bounds.minX, y: bounds.minY } }
  ];

  return (
    <g className="transform-box">
      <rect
        height={bounds.maxY - bounds.minY}
        width={bounds.maxX - bounds.minX}
        x={bounds.minX}
        y={-bounds.maxY}
      />
      {handles.map(({ handle, point }) => (
        <circle
          cx={point.x}
          cy={-point.y}
          key={handle}
          onPointerDown={(event) => {
            event.stopPropagation();
            onHandlePointerDown(handle);
          }}
          r="0.42"
        />
      ))}
    </g>
  );
}

function eventToWorldPoint(
  event: MouseEvent<SVGSVGElement | SVGPathElement | SVGCircleElement> | PointerEvent<SVGSVGElement | SVGPathElement | SVGCircleElement>,
  worldBounds: EditorState["worldBounds"]
): WorldPoint {
  const svg = event.currentTarget.ownerSVGElement ?? (event.currentTarget as SVGSVGElement);
  return screenPointToWorldPoint({ x: event.clientX, y: event.clientY }, svg.getBoundingClientRect(), worldBounds);
}

function shapePath(points: WorldPoint[]): string {
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${-point.y}`).join(" ")} Z`;
}

function svgPoint(point: WorldPoint): string {
  return `${point.x},${-point.y}`;
}

function spawnClass(state: EditorState, spawnId: string): string {
  if (state.selection?.type === "spawn" && state.selection.id === spawnId) {
    return "selected";
  }
  if (state.teamSpawnPointIds["team-a"].includes(spawnId)) {
    return "team-a";
  }
  if (state.teamSpawnPointIds["team-b"].includes(spawnId)) {
    return "team-b";
  }
  return "";
}

function boundsFromHandle(shape: Parameters<typeof getTerrainBounds>[0], handle: ResizeHandle, point: WorldPoint): Bounds {
  const bounds = getTerrainBounds(shape);
  const next = { ...bounds };
  if (handle.includes("n")) {
    next.maxY = point.y;
  }
  if (handle.includes("s")) {
    next.minY = point.y;
  }
  if (handle.includes("w")) {
    next.minX = point.x;
  }
  if (handle.includes("e")) {
    next.maxX = point.x;
  }
  return normalizeBounds(next);
}

function normalizeBounds(bounds: Bounds): Bounds {
  const minSize = 0.5;
  const minX = Math.min(bounds.minX, bounds.maxX - minSize);
  const maxX = Math.max(bounds.maxX, minX + minSize);
  const minY = Math.min(bounds.minY, bounds.maxY - minSize);
  const maxY = Math.max(bounds.maxY, minY + minSize);
  return { minX, maxX, minY, maxY };
}

function distance(left: WorldPoint, right: WorldPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function boundsLabel(bounds: EditorState["worldBounds"]): string {
  return `${bounds.maxX - bounds.minX} x ${bounds.maxY - bounds.minY}`;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-arena";
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
