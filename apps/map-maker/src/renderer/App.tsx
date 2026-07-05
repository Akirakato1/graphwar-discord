import { fieldBounds, type CustomMapTeamId, type WorldPoint } from "@graphwar/shared";
import { useMemo, useState, type MouseEvent, type PointerEvent } from "react";
import {
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
import { screenPointToWorldPoint } from "./viewBoxGeometry";

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

const worldWidth = fieldBounds.maxX - fieldBounds.minX;
const worldHeight = fieldBounds.maxY - fieldBounds.minY;
const svgViewBox = `${fieldBounds.minX} ${-fieldBounds.maxY} ${worldWidth} ${worldHeight}`;

export function App() {
  const [state, setState] = useState(() => createEmptyEditorState());
  const [tool, setTool] = useState<Tool>("select");
  const [drag, setDrag] = useState<DragState>(null);
  const [message, setMessage] = useState("Ready");

  const selectedTerrain = useMemo(() => {
    if (state.selection?.type !== "terrain") {
      return undefined;
    }
    return state.terrainShapes.find((shape) => shape.id === state.selection?.id);
  }, [state.selection, state.terrainShapes]);

  const selectedBounds = selectedTerrain ? getTerrainBounds(selectedTerrain) : undefined;

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    if (drag) {
      return;
    }

    const point = eventToWorldPoint(event);
    if (tool === "rectangle") {
      setState((current) => addRectangleTerrain(current, point, 7, 3.5));
      return;
    }
    if (tool === "triangle") {
      setState((current) => addTriangleTerrain(current, point, 7, 5));
      return;
    }
    if (tool === "circle") {
      setState((current) => addCircleTerrain(current, point, 3.5, 28));
      return;
    }
    if (tool === "spawn") {
      setState((current) => addSpawnPoint(current, point));
      return;
    }
    if (tool === "pen") {
      setState((current) => {
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

    const point = eventToWorldPoint(event);
    const selected = selectAtPoint(state, point);
    setState(selected);
    if (selected.selection) {
      setDrag({ type: "move", lastPoint: point });
    }
  }

  function handleCanvasPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag) {
      return;
    }

    const point = eventToWorldPoint(event);
    if (drag.type === "move") {
      const delta = { x: point.x - drag.lastPoint.x, y: point.y - drag.lastPoint.y };
      setState((current) => moveSelected(current, delta));
      setDrag({ type: "move", lastPoint: point });
      return;
    }

    setState((current) => {
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
    setState((current) => removeMostRecentPenPoint(current));
  }

  function assignSpawnTeam(spawnId: string, teamId: CustomMapTeamId) {
    setState((current) => toggleTeamSpawn(current, spawnId, teamId));
  }

  function addTenSpawns() {
    setState((current) => {
      let next = current;
      for (let index = 0; index < 10; index += 1) {
        next = addSpawnPoint(next, {
          x: index < 5 ? -19 : 19,
          y: -10 + (index % 5) * 5
        });
      }
      return next;
    });
  }

  async function exportMap() {
    try {
      const contents = stringifyEditorMap(state);
      const result = await window.graphwarMapMaker?.saveMap({
        defaultPath: `${slugify(state.mapName || "custom-arena")}.graphwar-map.json`,
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
          onChange={(event) => setState((current) => ({ ...current, mapName: event.currentTarget.value }))}
          value={state.mapName}
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
        <button onClick={() => setState((current) => closePenShape(current))} type="button">
          Close Pen
        </button>
        <button onClick={addTenSpawns} type="button">
          10 Spawns
        </button>
        <button onClick={() => setState((current) => deleteSelected(current))} type="button">
          Delete
        </button>
        <button className="primary-action" onClick={() => void exportMap()} type="button">
          Export
        </button>
      </header>

      <section className="map-maker-body">
        <aside className="map-maker-sidebar" aria-label="Map status">
          <Stat label="Terrain" value={state.terrainShapes.length} />
          <Stat label="Spawns" value={state.spawnPoints.length} />
          <Stat label="Team A" value={state.teamSpawnPointIds["team-a"].length} />
          <Stat label="Team B" value={state.teamSpawnPointIds["team-b"].length} />
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
            viewBox={svgViewBox}
          >
            <rect className="world-bg" height={worldHeight} width={worldWidth} x={fieldBounds.minX} y={-fieldBounds.maxY} />
            <g className="grid-lines">
              {Array.from({ length: worldWidth / 5 + 1 }, (_, index) => {
                const x = fieldBounds.minX + index * 5;
                return <line key={`x-${x}`} x1={x} x2={x} y1={-fieldBounds.maxY} y2={-fieldBounds.minY} />;
              })}
              {Array.from({ length: worldHeight / 5 + 1 }, (_, index) => {
                const y = -fieldBounds.maxY + index * 5;
                return <line key={`y-${y}`} x1={fieldBounds.minX} x2={fieldBounds.maxX} y1={y} y2={y} />;
              })}
            </g>
            <line className="axis-line" x1={fieldBounds.minX} x2={fieldBounds.maxX} y1={0} y2={0} />
            <line className="axis-line" x1={0} x2={0} y1={-fieldBounds.maxY} y2={-fieldBounds.minY} />

            {state.terrainShapes.map((shape) => (
              <path
                className={state.selection?.type === "terrain" && state.selection.id === shape.id ? "terrain-shape selected" : "terrain-shape"}
                d={shapePath(shape.points)}
                key={shape.id}
                onPointerDown={(event) => {
                  if (tool === "select") {
                    event.stopPropagation();
                    const point = eventToWorldPoint(event);
                    setState((current) => selectItem(current, { type: "terrain", id: shape.id }));
                    setDrag({ type: "move", lastPoint: point });
                  }
                }}
              />
            ))}

            {state.penPoints.length > 0 ? (
              <g>
                <polyline className="pen-line" fill="none" points={state.penPoints.map(svgPoint).join(" ")} />
                {state.penPoints.map((point, index) => (
                  <circle className="pen-node" cx={point.x} cy={-point.y} key={`${point.x}-${point.y}-${index}`} r="0.28" />
                ))}
              </g>
            ) : null}

            {state.spawnPoints.map((spawn) => (
              <circle
                className={`spawn ${spawnClass(state, spawn.id)}`}
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
                    const point = eventToWorldPoint(event);
                    setState((current) => selectItem(current, { type: "spawn", id: spawn.id }));
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

function eventToWorldPoint(event: MouseEvent<SVGSVGElement | SVGPathElement | SVGCircleElement> | PointerEvent<SVGSVGElement | SVGPathElement | SVGCircleElement>): WorldPoint {
  const svg = event.currentTarget.ownerSVGElement ?? (event.currentTarget as SVGSVGElement);
  return screenPointToWorldPoint({ x: event.clientX, y: event.clientY }, svg.getBoundingClientRect());
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

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-arena";
}
