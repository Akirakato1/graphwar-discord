import type { GameSoundId } from "./gameAudio";

const knownButtonSoundIds = new Set<GameSoundId>([
  "ui.button",
  "function.button",
  "function.cursor",
  "function.delete",
  "combat.fire",
  "combat.explosion",
  "combat.hit",
  "combat.death",
  "match.start",
  "match.end",
  "timer.tick",
  "timer.timeout"
]);

export type ReleasedButtonSoundInput = {
  disabled?: boolean;
  soundId?: string;
};

export function soundIdForReleasedButton({ disabled, soundId }: ReleasedButtonSoundInput): GameSoundId | undefined {
  if (disabled) {
    return undefined;
  }

  if (soundId && knownButtonSoundIds.has(soundId as GameSoundId)) {
    return soundId as GameSoundId;
  }

  return "ui.button";
}

export function buttonFromEventTarget(target: EventTarget | null): HTMLButtonElement | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }

  return target.closest("button") ?? undefined;
}
