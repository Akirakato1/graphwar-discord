import { defaultMapSizePreset, worldBoundsForMapSize, type CustomMapTeamId, type WorldBounds, type WorldPoint } from "@graphwar/shared";
import type { Bounds, EditorClipboard, EditorSelection, EditorSelectionItem, EditorState, EditorTerrainShape } from "./editorTypes";

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
  return selectItem(state, itemAtPoint(state, point));
}

export function itemAtPoint(state: EditorState, point: WorldPoint): EditorSelectionItem | null {
  const spawn = [...state.spawnPoints]
    .reverse()
    .find((candidate) => distance(candidate.position, point) <= spawnHitRadius);
  if (spawn) {
    return { type: "spawn", id: spawn.id };
  }

  const terrain = [...state.terrainShapes].reverse().find((shape) => isPointInPolygon(point, shape.points));
  if (terrain) {
    return { type: "terrain", id: terrain.id };
  }

  return null;
}

export function selectItemsInBounds(state: EditorState, bounds: Bounds): EditorState {
  const normalizedBounds = normalizeBounds(bounds);
  const items: EditorSelectionItem[] = [
    ...state.terrainShapes
      .filter((shape) => boundsIntersect(getTerrainBounds(shape), normalizedBounds))
      .map((shape) => ({ type: "terrain" as const, id: shape.id })),
    ...state.spawnPoints
      .filter((spawn) => isPointInBounds(spawn.position, normalizedBounds))
      .map((spawn) => ({ type: "spawn" as const, id: spawn.id }))
  ];

  return selectItem(state, selectionFromItems(items));
}

export function toggleSelectedItem(state: EditorState, item: EditorSelectionItem): EditorState {
  const items = selectedItems(state.selection);
  const isSelected = items.some((candidate) => isSameSelectionItem(candidate, item));
  const nextItems = isSelected
    ? items.filter((candidate) => !isSameSelectionItem(candidate, item))
    : [...items, item];

  return selectItem(state, selectionFromItems(nextItems));
}

export function isItemSelected(selection: EditorSelection, item: EditorSelectionItem): boolean {
  return selectedItems(selection).some((candidate) => isSameSelectionItem(candidate, item));
}

export function selectedItems(selection: EditorSelection): EditorSelectionItem[] {
  if (!selection) {
    return [];
  }
  if (selection.type === "multi") {
    return selection.items;
  }
  return [selection];
}

export function moveSelected(state: EditorState, delta: WorldPoint): EditorState {
  const items = selectedItems(state.selection);
  if (items.length === 0) {
    return state;
  }

  const clampedDelta = clampDeltaToWorldBounds(delta, selectedItemsBounds(state, items), state.worldBounds);

  return {
    ...state,
    terrainShapes: state.terrainShapes.map((shape) =>
      items.some((item) => item.type === "terrain" && item.id === shape.id)
        ? {
            ...shape,
            points: shape.points.map((point) =>
              roundPoint(
                clampPointToBounds({ x: point.x + clampedDelta.x, y: point.y + clampedDelta.y }, state.worldBounds)
              )
            )
          }
        : shape
    ),
    spawnPoints: state.spawnPoints.map((spawn) =>
      items.some((item) => item.type === "spawn" && item.id === spawn.id)
        ? {
            ...spawn,
            position: roundPoint(
              clampPointToBounds(
                { x: spawn.position.x + clampedDelta.x, y: spawn.position.y + clampedDelta.y },
                state.worldBounds
              )
            )
          }
        : spawn
    )
  };
}

export function resizeSelectedTerrain(state: EditorState, targetBounds: Bounds): EditorState {
  const items = selectedItems(state.selection);
  if (items.length !== 1 || items[0].type !== "terrain") {
    return state;
  }
  const selectedTerrainId = items[0].id;

  return {
    ...state,
    terrainShapes: state.terrainShapes.map((shape) => {
      if (shape.id !== selectedTerrainId) {
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
  const items = selectedItems(state.selection);
  if (items.length === 0) {
    return state;
  }
  const terrainIds = new Set(items.filter((item) => item.type === "terrain").map((item) => item.id));
  const spawnIds = new Set(items.filter((item) => item.type === "spawn").map((item) => item.id));

  return {
    ...state,
    terrainShapes: state.terrainShapes.filter((shape) => !terrainIds.has(shape.id)),
    spawnPoints: state.spawnPoints.filter((spawn) => !spawnIds.has(spawn.id)),
    teamSpawnPointIds: {
      "team-a": state.teamSpawnPointIds["team-a"].filter((id) => !spawnIds.has(id)),
      "team-b": state.teamSpawnPointIds["team-b"].filter((id) => !spawnIds.has(id))
    },
    selection: null
  };
}

export function copySelected(state: EditorState): EditorClipboard | null {
  const items = selectedItems(state.selection);
  if (items.length === 0) {
    return null;
  }

  const terrainIds = new Set(items.filter((item) => item.type === "terrain").map((item) => item.id));
  const spawnIds = new Set(items.filter((item) => item.type === "spawn").map((item) => item.id));

  return {
    terrainShapes: state.terrainShapes
      .filter((shape) => terrainIds.has(shape.id))
      .map((shape) => ({
        id: shape.id,
        points: shape.points.map((point) => ({ ...point }))
      })),
    spawnPoints: state.spawnPoints
      .filter((spawn) => spawnIds.has(spawn.id))
      .map((spawn) => ({
        id: spawn.id,
        position: { ...spawn.position }
      })),
    teamSpawnPointIds: {
      "team-a": state.teamSpawnPointIds["team-a"].filter((id) => spawnIds.has(id)),
      "team-b": state.teamSpawnPointIds["team-b"].filter((id) => spawnIds.has(id))
    }
  };
}

export function pasteClipboard(
  state: EditorState,
  clipboard: EditorClipboard | null,
  offset: WorldPoint = { x: 2, y: -2 }
): EditorState {
  if (!clipboard || (clipboard.terrainShapes.length === 0 && clipboard.spawnPoints.length === 0)) {
    return state;
  }

  const clampedOffset = clampDeltaToWorldBounds(offset, clipboardItemsBounds(clipboard), state.worldBounds);
  const nextTerrainShapes: EditorTerrainShape[] = [];
  const nextSpawnPoints: EditorState["spawnPoints"] = [];
  const nextSelectedItems: EditorSelectionItem[] = [];
  const spawnIdMap = new Map<string, string>();

  for (const shape of clipboard.terrainShapes) {
    const id = nextId(
      "terrain",
      [...state.terrainShapes.map((item) => item.id), ...nextTerrainShapes.map((item) => item.id)]
    );
    nextTerrainShapes.push({
      id,
      points: shape.points.map((point) =>
        roundPoint(clampPointToBounds({ x: point.x + clampedOffset.x, y: point.y + clampedOffset.y }, state.worldBounds))
      )
    });
    nextSelectedItems.push({ type: "terrain", id });
  }

  for (const spawn of clipboard.spawnPoints) {
    const id = nextId(
      "spawn",
      [...state.spawnPoints.map((item) => item.id), ...nextSpawnPoints.map((item) => item.id)]
    );
    spawnIdMap.set(spawn.id, id);
    nextSpawnPoints.push({
      id,
      position: roundPoint(
        clampPointToBounds(
          { x: spawn.position.x + clampedOffset.x, y: spawn.position.y + clampedOffset.y },
          state.worldBounds
        )
      )
    });
    nextSelectedItems.push({ type: "spawn", id });
  }

  return {
    ...state,
    terrainShapes: [...state.terrainShapes, ...nextTerrainShapes],
    spawnPoints: [...state.spawnPoints, ...nextSpawnPoints],
    teamSpawnPointIds: {
      "team-a": [
        ...state.teamSpawnPointIds["team-a"],
        ...clipboard.teamSpawnPointIds["team-a"].map((id) => spawnIdMap.get(id)).filter(isString)
      ],
      "team-b": [
        ...state.teamSpawnPointIds["team-b"],
        ...clipboard.teamSpawnPointIds["team-b"].map((id) => spawnIdMap.get(id)).filter(isString)
      ]
    },
    selection: selectionFromItems(nextSelectedItems)
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

function selectionFromItems(items: EditorSelectionItem[]): EditorSelection {
  const uniqueItems = items.filter(
    (item, index) => items.findIndex((candidate) => isSameSelectionItem(candidate, item)) === index
  );
  if (uniqueItems.length === 0) {
    return null;
  }
  if (uniqueItems.length === 1) {
    return uniqueItems[0];
  }
  return { type: "multi", items: uniqueItems };
}

function isSameSelectionItem(left: EditorSelectionItem, right: EditorSelectionItem): boolean {
  return left.type === right.type && left.id === right.id;
}

function nextId(prefix: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let index = existingIds.length + 1;
  while (used.has(`${prefix}-${index}`)) {
    index += 1;
  }
  return `${prefix}-${index}`;
}

function selectedItemsBounds(state: EditorState, items: EditorSelectionItem[]): Bounds {
  return mergeBounds(
    items
      .map((item) => {
        if (item.type === "terrain") {
          const shape = state.terrainShapes.find((candidate) => candidate.id === item.id);
          return shape ? getTerrainBounds(shape) : undefined;
        }
        const spawn = state.spawnPoints.find((candidate) => candidate.id === item.id);
        return spawn ? pointBounds(spawn.position) : undefined;
      })
      .filter(isBounds)
  ) ?? pointBounds(worldBoundsCenter(state.worldBounds));
}

function clipboardItemsBounds(clipboard: EditorClipboard): Bounds {
  return mergeBounds([
    ...clipboard.terrainShapes.map((shape) => getTerrainBounds(shape)),
    ...clipboard.spawnPoints.map((spawn) => pointBounds(spawn.position))
  ]) ?? pointBounds({ x: 0, y: 0 });
}

function pointBounds(point: WorldPoint): Bounds {
  return {
    minX: point.x,
    maxX: point.x,
    minY: point.y,
    maxY: point.y
  };
}

function mergeBounds(bounds: Bounds[]): Bounds | undefined {
  if (bounds.length === 0) {
    return undefined;
  }

  return bounds.reduce((combined, current) => ({
    minX: Math.min(combined.minX, current.minX),
    maxX: Math.max(combined.maxX, current.maxX),
    minY: Math.min(combined.minY, current.minY),
    maxY: Math.max(combined.maxY, current.maxY)
  }));
}

function normalizeBounds(bounds: Bounds): Bounds {
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    maxX: Math.max(bounds.minX, bounds.maxX),
    minY: Math.min(bounds.minY, bounds.maxY),
    maxY: Math.max(bounds.minY, bounds.maxY)
  };
}

function boundsIntersect(left: Bounds, right: Bounds): boolean {
  return left.minX <= right.maxX && left.maxX >= right.minX && left.minY <= right.maxY && left.maxY >= right.minY;
}

function isPointInBounds(point: WorldPoint, bounds: Bounds): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function clampDeltaToWorldBounds(delta: WorldPoint, bounds: Bounds, worldBounds: WorldBounds): WorldPoint {
  let x = delta.x;
  let y = delta.y;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const worldWidth = worldBounds.maxX - worldBounds.minX;
  const worldHeight = worldBounds.maxY - worldBounds.minY;

  if (width <= worldWidth) {
    if (bounds.minX + x < worldBounds.minX) {
      x = worldBounds.minX - bounds.minX;
    } else if (bounds.maxX + x > worldBounds.maxX) {
      x = worldBounds.maxX - bounds.maxX;
    }
  }

  if (height <= worldHeight) {
    if (bounds.minY + y < worldBounds.minY) {
      y = worldBounds.minY - bounds.minY;
    } else if (bounds.maxY + y > worldBounds.maxY) {
      y = worldBounds.maxY - bounds.maxY;
    }
  }

  return { x, y };
}

function isBounds(value: Bounds | undefined): value is Bounds {
  return value !== undefined;
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
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
