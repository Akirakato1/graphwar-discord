import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { buttonFromEventTarget, soundIdForReleasedButton } from "./buttonSounds";
import { playGameSound } from "./gameAudio";

type ButtonSoundBoundaryProps = {
  children: ReactNode;
};

function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

export function ButtonSoundBoundary({ children }: ButtonSoundBoundaryProps) {
  const pressedButtonRef = useRef<HTMLButtonElement | undefined>();

  function rememberPressedButton(target: EventTarget | null): void {
    const button = buttonFromEventTarget(target);
    if (!button || button.disabled) {
      pressedButtonRef.current = undefined;
      return;
    }

    pressedButtonRef.current = button;
  }

  function releasePressedButton(target: EventTarget | null): void {
    const releasedButton = buttonFromEventTarget(target);
    const pressedButton = pressedButtonRef.current;
    pressedButtonRef.current = undefined;

    if (!releasedButton || releasedButton !== pressedButton) {
      return;
    }

    const soundId = soundIdForReleasedButton({
      disabled: releasedButton.disabled,
      soundId: releasedButton.dataset.gameSound
    });
    if (soundId) {
      playGameSound(soundId);
    }
  }

  function clearPressedButton(): void {
    pressedButtonRef.current = undefined;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (isActivationKey(event.key)) {
      rememberPressedButton(event.target);
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLDivElement>): void {
    if (isActivationKey(event.key)) {
      releasePressedButton(event.target);
    }
  }

  return (
    <div
      className="button-sound-boundary"
      onKeyDownCapture={handleKeyDown}
      onKeyUpCapture={handleKeyUp}
      onPointerCancelCapture={clearPressedButton}
      onPointerDownCapture={(event: PointerEvent<HTMLDivElement>) => rememberPressedButton(event.target)}
      onPointerUpCapture={(event: PointerEvent<HTMLDivElement>) => releasePressedButton(event.target)}
    >
      {children}
    </div>
  );
}
