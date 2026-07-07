import { defaultMapSizePreset, worldBoundsForMapSize, type CustomMapTeamId, type WorldBounds, type WorldPoint } from "@graphwar/shared";
import type { Bounds, EditorSelection, EditorState, EditorTerrainShape } from "./editorTypes";

const spawnHitRadius = 1.2;

export function createEmptyEditorState(options?: { mapName?: string; worldBounds?: WorldBounds }): EditorState {
  return {
    mapName: options?.mapName ?? "",
    worldBounds: cloneWorldBounds(options?.worldBounds ?? worldBoundsForMapSize(defaultMapSizePreset)),
    terrainShapes: [],
    spawnPoints: [],
    teamSpawnPointIds: {
      "team-a": [],
      "team-b": []
    },
    penPoints: [],
    selection: null
  };
}

export function addDefaultSpawnSet(state: EditorState): EditorState {
  const width = state.worldBounds.maxX - state.worldBounds.minX;
  const height = state.worldBounds.maxY - state.worldBounds.minY;
  const leftX = roundCoordinate(state.worldBounds.minX + width * 0.22);
  const rightX = roundCoordinate(state.worldBounds.maxX - width * 0.22);
  const yPositions = Array.from({ length: 5 }, (_, index) => roundCoordinate(state.worldBounds.minY + height * (0.2 + index * 0.15)));
  const generatedSpawns: EditorState["spawnPoints"] = [];

  for (const x of [leftX, rightX]) {
    for (const y of yPositions) {
      generatedSpawns.push({
        id: nextId(
          "spawn",
          [...state.spawnPoints.map((item) => item.id), ...generatedSpawns.map((item) => item.id)]
        ),
        position: { x, y }
      });
    }
  }

  const teamASpawns = generatedSpawns.slice(0, 5);
  const teamBSpawns = generatedSpawns.slice(5);

  return {
    ...state,
    spawnPoints: [...state.spawnPoints, ...generatedSpawns],
    teamSpawnPointIds: {
      "team-a": [...state.teamSpawnPointIds["team-a"], ...teamASpawns.map((spawn) => spawn.id)],
      "team-b": [...state.teamSpawnPointIds["team-b"], ...teamBSpawns.map((spawn) => spawn.id)]
    },
    selection: { type: "spawn", id: generatedSpawns[generatedSpawns.length - 1].id }
  };
}

export function getTerrainBounds(shape: EditorTerrainShape): Bounds {
  return pointsBounds(shape.points);
}

export function addRectangleTerrain(
  state: EditorState,
  center: WorldPoint,
  width: number,
  height: number
): EditorState {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shape: EditorTerrainShape = {
    id: nextId("terrain", state.terrainShapes.map((item) => item.id)),
    points: fitTerrainPointsWithinBounds([
      { x: center.x - halfWidth, y: center.y - halfHeight },
      { x: center.x + halfWidth, y: center.y - halfHeight },
      { x: center.x + halfWidth, y: center.y + halfHeight },
      { x: center.x - halfWidth, y: center.y + halfHeight }
    ], state.worldBounds)
  };

  return appendTerrainShape(state, shape);
}

export function addTriangleTerrain(
  state: EditorState,
  center: WorldPoint,
  width: number,
  height: number
): EditorState {
  const shape: EditorTerrainShape = {
    id: nextId("terrain", state.terrainShapes.map((item) => item.id)),
    points: fitTerrainPointsWithinBounds([
      { x: center.x, y: center.y + height / 2 },
      { x: center.x - width / 2, y: center.y - height / 2 },
      { x: center.x + width / 2, y: center.y - height / 2 }
    ], state.worldBounds)
  };

  return appendTerrainShape(state, shape);
}

export function addCircleTerrain(
  state: EditorState,
  center: WorldPoint,
  radius: number,
  segments = 24
): EditorState {
  const safeSegments = Math.max(3, Math.floor(segments));
  const shape: EditorTerrainShape = {
    id: nextId("terrain", state.terrainShapes.map((item) => item.id)),
    points: fitTerrainPointsWithinBounds(Array.from({ length: safeSegments }, (_, index) => {
      const angle = (Math.PI * 2 * index) / safeSegments;
      return roundPoint({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      });
    }), state.worldBounds)
  };

  return appendTerrainShape(state, shape);
}

export function addPenPoint(state: EditorState, point: WorldPoint): EditorState {
  return {
    ...state,
    penPoints: [...state.penPoints, roundPoint(clampPointToBounds(point, state.worldBounds))]
  };
}

export function removeMostRecentPenPoint(state: EditorState): EditorState {
  return {
    ...state,
    penPoints: state.penPoints.slice(0, -1)
  };
}

export function closePenShape(state: EditorState): EditorState {
  if (state.penPoints.length < 3) {
    return state;
  }

  return appendTerrainShape(state, {
    id: nextId("terrain", state.terrainShapes.map((item) => item.id)),
    points: state.penPoints
  });
}

export function addSpawnPoint(state: EditorState, position: WorldPoint): EditorState {
  const spawn = {
    id: nextId("spawn", state.spawnPoints.map((item) => item.id)),
    position: roundPoint(clampPointToBounds(position, state.worldBounds))
  };

  return {
    ...state,
    spawnPoints: [...state.spawnPoints, spawn],
    selection: { type: "spawn", id: spawn.id }
  };
}

export function selectItem(state: EditorState, selection: EditorSelection): EditorState {
  return {
    ...state,
    selection
  };
}

export function selectAtPoint(state: EditorState, point: WorldPoint): EditorState {
  const spawn = [...state.spawnPoints]
    .reverse()
    .find((candidate) => distance(candidate.position, point) <= spawnHitRadius);
  if (spawn) {
    return selectItem(state, { type: "spawn", id: spawn.id });
  }

  const terrain = [...state.terrainShapes].reverse().find((shape) => isPointInPolygon(point, shape.points));
  if (terrain) {
    return selectItem(state, { type: "terrain", id: terrain.id });
  }

  return selectItem(state, null);
}

export function moveSelected(state: EditorState, delta: WorldPoint): EditorState {
  if (!state.selection) {
    return state;
  }

  if (state.selection.type === "terrain") {
    return {
      ...state,
      terrainShapes: state.terrainShapes.map((shape) =>
        shape.id === state.selection?.id
          ? {
              ...shape,
              points: fitTerrainPointsWithinBounds(
                shape.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })),
                state.worldBounds
              )
            }
          : shape
      )
    };
  }

  return {
    ...state,
    spawnPoints: state.spawnPoints.map((spawn) =>
      spawn.id === state.selection?.id
        ? {
            ...spawn,
            position: roundPoint(
              clampPointToBounds({ x: spawn.position.x + delta.x, y: spawn.position.y + delta.y }, state.worldBounds)
            )
          }
        : spawn
    )
  };
}

export function resizeSelectedTerrain(state: EditorState, targetBounds: Bounds): EditorState {
  if (!state.selection || state.selection.type !== "terrain") {
    return state;
  }

  return {
    ...state,
    terrainShapes: state.terrainShapes.map((shape) => {
      if (shape.id !== state.selection?.id) {
        return shape;
      }
      const sourceBounds = pointsBounds(shape.points);
      const clampedTargetBounds = clampBoundsToWorldBounds(targetBounds, state.worldBounds);
      return {
        ...shape,
        points: fitTerrainPointsWithinBounds(
          shape.points.map((point) => scalePointBetweenBounds(point, sourceBounds, clampedTargetBounds)),
          state.worldBounds
        )
      };
    })
  };
}

export function deleteSelected(state: EditorState): EditorState {
  if (!state.selection) {
    return state;
  }

  if (state.selection.type === "terrain") {
    return {
      ...state,
      terrainShapes: state.terrainShapes.filter((shape) => shape.id !== state.selection?.id),
      selection: null
    };
  }

  return {
    ...state,
    spawnPoints: state.spawnPoints.filter((spawn) => spawn.id !== state.selection?.id),
    teamSpawnPointIds: {
      "team-a": state.teamSpawnPointIds["team-a"].filter((id) => id !== state.selection?.id),
      "team-b": state.teamSpawnPointIds["team-b"].filter((id) => id !== state.selection?.id)
    },
    selection: null
  };
}

export function toggleTeamSpawn(state: EditorState, spawnPointId: string, teamId: CustomMapTeamId): EditorState {
  const alreadyAssignedToTeam = state.teamSpawnPointIds[teamId].includes(spawnPointId);
  const next = {
    "team-a": state.teamSpawnPointIds["team-a"].filter((id) => id !== spawnPointId),
    "team-b": state.teamSpawnPointIds["team-b"].filter((id) => id !== spawnPointId)
  };

  if (!alreadyAssignedToTeam) {
    next[teamId] = [...next[teamId], spawnPointId];
  }

  return {
    ...state,
    teamSpawnPointIds: next
  };
}

function appendTerrainShape(state: EditorState, shape: EditorTerrainShape): EditorState {
  return {
    ...state,
    terrainShapes: [...state.terrainShapes, shape],
    penPoints: [],
    selection: { type: "terrain", id: shape.id }
  };
}

function nextId(prefix: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let index = existingIds.length + 1;
  while (used.has(`${prefix}-${index}`)) {
    index += 1;
  }
  return `${prefix}-${index}`;
}

function distance(left: WorldPoint, right: WorldPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function pointsBounds(points: WorldPoint[]): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function fitTerrainPointsWithinBounds(points: WorldPoint[], worldBounds: WorldBounds): WorldPoint[] {
  if (points.length === 0) {
    return [];
  }

  const boundedPoints = points.map((point) => clampPointToBounds(point, worldBounds));
  const bounds = pointsBounds(boundedPoints);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const worldWidth = worldBounds.maxX - worldBounds.minX;
  const worldHeight = worldBounds.maxY - worldBounds.minY;
  let deltaX = 0;
  let deltaY = 0;

  if (width <= worldWidth) {
    if (bounds.minX < worldBounds.minX) {
      deltaX = worldBounds.minX - bounds.minX;
    } else if (bounds.maxX > worldBounds.maxX) {
      deltaX = worldBounds.maxX - bounds.maxX;
    }
  }

  if (height <= worldHeight) {
    if (bounds.minY < worldBounds.minY) {
      deltaY = worldBounds.minY - bounds.minY;
    } else if (bounds.maxY > worldBounds.maxY) {
      deltaY = worldBounds.maxY - bounds.maxY;
    }
  }

  return boundedPoints.map((point) => roundPoint(clampPointToBounds({ x: point.x + deltaX, y: point.y + deltaY }, worldBounds)));
}

function clampPointToBounds(point: WorldPoint, worldBounds: WorldBounds): WorldPoint {
  const center = worldBoundsCenter(worldBounds);
  return {
    x: clamp(finiteOrFallback(point.x, center.x), worldBounds.minX, worldBounds.maxX),
    y: clamp(finiteOrFallback(point.y, center.y), worldBounds.minY, worldBounds.maxY)
  };
}

function clampBoundsToWorldBounds(bounds: Bounds, worldBounds: WorldBounds): Bounds {
  const minX = clamp(Math.min(bounds.minX, bounds.maxX), worldBounds.minX, worldBounds.maxX);
  const maxX = clamp(Math.max(bounds.minX, bounds.maxX), worldBounds.minX, worldBounds.maxX);
  const minY = clamp(Math.min(bounds.minY, bounds.maxY), worldBounds.minY, worldBounds.maxY);
  const maxY = clamp(Math.max(bounds.minY, bounds.maxY), worldBounds.minY, worldBounds.maxY);
  return expandBoundsIfNeeded({ minX, maxX, minY, maxY }, worldBounds);
}

function expandBoundsIfNeeded(bounds: Bounds, worldBounds: WorldBounds): Bounds {
  const minSize = 0.5;
  const next = { ...bounds };
  if (next.maxX - next.minX < minSize) {
    const center = (next.minX + next.maxX) / 2;
    next.minX = clamp(center - minSize / 2, worldBounds.minX, worldBounds.maxX - minSize);
    next.maxX = next.minX + minSize;
  }
  if (next.maxY - next.minY < minSize) {
    const center = (next.minY + next.maxY) / 2;
    next.minY = clamp(center - minSize / 2, worldBounds.minY, worldBounds.maxY - minSize);
    next.maxY = next.minY + minSize;
  }
  return next;
}

function scalePointBetweenBounds(point: WorldPoint, sourceBounds: Bounds, targetBounds: Bounds): WorldPoint {
  const sourceWidth = sourceBounds.maxX - sourceBounds.minX;
  const sourceHeight = sourceBounds.maxY - sourceBounds.minY;
  const xRatio = sourceWidth === 0 ? 0.5 : (point.x - sourceBounds.minX) / sourceWidth;
  const yRatio = sourceHeight === 0 ? 0.5 : (point.y - sourceBounds.minY) / sourceHeight;
  return roundPoint({
    x: targetBounds.minX + (targetBounds.maxX - targetBounds.minX) * xRatio,
    y: targetBounds.minY + (targetBounds.maxY - targetBounds.minY) * yRatio
  });
}

function isPointInPolygon(point: WorldPoint, polygon: WorldPoint[]): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function roundPoint(point: WorldPoint): WorldPoint {
  return {
    x: roundCoordinate(point.x),
    y: roundCoordinate(point.y)
  };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finiteOrFallback(value: number, fallback: number): number {
  return Number.isNaN(value) ? fallback : value;
}

function worldBoundsCenter(worldBounds: WorldBounds): WorldPoint {
  return {
    x: (worldBounds.minX + worldBounds.maxX) / 2,
    y: (worldBounds.minY + worldBounds.maxY) / 2
  };
}

function cloneWorldBounds(worldBounds: WorldBounds): WorldBounds {
  return { ...worldBounds };
}
