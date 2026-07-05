import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MatchSnapshot, ServerEvent, ShotResolvedEvent } from "@graphwar/shared";
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
const useCanvasLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function GameCanvas({ events, snapshot }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestShot = useMemo(() => findLatestShotResolvedEvent(events), [events]);
  const latestShotKey = useMemo(() => (latestShot ? shotEventKey(latestShot) : undefined), [latestShot]);
  const latestShotHasTurnAfter = useMemo(() => isLatestShotFollowedByTurnEvent(events), [events]);
  const snapshotBeforeLatestShot = useMemo(() => findSnapshotBeforeLatestShot(events), [events]);
  const [hiddenShotKey, setHiddenShotKey] = useState<string | undefined>();
  const visibleShot = latestShotKey && hiddenShotKey === latestShotKey ? undefined : latestShot;
  const activeShotKeyRef = useRef<string | undefined>();
  const completedShotKeyRef = useRef<string | undefined>();

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
    let animationStartedAt: number | undefined;
    let resizeObserver: ResizeObserver | undefined;

    if (latestShotKey !== activeShotKeyRef.current) {
      activeShotKeyRef.current = latestShotKey;
      completedShotKeyRef.current = undefined;
      animationStartedAt = undefined;
    }

    function draw(progress: number): void {
      const size = syncCanvasSize(canvas, ctx);
      const renderSnapshot = visibleShot && progress < 1 && snapshotBeforeLatestShot ? snapshotBeforeLatestShot : snapshot;
      renderWorld(ctx, size, {
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

    function drawAnimationFrame(timestamp: number): void {
      if (!visibleShot || !latestShotKey) {
        draw(1);
        return;
      }

      if (completedShotKeyRef.current === latestShotKey) {
        draw(1);
        hideCompletedShotAfterTurn();
        return;
      }

      animationStartedAt ??= timestamp;
      const progress = Math.min(1, (timestamp - animationStartedAt) / SHOT_ANIMATION_MS);
      draw(progress);

      if (progress < 1) {
        animationFrame = requestFrame(drawAnimationFrame);
        return;
      }

      completedShotKeyRef.current = latestShotKey;
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

      if (completedShotKeyRef.current === latestShotKey) {
        draw(1);
        hideCompletedShotAfterTurn();
        return;
      }

      animationStartedAt = undefined;
      draw(0);
      animationFrame = requestFrame(drawAnimationFrame);
    }

    function hideCompletedShotAfterTurn(): void {
      if (latestShotKey && latestShotHasTurnAfter && hiddenShotKey !== latestShotKey) {
        setHiddenShotKey(latestShotKey);
      }
    }

    restartDraw();
    window.addEventListener("resize", restartDraw);

    if ("ResizeObserver" in window) {
      resizeObserver = new window.ResizeObserver(restartDraw);
      resizeObserver.observe(canvas);
    }

    return () => {
      if (animationFrame !== undefined) {
        cancelFrame(animationFrame);
      }
      window.removeEventListener("resize", restartDraw);
      resizeObserver?.disconnect();
    };
  }, [hiddenShotKey, latestShotHasTurnAfter, latestShotKey, snapshot, snapshotBeforeLatestShot, visibleShot]);

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
        data-path-points={visibleShot?.path.length ?? 0}
        data-rendered={snapshot ? "true" : "false"}
        data-testid="game-canvas"
        height={DEFAULT_CANVAS_SIZE.height}
        ref={canvasRef}
        width={DEFAULT_CANVAS_SIZE.width}
      />
    </section>
  );
}

function syncCanvasSize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || DEFAULT_CANVAS_SIZE.width));
  const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || DEFAULT_CANVAS_SIZE.height));
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { width, height };
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
