import { boundsHeight, boundsWidth, type WorldBounds, type WorldPoint } from "@graphwar/shared";

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const MAX_ZOOM_RATIO = 5;
const MINOR_GRID_PIXEL_THRESHOLD = 32;

export function createViewBoxGeometry(worldBounds: WorldBounds) {
  const worldWidth = boundsWidth(worldBounds);
  const worldHeight = boundsHeight(worldBounds);
  const minSvgY = -worldBounds.maxY;
  const maxSvgY = -worldBounds.minY;

  return {
    worldWidth,
    worldHeight,
    minSvgY,
    maxSvgY,
    viewBox: `${worldBounds.minX} ${minSvgY} ${worldWidth} ${worldHeight}`
  };
}

export function screenPointToWorldPoint(clientPoint: WorldPoint, elementRect: RectLike, worldBounds: WorldBounds): WorldPoint {
  const { normalizedX, normalizedY } = normalizedScreenPoint(clientPoint, elementRect, worldBounds);
  const worldWidth = boundsWidth(worldBounds);
  const worldHeight = boundsHeight(worldBounds);

  return {
    x: roundToTenth(worldBounds.minX + normalizedX * worldWidth),
    y: roundToTenth(worldBounds.maxY - normalizedY * worldHeight)
  };
}

export function zoomViewBoundsAtScreenPoint(
  mapBounds: WorldBounds,
  viewBounds: WorldBounds,
  elementRect: RectLike,
  clientPoint: WorldPoint,
  factor: number
): WorldBounds {
  const currentWidth = boundsWidth(viewBounds);
  const currentHeight = boundsHeight(viewBounds);
  const minWidth = boundsWidth(mapBounds) / MAX_ZOOM_RATIO;
  const maxWidth = boundsWidth(mapBounds);
  const nextWidth = clampToRange(currentWidth / factor, minWidth, maxWidth);
  const scale = nextWidth / currentWidth;
  const nextHeight = currentHeight * scale;

  if (nextWidth === currentWidth && nextHeight === currentHeight) {
    return clampViewBoundsToMapBounds(viewBounds, mapBounds);
  }

  const worldPoint = screenPointToWorldPoint(clientPoint, elementRect, viewBounds);
  const { normalizedX, normalizedY } = normalizedScreenPoint(clientPoint, elementRect, viewBounds);
  const minX = worldPoint.x - normalizedX * nextWidth;
  const maxY = worldPoint.y + normalizedY * nextHeight;

  return clampViewBoundsToMapBounds({
    minX,
    maxX: minX + nextWidth,
    minY: maxY - nextHeight,
    maxY
  }, mapBounds);
}

export function panViewBoundsByScreenDelta(
  viewBounds: WorldBounds,
  elementRect: RectLike,
  delta: { x: number; y: number },
  mapBounds?: WorldBounds
): WorldBounds {
  const metrics = renderedViewMetrics(elementRect, viewBounds);
  const deltaWorldX = (delta.x / metrics.renderedWidth) * boundsWidth(viewBounds);
  const deltaWorldY = (delta.y / metrics.renderedHeight) * boundsHeight(viewBounds);

  const nextBounds = {
    minX: viewBounds.minX - deltaWorldX,
    maxX: viewBounds.maxX - deltaWorldX,
    minY: viewBounds.minY + deltaWorldY,
    maxY: viewBounds.maxY + deltaWorldY
  };

  return mapBounds ? clampViewBoundsToMapBounds(nextBounds, mapBounds) : nextBounds;
}

export function shouldShowMinorGrid(viewBounds: WorldBounds, elementRect: Pick<RectLike, "width" | "height">): boolean {
  const metrics = renderedViewMetrics({ left: 0, top: 0, ...elementRect }, viewBounds);
  return metrics.renderedWidth / boundsWidth(viewBounds) >= MINOR_GRID_PIXEL_THRESHOLD;
}

function normalizedScreenPoint(clientPoint: WorldPoint, elementRect: RectLike, worldBounds: WorldBounds) {
  const { renderedWidth, renderedHeight, offsetX, offsetY } = renderedViewMetrics(elementRect, worldBounds);

  if (!isPositiveFinite(renderedWidth) || !isPositiveFinite(renderedHeight)) {
    return {
      normalizedX: 0.5,
      normalizedY: 0.5
    };
  }

  return {
    normalizedX: clamp((clientPoint.x - elementRect.left - offsetX) / renderedWidth),
    normalizedY: clamp((clientPoint.y - elementRect.top - offsetY) / renderedHeight)
  };
}

function renderedViewMetrics(elementRect: RectLike, worldBounds: WorldBounds) {
  const worldWidth = boundsWidth(worldBounds);
  const worldHeight = boundsHeight(worldBounds);
  if (!isPositiveFinite(elementRect.width) || !isPositiveFinite(elementRect.height) || !isPositiveFinite(worldWidth) || !isPositiveFinite(worldHeight)) {
    return {
      renderedWidth: 0,
      renderedHeight: 0,
      offsetX: 0,
      offsetY: 0
    };
  }

  const worldAspectRatio = worldWidth / worldHeight;
  const rectAspectRatio = elementRect.width / elementRect.height;
  const renderedWidth = rectAspectRatio > worldAspectRatio ? elementRect.height * worldAspectRatio : elementRect.width;
  const renderedHeight = rectAspectRatio > worldAspectRatio ? elementRect.height : elementRect.width / worldAspectRatio;

  return {
    renderedWidth,
    renderedHeight,
    offsetX: (elementRect.width - renderedWidth) / 2,
    offsetY: (elementRect.height - renderedHeight) / 2
  };
}

function clampViewBoundsToMapBounds(viewBounds: WorldBounds, mapBounds: WorldBounds): WorldBounds {
  const mapWidth = boundsWidth(mapBounds);
  const mapHeight = boundsHeight(mapBounds);
  const viewWidth = Math.min(boundsWidth(viewBounds), mapWidth);
  const viewHeight = Math.min(boundsHeight(viewBounds), mapHeight);

  if (viewWidth >= mapWidth || viewHeight >= mapHeight) {
    return { ...mapBounds };
  }

  const minX = clampToRange(viewBounds.minX, mapBounds.minX, mapBounds.maxX - viewWidth);
  const maxY = clampToRange(viewBounds.maxY, mapBounds.minY + viewHeight, mapBounds.maxY);

  return {
    minX,
    maxX: minX + viewWidth,
    minY: maxY - viewHeight,
    maxY
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
