import { boundsHeight, boundsWidth, type WorldBounds, type WorldPoint } from "@graphwar/shared";

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const MIN_ZOOM_RATIO = 0.4;
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
  const maxWidth = boundsWidth(mapBounds) / MIN_ZOOM_RATIO;
  const nextWidth = clampToRange(currentWidth / factor, minWidth, maxWidth);
  const scale = nextWidth / currentWidth;
  const nextHeight = currentHeight * scale;

  if (nextWidth === currentWidth && nextHeight === currentHeight) {
    return viewBounds;
  }

  const worldPoint = screenPointToWorldPoint(clientPoint, elementRect, viewBounds);
  const { normalizedX, normalizedY } = normalizedScreenPoint(clientPoint, elementRect, viewBounds);
  const minX = worldPoint.x - normalizedX * nextWidth;
  const maxY = worldPoint.y + normalizedY * nextHeight;

  return {
    minX,
    maxX: minX + nextWidth,
    minY: maxY - nextHeight,
    maxY
  };
}

export function panViewBoundsByScreenDelta(
  viewBounds: WorldBounds,
  elementRect: RectLike,
  delta: { x: number; y: number }
): WorldBounds {
  const metrics = renderedViewMetrics(elementRect, viewBounds);
  const deltaWorldX = (delta.x / metrics.renderedWidth) * boundsWidth(viewBounds);
  const deltaWorldY = (delta.y / metrics.renderedHeight) * boundsHeight(viewBounds);

  return {
    minX: viewBounds.minX - deltaWorldX,
    maxX: viewBounds.maxX - deltaWorldX,
    minY: viewBounds.minY + deltaWorldY,
    maxY: viewBounds.maxY + deltaWorldY
  };
}

export function shouldShowMinorGrid(viewBounds: WorldBounds, elementRect: Pick<RectLike, "width" | "height">): boolean {
  const metrics = renderedViewMetrics({ left: 0, top: 0, ...elementRect }, viewBounds);
  return metrics.renderedWidth / boundsWidth(viewBounds) >= MINOR_GRID_PIXEL_THRESHOLD;
}

function normalizedScreenPoint(clientPoint: WorldPoint, elementRect: RectLike, worldBounds: WorldBounds) {
  const { renderedWidth, renderedHeight, offsetX, offsetY } = renderedViewMetrics(elementRect, worldBounds);

  return {
    normalizedX: clamp((clientPoint.x - elementRect.left - offsetX) / renderedWidth),
    normalizedY: clamp((clientPoint.y - elementRect.top - offsetY) / renderedHeight)
  };
}

function renderedViewMetrics(elementRect: RectLike, worldBounds: WorldBounds) {
  const worldWidth = boundsWidth(worldBounds);
  const worldHeight = boundsHeight(worldBounds);
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

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
