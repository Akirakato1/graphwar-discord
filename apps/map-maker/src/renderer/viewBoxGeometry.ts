import { fieldBounds, type WorldPoint } from "@graphwar/shared";

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const worldWidth = fieldBounds.maxX - fieldBounds.minX;
const worldHeight = fieldBounds.maxY - fieldBounds.minY;
const worldAspectRatio = worldWidth / worldHeight;

export function screenPointToWorldPoint(clientPoint: WorldPoint, elementRect: RectLike): WorldPoint {
  const rectAspectRatio = elementRect.width / elementRect.height;
  const renderedWidth = rectAspectRatio > worldAspectRatio ? elementRect.height * worldAspectRatio : elementRect.width;
  const renderedHeight = rectAspectRatio > worldAspectRatio ? elementRect.height : elementRect.width / worldAspectRatio;
  const offsetX = (elementRect.width - renderedWidth) / 2;
  const offsetY = (elementRect.height - renderedHeight) / 2;
  const normalizedX = clamp((clientPoint.x - elementRect.left - offsetX) / renderedWidth);
  const normalizedY = clamp((clientPoint.y - elementRect.top - offsetY) / renderedHeight);

  return {
    x: roundToTenth(fieldBounds.minX + normalizedX * worldWidth),
    y: roundToTenth(fieldBounds.maxY - normalizedY * worldHeight)
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
