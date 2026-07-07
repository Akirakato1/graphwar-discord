import {
  centeredWorldBounds,
  defaultMapSizePreset,
  mapSizePresets,
  worldBoundsForMapSize,
  type CustomMapTeamId,
  type MapSizePresetId,
  type WorldBounds,
  type WorldPoint
} from "@graphwar/shared";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
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
import {
  createViewBoxGeometry,
  panViewBoundsByScreenDelta,
  screenPointToWorldPoint,
  shouldShowMinorGrid,
  zoomViewBoundsAtScreenPoint
} from "./viewBoxGeometry";
import {
  placementToolFromPointer,
  shouldAssignTeamFromPointer,
  shouldDrawPenPointFromPointer,
  shouldSelectFromPointer,
  type MapMakerTool,
  type PlacementTool
} from "./mapMakerInteraction";

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
  | {
      type: "pan";
      lastClientPoint: WorldPoint;
    }
  | null;

type SetupDraft = {
  mapName: string;
  mapSizePreset: MapSizePresetId | "custom";
  customWidth: string;
  customHeight: string;
};

const tools: Array<{ id: MapMakerTool; label: string }> = [
  { id: "select", label: "Select" },
  { id: "rectangle", label: "Rect" },
  { id: "triangle", label: "Tri" },
  { id: "circle", label: "Circle" },
  { id: "pen", label: "Pen" },
  { id: "spawn", label: "Spawn" },
  { id: "team-a", label: "Team A" },
  { id: "team-b", label: "Team B" }
];

const defaultCanvasSize = { width: 1000, height: 600 };
const majorGridStep = 5;
const minorGridStep = 1;
const customDimensionLimits = {
  width: { min: 20, max: 200, fallback: 50 },
  height: { min: 12, max: 120, fallback: 30 }
};

export function App() {
  const [setupDraft, setSetupDraft] = useState<SetupDraft>({
    mapName: "Custom Arena",
    mapSizePreset: defaultMapSizePreset,
    customWidth: String(customDimensionLimits.width.fallback),
    customHeight: String(customDimensionLimits.height.fallback)
  });
  const [state, setState] = useState<EditorState | null>(null);
  const [cameraBounds, setCameraBounds] = useState<WorldBounds | null>(null);
  const [canvasSize, setCanvasSize] = useState(defaultCanvasSize);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [tool, setTool] = useState<MapMakerTool>("select");
  const [drag, setDrag] = useState<DragState>(null);
  const [message, setMessage] = useState("Ready");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const selectedTerrain = useMemo(() => {
    if (state?.selection?.type !== "terrain") {
      return undefined;
    }
    return state.terrainShapes.find((shape) => shape.id === state.selection?.id);
  }, [state]);

  const selectedBounds = selectedTerrain ? getTerrainBounds(selectedTerrain) : undefined;
  const viewGeometry = state ? createViewBoxGeometry(cameraBounds ?? state.worldBounds) : undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target)) {
        setIsSpaceDown(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setIsSpaceDown(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return undefined;
    }

    const syncSize = () => {
      const rect = svg.getBoundingClientRect();
      const nextSize = {
        width: Math.max(1, Math.round(rect.width || defaultCanvasSize.width)),
        height: Math.max(1, Math.round(rect.height || defaultCanvasSize.height))
      };
      setCanvasSize((currentSize) =>
        currentSize.width === nextSize.width && currentSize.height === nextSize.height ? currentSize : nextSize
      );
    };

    let resizeObserver: ResizeObserver | undefined;
    syncSize();
    window.addEventListener("resize", syncSize);
    if ("ResizeObserver" in window) {
      resizeObserver = new window.ResizeObserver(syncSize);
      resizeObserver.observe(svg);
    }

    return () => {
      window.removeEventListener("resize", syncSize);
      resizeObserver?.disconnect();
    };
  }, [state]);

  if (!state || !viewGeometry) {
    const setupWorldBounds = setupDraftWorldBounds(setupDraft);

    return (
      <main className="map-maker-setup-screen">
        <form
          className="map-maker-setup-panel"
          onSubmit={(event) => {
            event.preventDefault();
            const worldBounds = setupWorldBounds;
            setState(createEmptyEditorState({ mapName: setupDraft.mapName, worldBounds }));
            setCameraBounds(worldBounds);
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
              <button
                className={setupDraft.mapSizePreset === "custom" ? "active" : ""}
                onClick={() => setSetupDraft((current) => ({ ...current, mapSizePreset: "custom" }))}
                type="button"
              >
                Custom
              </button>
            </div>
          </div>
          {setupDraft.mapSizePreset === "custom" ? (
            <div className="custom-size-grid" aria-label="Custom map dimensions">
              <label className="custom-size-field">
                <span>Width</span>
                <input
                  max={customDimensionLimits.width.max}
                  min={customDimensionLimits.width.min}
                  onChange={(event) => setSetupDraft((current) => ({ ...current, customWidth: event.currentTarget.value }))}
                  step="1"
                  type="number"
                  value={setupDraft.customWidth}
                />
              </label>
              <label className="custom-size-field">
                <span>Height</span>
                <input
                  max={customDimensionLimits.height.max}
                  min={customDimensionLimits.height.min}
                  onChange={(event) => setSetupDraft((current) => ({ ...current, customHeight: event.currentTarget.value }))}
                  step="1"
                  type="number"
                  value={setupDraft.customHeight}
                />
              </label>
            </div>
          ) : null}
          <p className="setup-size-readout">
            {boundsLabel(setupWorldBounds)}
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
  const mapGeometry = createViewBoxGeometry(editorState.worldBounds);
  const editorViewBounds = cameraBounds ?? editorState.worldBounds;
  const showMinorGrid = shouldShowMinorGrid(editorViewBounds, canvasSize);

  function updateState(updater: (current: EditorState) => EditorState) {
    setState((current) => (current ? updater(current) : current));
  }

  function handleCanvasWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    setCameraBounds((currentBounds) =>
      zoomViewBoundsAtScreenPoint(
        editorState.worldBounds,
        currentBounds ?? editorState.worldBounds,
        rect,
        { x: event.clientX, y: event.clientY },
        factor
      )
    );
  }

  function handleCanvasPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (shouldStartPan(event, isSpaceDown)) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDrag({ type: "pan", lastClientPoint: { x: event.clientX, y: event.clientY } });
      event.preventDefault();
      return;
    }

    const placementTool = placementToolFromPointer(tool, event.button);
    if (placementTool) {
      placeToolAtPoint(placementTool, eventToWorldPoint(event, editorViewBounds));
      event.preventDefault();
      return;
    }

    if (!shouldSelectFromPointer({ button: event.button, isSpaceDown })) {
      return;
    }

    const point = eventToWorldPoint(event, editorViewBounds);
    const selected = selectAtPoint(editorState, point);
    if (selected.selection) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setState(selected);
      setDrag({ type: "move", lastPoint: point });
      return;
    }

    if (shouldDrawPenPointFromPointer(tool, event.button)) {
      updateState((current) => addPenPointOrClose(current, point));
      return;
    }

    setState(selected);
  }

  function handleCanvasPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag) {
      return;
    }

    if (drag.type === "pan") {
      const delta = {
        x: event.clientX - drag.lastClientPoint.x,
        y: event.clientY - drag.lastClientPoint.y
      };
      const rect = event.currentTarget.getBoundingClientRect();
      setCameraBounds((currentBounds) =>
        panViewBoundsByScreenDelta(currentBounds ?? editorState.worldBounds, rect, delta, editorState.worldBounds)
      );
      setDrag({ type: "pan", lastClientPoint: { x: event.clientX, y: event.clientY } });
      event.preventDefault();
      return;
    }

    const point = eventToWorldPoint(event, editorViewBounds);
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
    event.preventDefault();
    if (tool === "pen") {
      updateState((current) => removeMostRecentPenPoint(current));
    }
  }

  function assignSpawnTeam(spawnId: string, teamId: CustomMapTeamId) {
    updateState((current) => toggleTeamSpawn(current, spawnId, teamId));
  }

  function addTenSpawns() {
    updateState((current) => addDefaultSpawnSet(current));
  }

  function addPenPointOrClose(current: EditorState, point: WorldPoint): EditorState {
    if (current.penPoints.length >= 3 && distance(current.penPoints[0], point) < 0.9) {
      return closePenShape(current);
    }
    return addPenPoint(current, point);
  }

  function placeToolAtPoint(placementTool: PlacementTool, point: WorldPoint) {
    if (placementTool === "rectangle") {
      updateState((current) => addRectangleTerrain(current, point, 7, 3.5));
      return;
    }
    if (placementTool === "triangle") {
      updateState((current) => addTriangleTerrain(current, point, 7, 5));
      return;
    }
    if (placementTool === "circle") {
      updateState((current) => addCircleTerrain(current, point, 3.5, 28));
      return;
    }
    updateState((current) => addSpawnPoint(current, point));
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
          <p className="compact-help">Left click selects and drags existing items. Right click places the active shape or spawn tool. Pen mode left-clicks empty map space to draw and right-clicks to undo.</p>
        </aside>

        <section className="map-maker-canvas" aria-label="Map canvas">
          <svg
            className={drag?.type === "pan" ? "panning" : undefined}
            onContextMenu={handleContextMenu}
            onPointerDown={handleCanvasPointerDown}
            onPointerLeave={handlePointerEnd}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handlePointerEnd}
            onWheel={handleCanvasWheel}
            ref={svgRef}
            role="img"
            viewBox={editorViewGeometry.viewBox}
          >
            <rect
              className="world-bg"
              height={mapGeometry.worldHeight}
              width={mapGeometry.worldWidth}
              x={editorState.worldBounds.minX}
              y={mapGeometry.minSvgY}
            />
            {showMinorGrid ? (
              <g className="grid-lines minor-grid-lines">
                {gridValues(editorState.worldBounds.minX, editorState.worldBounds.maxX, minorGridStep)
                  .filter((x) => !isGridMultiple(x, majorGridStep))
                  .map((x) => (
                    <line key={`minor-x-${x}`} x1={x} x2={x} y1={mapGeometry.minSvgY} y2={mapGeometry.maxSvgY} />
                  ))}
                {gridValues(editorState.worldBounds.minY, editorState.worldBounds.maxY, minorGridStep)
                  .filter((y) => !isGridMultiple(y, majorGridStep))
                  .map((y) => (
                    <line key={`minor-y-${y}`} x1={editorState.worldBounds.minX} x2={editorState.worldBounds.maxX} y1={-y} y2={-y} />
                  ))}
              </g>
            ) : null}
            <g className="grid-lines major-grid-lines">
              {gridValues(editorState.worldBounds.minX, editorState.worldBounds.maxX, majorGridStep).map((x) => (
                <line key={`major-x-${x}`} x1={x} x2={x} y1={mapGeometry.minSvgY} y2={mapGeometry.maxSvgY} />
              ))}
              {gridValues(editorState.worldBounds.minY, editorState.worldBounds.maxY, majorGridStep).map((y) => (
                <line key={`major-y-${y}`} x1={editorState.worldBounds.minX} x2={editorState.worldBounds.maxX} y1={-y} y2={-y} />
              ))}
            </g>
            <line className="axis-line" x1={editorState.worldBounds.minX} x2={editorState.worldBounds.maxX} y1={0} y2={0} />
            <line className="axis-line" x1={0} x2={0} y1={mapGeometry.minSvgY} y2={mapGeometry.maxSvgY} />

            {editorState.terrainShapes.map((shape) => (
              <path
                className={editorState.selection?.type === "terrain" && editorState.selection.id === shape.id ? "terrain-shape selected" : "terrain-shape"}
                d={shapePath(shape.points)}
                key={shape.id}
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
                onPointerDown={(event) => {
                  if (shouldAssignTeamFromPointer(tool, event.button)) {
                    event.stopPropagation();
                    assignSpawnTeam(spawn.id, tool);
                    event.preventDefault();
                  }
                }}
                r="0.55"
              />
            ))}

            {selectedBounds && selectedTerrain ? (
              <TransformBox
                bounds={selectedBounds}
                isSpaceDown={isSpaceDown}
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
  isSpaceDown,
  onHandlePointerDown
}: {
  bounds: Bounds;
  isSpaceDown: boolean;
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
            if (isSpaceDown || event.button !== 0) {
              return;
            }
            event.stopPropagation();
            event.currentTarget.setPointerCapture?.(event.pointerId);
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

function shouldStartPan(event: PointerEvent<SVGElement>, isSpaceDown: boolean): boolean {
  return event.button === 1 || (event.button === 0 && isSpaceDown);
}

function gridValues(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) {
    values.push(roundToTenth(value));
  }
  return values;
}

function isGridMultiple(value: number, multiple: number): boolean {
  const ratio = value / multiple;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
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

function setupDraftWorldBounds(setupDraft: SetupDraft): WorldBounds {
  if (setupDraft.mapSizePreset !== "custom") {
    return worldBoundsForMapSize(setupDraft.mapSizePreset);
  }

  return centeredWorldBounds(
    normalizedDimension(setupDraft.customWidth, customDimensionLimits.width),
    normalizedDimension(setupDraft.customHeight, customDimensionLimits.height)
  );
}

function normalizedDimension(value: string, limits: { min: number; max: number; fallback: number }): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return limits.fallback;
  }
  return Math.max(limits.min, Math.min(limits.max, parsed));
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-arena";
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
