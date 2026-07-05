import type { LocalPoint, WorldPoint } from "./types";
import type { AimDirectionId } from "../state/types";

const DIAGONAL = Math.SQRT1_2;

export function directionVector(direction: AimDirectionId): WorldPoint {
  switch (direction) {
    case "east":
      return { x: 1, y: 0 };
    case "north-east":
      return { x: DIAGONAL, y: DIAGONAL };
    case "north":
      return { x: 0, y: 1 };
    case "north-west":
      return { x: -DIAGONAL, y: DIAGONAL };
    case "west":
      return { x: -1, y: 0 };
    case "south-west":
      return { x: -DIAGONAL, y: -DIAGONAL };
    case "south":
      return { x: 0, y: -1 };
    case "south-east":
      return { x: DIAGONAL, y: -DIAGONAL };
  }
}

export function localToWorld(
  localPoint: LocalPoint,
  shooterPosition: WorldPoint,
  aimDirection: AimDirectionId = "east"
): WorldPoint {
  const forward = directionVector(aimDirection);
  const left = { x: -forward.y, y: forward.x };

  return {
    x: shooterPosition.x + forward.x * localPoint.x + left.x * localPoint.y,
    y: shooterPosition.y + forward.y * localPoint.x + left.y * localPoint.y
  };
}
