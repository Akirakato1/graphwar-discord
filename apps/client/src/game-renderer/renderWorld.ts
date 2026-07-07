import {
  defaultMatchTuning,
  fieldBounds,
  type ImpactEvent,
  type MatchSnapshot,
  type ServerEvent,
  type ShotResolvedEvent,
  type WorldBounds,
  type WorldPoint
} from "@graphwar/shared";
import { fitCameraToBounds, type Camera, worldToCanvasWithCamera } from "./camera";

export type CanvasSize = {
  width: number;
  height: number;
};

export type RenderShot = {
  impact?: ImpactEvent;
  path: WorldPoint[];
  progress?: number;
};

export type RenderWorldOptions = {
  avatarImages?: Record<string, CanvasImageSource>;
  camera?: Camera;
  shot?: RenderShot;
  snapshot?: MatchSnapshot;
};

const MAJOR_GRID_STEP = 5;
const MINOR_GRID_STEP = 1;
const MINOR_GRID_PIXEL_THRESHOLD = 32;
const MAJOR_GRID_STROKE = "rgba(218, 210, 188, 0.12)";
const MINOR_GRID_STROKE = "rgba(218, 210, 188, 0.045)";
const TEAM_COLORS = ["#ef6f6c", "#5fb3f9", "#f5c542", "#7bd88f", "#c084fc", "#f59f5f"];

export function worldToCanvas(point: WorldPoint, size: CanvasSize) {
  return worldToCanvasWithCamera(point, fitCameraToBounds(fieldBounds, size));
}

export function findLatestShotResolvedEvent(events: ServerEvent[]): ShotResolvedEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "shot-resolved") {
      return event;
    }
  }

  return undefined;
}

export function findSnapshotBeforeLatestShot(events: ServerEvent[]): MatchSnapshot | undefined {
  let foundLatestShot = false;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!foundLatestShot) {
      if (event.type === "shot-resolved") {
        foundLatestShot = true;
      }
      continue;
    }

    const snapshot = snapshotFromEvent(event);
    if (snapshot) {
      return snapshot;
    }
  }

  return undefined;
}

export function isLatestShotFollowedByTurnEvent(events: ServerEvent[]): boolean {
  let foundTurnAfterLatestShot = false;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "turn-advanced" || event.type === "turn-started") {
      foundTurnAfterLatestShot = true;
      continue;
    }
    if (event.type === "shot-resolved") {
      return foundTurnAfterLatestShot;
    }
  }

  return false;
}

function snapshotFromEvent(event: ServerEvent): MatchSnapshot | undefined {
  switch (event.type) {
    case "room-snapshot":
    case "match-started":
    case "shot-resolved":
    case "match-ended":
      return event.snapshot;
    default:
      return undefined;
  }
}

export function renderWorld(ctx: CanvasRenderingContext2D, size: CanvasSize, options: RenderWorldOptions = {}): void {
  const bounds = options.snapshot?.worldBounds ?? fieldBounds;
  const camera = options.camera ?? fitCameraToBounds(bounds, size);

  ctx.save();
  drawBackground(ctx, size);
  drawGrid(ctx, bounds, camera);
  drawAxes(ctx, bounds, camera);

  if (options.snapshot) {
    drawTerrain(ctx, camera, options.snapshot);
    drawShot(ctx, camera, options.shot);
    drawPlayers(ctx, camera, options.snapshot, options.avatarImages);
  } else {
    drawEmptyState(ctx, size);
  }

  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, size: CanvasSize): void {
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = "#151713";
  ctx.fillRect(0, 0, size.width, size.height);
}

function drawGrid(ctx: CanvasRenderingContext2D, bounds: WorldBounds, camera: Camera): void {
  ctx.save();
  if (shouldShowMinorGrid(camera)) {
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = MINOR_GRID_STROKE;
    drawGridLines(ctx, bounds, camera, MINOR_GRID_STEP, MAJOR_GRID_STEP);
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = MAJOR_GRID_STROKE;
  drawGridLines(ctx, bounds, camera, MAJOR_GRID_STEP);
  ctx.restore();
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  bounds: WorldBounds,
  camera: Camera,
  step: number,
  skipEvery?: number
): void {
  const startX = Math.ceil(bounds.minX / step) * step;
  const startY = Math.ceil(bounds.minY / step) * step;

  for (let x = startX; x <= bounds.maxX; x += step) {
    if (skipEvery && isGridMultiple(x, skipEvery)) {
      continue;
    }
    drawWorldLine(ctx, camera, { x, y: bounds.minY }, { x, y: bounds.maxY });
  }

  for (let y = startY; y <= bounds.maxY; y += step) {
    if (skipEvery && isGridMultiple(y, skipEvery)) {
      continue;
    }
    drawWorldLine(ctx, camera, { x: bounds.minX, y }, { x: bounds.maxX, y });
  }
}

function shouldShowMinorGrid(camera: Camera): boolean {
  return camera.scale >= MINOR_GRID_PIXEL_THRESHOLD;
}

function isGridMultiple(value: number, multiple: number): boolean {
  const ratio = value / multiple;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

function drawAxes(ctx: CanvasRenderingContext2D, bounds: WorldBounds, camera: Camera): void {
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(159, 211, 197, 0.36)";
  drawWorldLine(ctx, camera, { x: bounds.minX, y: 0 }, { x: bounds.maxX, y: 0 });
  drawWorldLine(ctx, camera, { x: 0, y: bounds.minY }, { x: 0, y: bounds.maxY });
  ctx.restore();
}

function drawTerrain(ctx: CanvasRenderingContext2D, camera: Camera, snapshot: MatchSnapshot): void {
  ctx.save();
  ctx.fillStyle = "#6f7d52";
  ctx.strokeStyle = "#a0ae79";
  ctx.lineWidth = 2;

  for (const blob of snapshot.terrain.blobs) {
    ctx.beginPath();
    drawPolygonRing(ctx, camera, blob.outer);

    for (const hole of blob.holes) {
      drawPolygonRing(ctx, camera, hole);
    }

    ctx.fill("evenodd");
    ctx.stroke();
  }

  ctx.restore();
}

function drawShot(ctx: CanvasRenderingContext2D, camera: Camera, shot: RenderShot | undefined): void {
  if (!shot || shot.path.length === 0) {
    return;
  }

  const visiblePath = getVisiblePath(shot.path, shot.progress ?? 1);
  if (visiblePath.length > 0) {
    const segmentCount = Math.max(1, shot.path.length - 1);
    ctx.save();
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    for (let index = 1; index < visiblePath.length; index += 1) {
      const start = worldToCanvasWithCamera(visiblePath[index - 1], camera);
      const end = worldToCanvasWithCamera(visiblePath[index], camera);
      ctx.strokeStyle = shotPathColor(index - 1, segmentCount);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (shot.impact?.point && (shot.progress ?? 1) >= 1) {
    const impact = worldToCanvasWithCamera(shot.impact.point, camera);
    if (shot.impact.reason === "path-too-long") {
      drawRangeFizzle(ctx, camera, impact);
    } else {
      drawImpactRing(ctx, camera, impact);
    }
  }
}

function drawImpactRing(ctx: CanvasRenderingContext2D, camera: Camera, impact: { x: number; y: number }): void {
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#ffcf5d";
  ctx.fillStyle = "rgba(255, 111, 108, 0.16)";
  ctx.beginPath();
  ctx.arc(impact.x, impact.y, worldDistanceToCanvas(defaultMatchTuning.circleCraterRadius, camera), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRangeFizzle(ctx: CanvasRenderingContext2D, camera: Camera, impact: { x: number; y: number }): void {
  const radius = Math.max(5, worldDistanceToCanvas(defaultMatchTuning.playerHitRadius * 1.2, camera));
  const particleRadius = Math.max(1.5, radius * 0.16);

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(249, 242, 199, 0.72)";
  ctx.fillStyle = "rgba(249, 242, 199, 0.08)";
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(impact.x, impact.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(249, 242, 199, 0.72)";
  for (const angle of [Math.PI * 0.12, Math.PI * 0.82, Math.PI * 1.48]) {
    ctx.beginPath();
    ctx.arc(
      impact.x + Math.cos(angle) * radius * 0.72,
      impact.y + Math.sin(angle) * radius * 0.72,
      particleRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

function shotPathColor(segmentIndex: number, segmentCount: number): string {
  const denominator = Math.max(1, segmentCount - 1);
  const consumedRatio = Math.min(1, segmentIndex / denominator);
  const alpha = 0.95 - consumedRatio * 0.75;
  return `rgba(249, 242, 199, ${Number(alpha.toFixed(3))})`;
}

function drawPlayers(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  snapshot: MatchSnapshot,
  avatarImages: Record<string, CanvasImageSource> | undefined
): void {
  for (const player of snapshot.players) {
    const point = worldToCanvasWithCamera(player.position, camera);
    const radius = worldDistanceToCanvas(defaultMatchTuning.playerHitRadius * 1.8, camera);
    const teamColor = colorForTeam(player.teamId);
    const playerColor = player.color ?? teamColor;
    const avatarImage = player.avatarUrl ? avatarImages?.[player.id] : undefined;

    ctx.save();
    ctx.globalAlpha = player.alive ? 1 : 0.48;
    ctx.fillStyle = playerColor;
    ctx.strokeStyle = player.id === snapshot.turn.activePlayerId ? "#fff8e7" : "#171716";
    ctx.lineWidth = player.id === snapshot.turn.activePlayerId ? 3 : 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (avatarImage) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(0, radius - 1), 0, Math.PI * 2);
      ctx.clip();
      drawAvatarImage(ctx, avatarImage, point, radius);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (!player.alive) {
      ctx.strokeStyle = "#171716";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(point.x - radius * 0.55, point.y - radius * 0.55);
      ctx.lineTo(point.x + radius * 0.55, point.y + radius * 0.55);
      ctx.moveTo(point.x + radius * 0.55, point.y - radius * 0.55);
      ctx.lineTo(point.x - radius * 0.55, point.y + radius * 0.55);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.font = "700 13px Inter, system-ui, sans-serif";
    ctx.fillStyle = playerColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(player.displayName, point.x, point.y - radius - 8);
    ctx.font = "700 11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#f3d58f";
    ctx.textBaseline = "top";
    ctx.fillText(player.teamId, point.x, point.y + radius + 7);
    ctx.fillStyle = player.alive ? "#cfe9db" : "#d9b4ae";
    ctx.fillText(player.alive ? `${player.hp} HP` : "Down", point.x, point.y + radius + 21);
    ctx.restore();
  }
}

function drawEmptyState(ctx: CanvasRenderingContext2D, size: CanvasSize): void {
  ctx.save();
  ctx.fillStyle = "#b0a997";
  ctx.font = "700 14px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Waiting for room snapshot", size.width / 2, size.height / 2);
  ctx.restore();
}

function drawWorldLine(ctx: CanvasRenderingContext2D, camera: Camera, start: WorldPoint, end: WorldPoint): void {
  const canvasStart = worldToCanvasWithCamera(start, camera);
  const canvasEnd = worldToCanvasWithCamera(end, camera);
  ctx.beginPath();
  ctx.moveTo(canvasStart.x, canvasStart.y);
  ctx.lineTo(canvasEnd.x, canvasEnd.y);
  ctx.stroke();
}

function drawPolygonRing(ctx: CanvasRenderingContext2D, camera: Camera, ring: WorldPoint[]): void {
  if (ring.length === 0) {
    return;
  }

  const start = worldToCanvasWithCamera(ring[0], camera);
  ctx.moveTo(start.x, start.y);

  for (const point of ring.slice(1)) {
    const canvasPoint = worldToCanvasWithCamera(point, camera);
    ctx.lineTo(canvasPoint.x, canvasPoint.y);
  }

  ctx.closePath();
}

function getVisiblePath(path: WorldPoint[], progress: number): WorldPoint[] {
  if (path.length < 2) {
    return path;
  }

  const clampedProgress = clamp01(progress);
  if (clampedProgress >= 1) {
    return path;
  }

  const totalDistance = pathDistance(path);
  if (totalDistance === 0) {
    return [path[0]];
  }

  const visiblePath = [path[0]];
  let remainingDistance = totalDistance * clampedProgress;

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentDistance = distance(start, end);

    if (remainingDistance >= segmentDistance) {
      visiblePath.push(end);
      remainingDistance -= segmentDistance;
      continue;
    }

    if (remainingDistance > 0 && segmentDistance > 0) {
      const segmentProgress = remainingDistance / segmentDistance;
      visiblePath.push({
        x: start.x + (end.x - start.x) * segmentProgress,
        y: start.y + (end.y - start.y) * segmentProgress
      });
    }

    break;
  }

  return visiblePath;
}

function pathDistance(path: WorldPoint[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += distance(path[index - 1], path[index]);
  }

  return total;
}

function distance(start: WorldPoint, end: WorldPoint): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function worldDistanceToCanvas(distanceValue: number, camera: Camera): number {
  return distanceValue * camera.scale;
}

function drawAvatarImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  point: { x: number; y: number },
  radius: number
): void {
  const imageWithDimensions = image as CanvasImageSource & {
    height?: number;
    naturalHeight?: number;
    naturalWidth?: number;
    videoHeight?: number;
    videoWidth?: number;
    width?: number;
  };
  const sourceWidth =
    imageWithDimensions.naturalWidth ?? imageWithDimensions.videoWidth ?? imageWithDimensions.width ?? radius * 2;
  const sourceHeight =
    imageWithDimensions.naturalHeight ?? imageWithDimensions.videoHeight ?? imageWithDimensions.height ?? radius * 2;
  const diameter = radius * 2;
  const scale = Math.max(diameter / sourceWidth, diameter / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  ctx.drawImage(image, point.x - drawWidth / 2, point.y - drawHeight / 2, drawWidth, drawHeight);
}

function colorForTeam(teamId: string): string {
  let hash = 0;
  for (const char of teamId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}
