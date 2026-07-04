import type { LocalPoint, WorldPoint } from "./types";

export function localToWorld(localPoint: LocalPoint, shooterPosition: WorldPoint): WorldPoint {
  return {
    x: shooterPosition.x + localPoint.x,
    y: shooterPosition.y + localPoint.y
  };
}
