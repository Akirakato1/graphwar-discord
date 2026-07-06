import { defaultMatchTuning, fieldBounds, type ImpactEvent, type MatchSnapshot, type ServerEvent, type ShotResolvedEvent, type WorldPoint } from "@graphwar/shared";

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
  shot?: RenderShot;
  snapshot?: MatchSnapshot;
};

const WORLD_WIDTH = fieldBounds.maxX - fieldBounds.minX;
const WORLD_HEIGHT = fieldBounds.maxY - fieldBounds.minY;
const GRID_STEP = 5;
const TEAM_COLORS = ["#ef6f6c", "#5fb3f9", "#f5c542", "#7bd88f", "#c084fc", "#f59f5f"];

export function worldToCanvas(point: WorldPoint, size: CanvasSize) {
  const viewport = worldViewport(size);
  return {
    x: viewport.offsetX + (point.x - fieldBounds.minX) * viewport.scale,
    y: viewport.offsetY + (fieldBounds.maxY - point.y) * viewport.scale
  };
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
  ctx.save();
  drawBackground(ctx, size);
  drawGrid(ctx, size);
  drawAxes(ctx, size);

  if (options.snapshot) {
    drawTerrain(ctx, size, options.snapshot);
    drawShot(ctx, size, options.shot);
    drawPlayers(ctx, size, options.snapshot);
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

function drawGrid(ctx: CanvasRenderingContext2D, size: CanvasSize): void {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(218, 210, 188, 0.1)";

  for (let x = Math.ceil(fieldBounds.minX / GRID_STEP) * GRID_STEP; x <= fieldBounds.maxX; x += GRID_STEP) {
    drawWorldLine(ctx, size, { x, y: fieldBounds.minY }, { x, y: fieldBounds.maxY });
  }

  for (let y = Math.ceil(fieldBounds.minY / GRID_STEP) * GRID_STEP; y <= fieldBounds.maxY; y += GRID_STEP) {
    drawWorldLine(ctx, size, { x: fieldBounds.minX, y }, { x: fieldBounds.maxX, y });
  }

  ctx.restore();
}

function drawAxes(ctx: CanvasRenderingContext2D, size: CanvasSize): void {
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(159, 211, 197, 0.36)";
  drawWorldLine(ctx, size, { x: fieldBounds.minX, y: 0 }, { x: fieldBounds.maxX, y: 0 });
  drawWorldLine(ctx, size, { x: 0, y: fieldBounds.minY }, { x: 0, y: fieldBounds.maxY });
  ctx.restore();
}

function drawTerrain(ctx: CanvasRenderingContext2D, size: CanvasSize, snapshot: MatchSnapshot): void {
  ctx.save();
  ctx.fillStyle = "#6f7d52";
  ctx.strokeStyle = "#a0ae79";
  ctx.lineWidth = 2;

  for (const blob of snapshot.terrain.blobs) {
    ctx.beginPath();
    drawPolygonRing(ctx, size, blob.outer);

    for (const hole of blob.holes) {
      drawPolygonRing(ctx, size, hole);
    }

    ctx.fill("evenodd");
    ctx.stroke();
  }

  ctx.restore();
}

function drawShot(ctx: CanvasRenderingContext2D, size: CanvasSize, shot: RenderShot | undefined): void {
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
      const start = worldToCanvas(visiblePath[index - 1], size);
      const end = worldToCanvas(visiblePath[index], size);
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
    const impact = worldToCanvas(shot.impact.point, size);
    if (shot.impact.reason === "path-too-long") {
      drawRangeFizzle(ctx, size, impact);
    } else {
      drawImpactRing(ctx, size, impact);
    }
  }
}

function drawImpactRing(ctx: CanvasRenderingContext2D, size: CanvasSize, impact: { x: number; y: number }): void {
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#ffcf5d";
  ctx.fillStyle = "rgba(255, 111, 108, 0.16)";
  ctx.beginPath();
  ctx.arc(impact.x, impact.y, worldDistanceToCanvas(defaultMatchTuning.circleCraterRadius, size), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRangeFizzle(ctx: CanvasRenderingContext2D, size: CanvasSize, impact: { x: number; y: number }): void {
  const radius = Math.max(5, worldDistanceToCanvas(defaultMatchTuning.playerHitRadius * 1.2, size));

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
  ctx.beginPath();
  ctx.moveTo(impact.x - radius * 0.75, impact.y);
  ctx.lineTo(impact.x + radius * 0.75, impact.y);
  ctx.moveTo(impact.x, impact.y - radius * 0.75);
  ctx.lineTo(impact.x, impact.y + radius * 0.75);
  ctx.stroke();
  ctx.restore();
}

function shotPathColor(segmentIndex: number, segmentCount: number): string {
  const denominator = Math.max(1, segmentCount - 1);
  const consumedRatio = Math.min(1, segmentIndex / denominator);
  const alpha = 0.95 - consumedRatio * 0.75;
  return `rgba(249, 242, 199, ${Number(alpha.toFixed(3))})`;
}

function drawPlayers(ctx: CanvasRenderingContext2D, size: CanvasSize, snapshot: MatchSnapshot): void {
  for (const player of snapshot.players) {
    const point = worldToCanvas(player.position, size);
    const radius = worldDistanceToCanvas(defaultMatchTuning.playerHitRadius * 1.8, size);
    const teamColor = colorForTeam(player.teamId);
    const playerColor = player.color ?? teamColor;

    ctx.save();
    ctx.globalAlpha = player.alive ? 1 : 0.48;
    ctx.fillStyle = playerColor;
    ctx.strokeStyle = player.id === snapshot.turn.activePlayerId ? "#fff8e7" : "#171716";
    ctx.lineWidth = player.id === snapshot.turn.activePlayerId ? 3 : 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
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

function drawWorldLine(ctx: CanvasRenderingContext2D, size: CanvasSize, start: WorldPoint, end: WorldPoint): void {
  const canvasStart = worldToCanvas(start, size);
  const canvasEnd = worldToCanvas(end, size);
  ctx.beginPath();
  ctx.moveTo(canvasStart.x, canvasStart.y);
  ctx.lineTo(canvasEnd.x, canvasEnd.y);
  ctx.stroke();
}

function drawPolygonRing(ctx: CanvasRenderingContext2D, size: CanvasSize, ring: WorldPoint[]): void {
  if (ring.length === 0) {
    return;
  }

  const start = worldToCanvas(ring[0], size);
  ctx.moveTo(start.x, start.y);

  for (const point of ring.slice(1)) {
    const canvasPoint = worldToCanvas(point, size);
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

function worldDistanceToCanvas(distanceValue: number, size: CanvasSize): number {
  return distanceValue * worldViewport(size).scale;
}

function worldViewport(size: CanvasSize): { offsetX: number; offsetY: number; scale: number } {
  const scale = Math.min(size.width / WORLD_WIDTH, size.height / WORLD_HEIGHT);
  return {
    offsetX: (size.width - WORLD_WIDTH * scale) / 2,
    offsetY: (size.height - WORLD_HEIGHT * scale) / 2,
    scale
  };
}

function colorForTeam(teamId: string): string {
  let hash = 0;
  for (const char of teamId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}
