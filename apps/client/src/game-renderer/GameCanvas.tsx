import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MatchSnapshot, ServerEvent, ShotResolvedEvent } from "@graphwar/shared";
import { panCamera, resolveCameraForRender, zoomCameraAtCanvasPoint, type Camera } from "./camera";
import {
  findLatestShotResolvedEvent,
  findSnapshotBeforeLatestShot,
  isLatestShotFollowedByTurnEvent,
  renderWorld,
  type CanvasSize
} from "./renderWorld";

type GameCanvasProps = {
  events: ServerEvent[];
  snapshot?: MatchSnapshot;
};

const DEFAULT_CANVAS_SIZE: CanvasSize = { width: 960, height: 576 };
export const SHOT_ANIMATION_MS = 750;
const MAX_AVATAR_RETRIES = 2;
const useCanvasLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
export type ShotPlaybackState = {
  activeShotKey?: string;
  startedAt?: number;
  completedShotKey?: string;
};

export function GameCanvas({ events, snapshot }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestShot = useMemo(() => findLatestShotResolvedEvent(events), [events]);
  const latestShotKey = useMemo(() => (latestShot ? shotEventKey(latestShot) : undefined), [latestShot]);
  const latestShotHasTurnAfter = useMemo(() => isLatestShotFollowedByTurnEvent(events), [events]);
  const snapshotBeforeLatestShot = useMemo(() => findSnapshotBeforeLatestShot(events), [events]);
  const [hiddenShotKey, setHiddenShotKey] = useState<string | undefined>();
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(DEFAULT_CANVAS_SIZE);
  const [camera, setCamera] = useState<Camera | undefined>();
  const visibleShot = latestShotKey && hiddenShotKey === latestShotKey ? undefined : latestShot;
  const shotPlaybackStateRef = useRef<ShotPlaybackState>({});
  const snapshotBoundsKey = snapshot ? worldBoundsKey(snapshot.worldBounds) : undefined;
  const avatarImages = useAvatarImages(snapshot);

  useCanvasLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const syncLayout = () => {
      const nextSize = measureCanvasSize(canvas);
      setCanvasSize((currentSize) => (sameCanvasSize(currentSize, nextSize) ? currentSize : nextSize));
    };

    let resizeObserver: ResizeObserver | undefined;

    syncLayout();
    window.addEventListener("resize", syncLayout);

    if ("ResizeObserver" in window) {
      resizeObserver = new window.ResizeObserver(syncLayout);
      resizeObserver.observe(canvas);
    }

    return () => {
      window.removeEventListener("resize", syncLayout);
      resizeObserver?.disconnect();
    };
  }, []);

  useCanvasLayoutEffect(() => {
    if (!snapshot) {
      setCamera(undefined);
      return;
    }

    setCamera((currentCamera) => resolveCameraForRender(snapshot.worldBounds, canvasSize, currentCamera));
  }, [canvasSize.height, canvasSize.width, snapshotBoundsKey, snapshot]);

  useCanvasLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) {
      return undefined;
    }

    let draggingPointerId: number | undefined;
    let lastPointerPosition: { x: number; y: number } | undefined;

    const toCanvasPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      setCamera((currentCamera) => {
        const renderCamera = resolveCameraForRender(snapshot.worldBounds, canvasSize, currentCamera);
        return zoomCameraAtCanvasPoint(renderCamera, toCanvasPoint(event.clientX, event.clientY), factor);
      });
    };

    const stopDragging = (pointerId: number) => {
      if (draggingPointerId !== pointerId) {
        return;
      }

      draggingPointerId = undefined;
      lastPointerPosition = undefined;
      if (canvas.hasPointerCapture?.(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      draggingPointerId = event.pointerId;
      lastPointerPosition = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (draggingPointerId !== event.pointerId || !lastPointerPosition) {
        return;
      }

      const delta = {
        x: event.clientX - lastPointerPosition.x,
        y: event.clientY - lastPointerPosition.y
      };
      lastPointerPosition = { x: event.clientX, y: event.clientY };
      setCamera((currentCamera) => panCamera(resolveCameraForRender(snapshot.worldBounds, canvasSize, currentCamera), delta));
      event.preventDefault();
    };

    const handlePointerUp = (event: PointerEvent) => {
      stopDragging(event.pointerId);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [canvasSize.height, canvasSize.width, snapshotBoundsKey, snapshot]);

  useCanvasLayoutEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) {
      return undefined;
    }

    const canvasContext = canvasElement.getContext("2d");
    if (!canvasContext) {
      return undefined;
    }

    const canvas: HTMLCanvasElement = canvasElement;
    const ctx: CanvasRenderingContext2D = canvasContext;
    const requestFrame = window.requestAnimationFrame.bind(window);
    const cancelFrame = window.cancelAnimationFrame.bind(window);
    let animationFrame: number | undefined;

    function draw(progress: number): void {
      syncCanvasSize(canvas, ctx, canvasSize);
      const renderSnapshot = visibleShot && progress < 1 && snapshotBeforeLatestShot ? snapshotBeforeLatestShot : snapshot;
      renderWorld(ctx, canvasSize, {
        avatarImages,
        camera: renderSnapshot ? resolveCameraForRender(renderSnapshot.worldBounds, canvasSize, camera) : undefined,
        snapshot: renderSnapshot,
        shot: visibleShot
          ? {
              impact: visibleShot.impact,
              path: visibleShot.path,
              progress
            }
          : undefined
      });
    }

    function currentTime(): number {
      return typeof performance !== "undefined" ? performance.now() : Date.now();
    }

    function drawAnimationFrame(timestamp: number): void {
      if (!visibleShot || !latestShotKey) {
        draw(1);
        return;
      }

      const playbackState = resolveShotPlaybackState(
        shotPlaybackStateRef.current,
        latestShotKey,
        timestamp,
        SHOT_ANIMATION_MS
      );
      shotPlaybackStateRef.current = playbackState;
      draw(playbackState.progress);

      if (playbackState.completedShotKey !== latestShotKey) {
        animationFrame = requestFrame(drawAnimationFrame);
        return;
      }

      hideCompletedShotAfterTurn();
    }

    function restartDraw(): void {
      if (animationFrame !== undefined) {
        cancelFrame(animationFrame);
        animationFrame = undefined;
      }

      if (!visibleShot) {
        draw(1);
        return;
      }

      const playbackState = resolveShotPlaybackState(
        shotPlaybackStateRef.current,
        latestShotKey,
        currentTime(),
        SHOT_ANIMATION_MS
      );
      shotPlaybackStateRef.current = playbackState;
      draw(playbackState.progress);

      if (playbackState.completedShotKey === latestShotKey) {
        hideCompletedShotAfterTurn();
        return;
      }

      animationFrame = requestFrame(drawAnimationFrame);
    }

    function hideCompletedShotAfterTurn(): void {
      if (
        latestShotKey &&
        shotPlaybackStateRef.current.completedShotKey === latestShotKey &&
        latestShotHasTurnAfter &&
        hiddenShotKey !== latestShotKey
      ) {
        setHiddenShotKey(latestShotKey);
      }
    }

    restartDraw();

    return () => {
      if (animationFrame !== undefined) {
        cancelFrame(animationFrame);
      }
    };
  }, [avatarImages, camera, canvasSize, hiddenShotKey, latestShotHasTurnAfter, latestShotKey, snapshot, snapshotBeforeLatestShot, visibleShot]);

  return (
    <section className="panel world-panel" aria-labelledby="world-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">World</p>
          <h2 id="world-title">Battlefield</h2>
        </div>
        <span className="world-phase">{snapshot?.phase ?? "loading"}</span>
      </div>
      <canvas
        aria-label="Graphwar battlefield"
        className="world-canvas"
        data-camera-enabled={snapshot ? "true" : undefined}
        data-path-points={visibleShot?.path.length ?? 0}
        data-rendered={snapshot ? "true" : "false"}
        data-terrain-ids={snapshot?.terrain.blobs.map((blob) => blob.id).join(",") ?? ""}
        data-testid="game-canvas"
        data-world-bounds={snapshot ? worldBoundsKey(snapshot.worldBounds) : undefined}
        height={DEFAULT_CANVAS_SIZE.height}
        ref={canvasRef}
        style={{ touchAction: "none" }}
        width={DEFAULT_CANVAS_SIZE.width}
      />
    </section>
  );
}

function syncCanvasSize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, size: CanvasSize): void {
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(size.width * pixelRatio);
  const pixelHeight = Math.round(size.height * pixelRatio);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function measureCanvasSize(canvas: HTMLCanvasElement): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || DEFAULT_CANVAS_SIZE.width));
  const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || DEFAULT_CANVAS_SIZE.height));
  return { width, height };
}

function sameCanvasSize(left: CanvasSize, right: CanvasSize): boolean {
  return left.width === right.width && left.height === right.height;
}

function worldBoundsKey(bounds: MatchSnapshot["worldBounds"]): string {
  return [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY].join(",");
}

function useAvatarImages(snapshot: MatchSnapshot | undefined): Record<string, HTMLImageElement> {
  const cacheRef = useRef(new Map<string, AvatarImageCacheEntry>());
  const retryCountsRef = useRef(new Map<string, number>());
  const [cacheVersion, setCacheVersion] = useState(0);
  const avatarUrlsKey = snapshot?.players.map((player) => player.avatarUrl ?? "").join("|") ?? "";

  useEffect(() => {
    if (!snapshot || typeof Image === "undefined") {
      return;
    }

    for (const player of snapshot.players) {
      const avatarUrl = player.avatarUrl;
      if (!avatarUrl || cacheRef.current.has(avatarUrl) || !canRetryAvatarUrl(retryCountsRef.current.get(avatarUrl))) {
        continue;
      }

      retryCountsRef.current.set(avatarUrl, (retryCountsRef.current.get(avatarUrl) ?? 0) + 1);
      const image = new Image();
      const entry: AvatarImageCacheEntry = { image, status: "loading" };
      const markLoaded = () => {
        entry.status = "loaded";
        retryCountsRef.current.delete(avatarUrl);
        setCacheVersion((version) => version + 1);
      };
      const markErrored = () => {
        if (cacheRef.current.get(avatarUrl) === entry) {
          cacheRef.current.delete(avatarUrl);
        }
        setCacheVersion((version) => version + 1);
      };

      cacheRef.current.set(avatarUrl, entry);
      image.addEventListener("load", markLoaded, { once: true });
      image.addEventListener("error", markErrored, { once: true });
      image.decoding = "async";
      image.src = avatarUrl;
    }
  }, [avatarUrlsKey, cacheVersion, snapshot]);

  return useMemo(() => {
    if (!snapshot) {
      return {};
    }

    const images: Record<string, HTMLImageElement> = {};
    for (const player of snapshot.players) {
      const avatarUrl = player.avatarUrl;
      const entry = avatarUrl ? cacheRef.current.get(avatarUrl) : undefined;
      if (entry?.status === "loaded" && entry.image.complete) {
        images[player.id] = entry.image;
      }
    }

    return images;
  }, [cacheVersion, snapshot]);
}

type AvatarImageCacheEntry = {
  image: HTMLImageElement;
  status: "loaded" | "loading";
};

export function canRetryAvatarUrl(attemptCount: number | undefined, maxAttempts = MAX_AVATAR_RETRIES): boolean {
  return (attemptCount ?? 0) < maxAttempts;
}

export function resolveShotPlaybackState(
  state: ShotPlaybackState,
  latestShotKey: string | undefined,
  now: number,
  durationMs: number
): ShotPlaybackState & { progress: number } {
  if (!latestShotKey) {
    return { activeShotKey: undefined, startedAt: undefined, completedShotKey: undefined, progress: 1 };
  }

  const isSameShot = state.activeShotKey === latestShotKey;
  const startedAt = isSameShot ? state.startedAt ?? now : now;
  const progress = Math.min(1, (now - startedAt) / durationMs);
  const completedShotKey =
    (isSameShot ? state.completedShotKey : undefined) === latestShotKey || progress >= 1 ? latestShotKey : undefined;

  return {
    activeShotKey: latestShotKey,
    startedAt,
    completedShotKey,
    progress
  };
}

export function shotEventKey(event: ShotResolvedEvent): string {
  const finalPoint = event.path.at(-1);
  const impactPoint = event.impact.point;
  return [
    event.roomId,
    event.shooterId,
    event.snapshot.turn.turnNumber,
    event.expression,
    event.path.length,
    finalPoint ? `${finalPoint.x}:${finalPoint.y}` : "no-path",
    impactPoint ? `${impactPoint.x}:${impactPoint.y}` : event.impact.reason
  ].join("|");
}
