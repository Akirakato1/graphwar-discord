import type { WheelEvent } from "react";
import { aimDirections, type AimDirectionId } from "@graphwar/shared";

type DirectionDialProps = {
  disabled: boolean;
  onChange: (direction: AimDirectionId) => void;
  value: AimDirectionId;
};

const directionSymbols: Record<AimDirectionId, string> = {
  east: "E",
  "north-east": "NE",
  north: "N",
  "north-west": "NW",
  west: "W",
  "south-west": "SW",
  south: "S",
  "south-east": "SE"
};

export function nextAimDirection(current: AimDirectionId, step: number): AimDirectionId {
  const currentIndex = aimDirections.indexOf(current);
  const nextIndex = ((currentIndex + step) % aimDirections.length + aimDirections.length) % aimDirections.length;
  return aimDirections[nextIndex];
}

export function DirectionDial({ disabled, onChange, value }: DirectionDialProps) {
  function handleWheel(event: WheelEvent<HTMLDivElement>): void {
    if (disabled) {
      return;
    }

    event.preventDefault();
    onChange(nextAimDirection(value, event.deltaY >= 0 ? 1 : -1));
  }

  return (
    <div
      aria-label="Aim direction"
      className="direction-dial"
      data-selected-direction={value}
      onWheel={handleWheel}
      role="group"
    >
      {aimDirections.map((direction) => (
        <button
          aria-label={`Aim ${direction}`}
          aria-pressed={direction === value}
          className={direction === value ? "direction-button selected" : "direction-button"}
          data-direction={direction}
          disabled={disabled}
          key={direction}
          onClick={() => onChange(direction)}
          title={`Aim ${direction}`}
          type="button"
        >
          {directionSymbols[direction]}
        </button>
      ))}
    </div>
  );
}
