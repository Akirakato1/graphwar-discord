export type GameSoundId =
  | "ui.button"
  | "function.button"
  | "function.cursor"
  | "function.delete"
  | "combat.fire"
  | "combat.explosion"
  | "combat.hit"
  | "combat.death"
  | "match.start"
  | "match.end"
  | "timer.tick"
  | "timer.timeout";

type BrowserAudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | undefined;

function currentAudioContext(): AudioContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const audioWindow = window as BrowserAudioWindow;
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) {
    return undefined;
  }

  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency: number, durationSeconds: number, gainValue: number, type: OscillatorType): void {
  const context = currentAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSeconds);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + durationSeconds + 0.02);
}

export function playGameSound(soundId: GameSoundId): void {
  switch (soundId) {
    case "timer.tick":
      playTone(880, 0.08, 0.025, "square");
      return;
    case "timer.timeout":
      playTone(140, 0.28, 0.035, "sawtooth");
      window.setTimeout(() => playTone(95, 0.24, 0.03, "sawtooth"), 90);
      return;
    case "combat.explosion":
      playTone(90, 0.32, 0.045, "sawtooth");
      return;
    case "combat.hit":
      playTone(220, 0.12, 0.035, "triangle");
      return;
    case "combat.death":
      playTone(180, 0.2, 0.035, "sawtooth");
      window.setTimeout(() => playTone(120, 0.28, 0.03, "sawtooth"), 100);
      return;
    case "combat.fire":
      playTone(520, 0.1, 0.03, "square");
      return;
    case "match.start":
      playTone(392, 0.12, 0.028, "triangle");
      window.setTimeout(() => playTone(587, 0.16, 0.03, "triangle"), 90);
      return;
    case "match.end":
      playTone(587, 0.18, 0.03, "triangle");
      window.setTimeout(() => playTone(784, 0.28, 0.028, "triangle"), 140);
      return;
    case "function.delete":
      playTone(260, 0.04, 0.018, "square");
      return;
    case "function.cursor":
      playTone(420, 0.035, 0.014, "triangle");
      return;
    case "function.button":
      playTone(620, 0.045, 0.018, "triangle");
      return;
    case "ui.button":
      playTone(480, 0.05, 0.018, "sine");
      return;
  }
}
