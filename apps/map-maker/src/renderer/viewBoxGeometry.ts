import { boundsHeight, boundsWidth, type WorldBounds, type WorldPoint } from "@graphwar/shared";

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

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
  const { worldWidth, worldHeight } = createViewBoxGeometry(worldBounds);
  const worldAspectRatio = worldWidth / worldHeight;
  const rectAspectRatio = elementRect.width / elementRect.height;
  const renderedWidth = rectAspectRatio > worldAspectRatio ? elementRect.height * worldAspectRatio : elementRect.width;
  const renderedHeight = rectAspectRatio > worldAspectRatio ? elementRect.height : elementRect.width / worldAspectRatio;
  const offsetX = (elementRect.width - renderedWidth) / 2;
  const offsetY = (elementRect.height - renderedHeight) / 2;
  const normalizedX = clamp((clientPoint.x - elementRect.left - offsetX) / renderedWidth);
  const normalizedY = clamp((clientPoint.y - elementRect.top - offsetY) / renderedHeight);

  return {
    x: roundToTenth(worldBounds.minX + normalizedX * worldWidth),
    y: roundToTenth(worldBounds.maxY - normalizedY * worldHeight)
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
