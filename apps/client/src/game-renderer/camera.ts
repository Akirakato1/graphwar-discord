import { boundsHeight, boundsWidth, type WorldBounds, type WorldPoint } from "@graphwar/shared";
import type { CanvasSize } from "./renderWorld";

export type Camera = {
  scale: number;
  offsetX: number;
  offsetY: number;
  boundsKey: string;
};

export type CanvasPoint = {
  x: number;
  y: number;
};

const MIN_ZOOM_RATIO = 0.4;
const MAX_ZOOM_RATIO = 5;

type ParsedCameraKey = {
  bounds: WorldBounds;
  fitScale: number;
};

export function fitCameraToBounds(bounds: WorldBounds, size: CanvasSize): Camera {
  const fitScale = Math.min(size.width / boundsWidth(bounds), size.height / boundsHeight(bounds));
  const offsetX = (size.width - boundsWidth(bounds) * fitScale) / 2;
  const offsetY = (size.height - boundsHeight(bounds) * fitScale) / 2;
  return {
    scale: fitScale,
    offsetX,
    offsetY,
    boundsKey: createBoundsKey(bounds, size, fitScale, offsetX, offsetY)
  };
}

export function worldToCanvasWithCamera(point: WorldPoint, camera: Camera): CanvasPoint {
  const { bounds } = parseBoundsKey(camera.boundsKey);
  return {
    x: camera.offsetX + (point.x - bounds.minX) * camera.scale,
    y: camera.offsetY + (bounds.maxY - point.y) * camera.scale
  };
}

export function canvasToWorldWithCamera(point: CanvasPoint, camera: Camera): WorldPoint {
  const { bounds } = parseBoundsKey(camera.boundsKey);
  return {
    x: bounds.minX + (point.x - camera.offsetX) / camera.scale,
    y: bounds.maxY - (point.y - camera.offsetY) / camera.scale
  };
}

export function panCamera(camera: Camera, delta: { x: number; y: number }): Camera {
  return {
    ...camera,
    offsetX: camera.offsetX + delta.x,
    offsetY: camera.offsetY + delta.y
  };
}

export function zoomCameraAtCanvasPoint(camera: Camera, canvasPoint: CanvasPoint, factor: number): Camera {
  const { bounds, fitScale } = parseBoundsKey(camera.boundsKey);
  const nextScale = clampScale(camera.scale * factor, fitScale);

  if (nextScale === camera.scale) {
    return camera;
  }

  const worldPoint = canvasToWorldWithCamera(canvasPoint, camera);
  return {
    ...camera,
    scale: nextScale,
    offsetX: canvasPoint.x - (worldPoint.x - bounds.minX) * nextScale,
    offsetY: canvasPoint.y - (bounds.maxY - worldPoint.y) * nextScale
  };
}

export function resolveCameraForRender(
  bounds: WorldBounds,
  size: CanvasSize,
  currentCamera: Camera | undefined
): Camera {
  const fittedCamera = fitCameraToBounds(bounds, size);
  if (!currentCamera) {
    return fittedCamera;
  }

  return currentCamera.boundsKey === fittedCamera.boundsKey ? currentCamera : fittedCamera;
}

function clampScale(scale: number, fitScale: number): number {
  return Math.max(fitScale * MIN_ZOOM_RATIO, Math.min(fitScale * MAX_ZOOM_RATIO, scale));
}

function createBoundsKey(
  bounds: WorldBounds,
  size: CanvasSize,
  fitScale: number,
  offsetX: number,
  offsetY: number
): string {
  return [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, size.width, size.height, fitScale, offsetX, offsetY].join(",");
}

function parseBoundsKey(boundsKey: string): ParsedCameraKey {
  const [minX, maxX, minY, maxY, , , fitScale] = boundsKey.split(",").map(Number);
  return {
    bounds: { minX, maxX, minY, maxY },
    fitScale
  };
}
