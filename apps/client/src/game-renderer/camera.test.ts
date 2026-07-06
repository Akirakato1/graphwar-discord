import type { WorldBounds } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import {
  canvasToWorldWithCamera,
  fitCameraToBounds,
  panCamera,
  resolveCameraForRender,
  worldToCanvasWithCamera,
  zoomCameraAtCanvasPoint
} from "./camera";

const hugeBounds: WorldBounds = { minX: -50, maxX: 50, minY: -30, maxY: 30 };
const hugeCanvas = { width: 960, height: 576 };

describe("fitCameraToBounds", () => {
  it("maps huge world bounds exactly into the available canvas while keeping world-up coordinates", () => {
    const camera = fitCameraToBounds(hugeBounds, hugeCanvas);

    expect(worldToCanvasWithCamera({ x: hugeBounds.minX, y: hugeBounds.maxY }, camera)).toEqual({ x: 0, y: 0 });
    expect(worldToCanvasWithCamera({ x: hugeBounds.maxX, y: hugeBounds.minY }, camera)).toEqual({
      x: hugeCanvas.width,
      y: hugeCanvas.height
    });
  });

  it("keeps the world point under the cursor stable while zooming", () => {
    const camera = fitCameraToBounds(hugeBounds, hugeCanvas);
    const canvasPoint = { x: 480, y: 144 };
    const worldPointBeforeZoom = canvasToWorldWithCamera(canvasPoint, camera);

    const zoomedCamera = zoomCameraAtCanvasPoint(camera, canvasPoint, 1.75);

    expect(canvasToWorldWithCamera(canvasPoint, zoomedCamera)).toEqual(worldPointBeforeZoom);
  });
});

describe("panCamera", () => {
  it("pans in canvas pixels and preserves inverse transform round-trips", () => {
    const camera = fitCameraToBounds(hugeBounds, hugeCanvas);
    const pannedCamera = panCamera(camera, { x: 24, y: -18 });
    const worldPoint = { x: -12.5, y: 7.25 };
    const canvasPoint = worldToCanvasWithCamera(worldPoint, pannedCamera);

    expect(pannedCamera.offsetX).toBe(camera.offsetX + 24);
    expect(pannedCamera.offsetY).toBe(camera.offsetY - 18);
    expect(canvasToWorldWithCamera(canvasPoint, pannedCamera)).toEqual(worldPoint);
  });
});

describe("resolveCameraForRender", () => {
  it("returns a fresh fitted camera when the current camera is missing or stale for the current bounds/size", () => {
    const fittedCamera = fitCameraToBounds(hugeBounds, hugeCanvas);
    const resizedCanvas = { width: 720, height: 576 };

    expect(resolveCameraForRender(hugeBounds, hugeCanvas, undefined)).toEqual(fittedCamera);
    expect(resolveCameraForRender(hugeBounds, resizedCanvas, fittedCamera)).toEqual(
      fitCameraToBounds(hugeBounds, resizedCanvas)
    );
    expect(
      resolveCameraForRender({ minX: -25, maxX: 25, minY: -15, maxY: 15 }, hugeCanvas, fittedCamera)
    ).toEqual(fitCameraToBounds({ minX: -25, maxX: 25, minY: -15, maxY: 15 }, hugeCanvas));
  });

  it("refits when a wider canvas changes camera offsets without changing fit scale", () => {
    const initialCamera = fitCameraToBounds(hugeBounds, { width: 960, height: 576 });
    const widerCanvas = { width: 1200, height: 576 };

    expect(initialCamera.scale).toBe(9.6);
    expect(fitCameraToBounds(hugeBounds, widerCanvas).scale).toBe(9.6);
    expect(resolveCameraForRender(hugeBounds, widerCanvas, initialCamera)).toEqual(
      fitCameraToBounds(hugeBounds, widerCanvas)
    );
  });

  it("keeps the current camera when its fit key still matches the render context", () => {
    const fittedCamera = fitCameraToBounds(hugeBounds, hugeCanvas);
    const pannedCamera = panCamera(fittedCamera, { x: 18, y: -12 });

    expect(resolveCameraForRender(hugeBounds, hugeCanvas, pannedCamera)).toEqual(pannedCamera);
  });
});
