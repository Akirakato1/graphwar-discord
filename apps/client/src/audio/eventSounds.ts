import type { ServerEvent } from "@graphwar/shared";
import type { GameSoundId } from "./gameAudio";

export function soundIdsForServerEvent(event: ServerEvent): GameSoundId[] {
  switch (event.type) {
    case "match-started":
      return ["match.start"];
    case "match-ended":
      return ["match.end"];
    case "shot-accepted":
      return ["combat.fire"];
    case "player-eliminated":
      return ["combat.death"];
    case "shot-resolved": {
      const sounds: GameSoundId[] = [];
      if (event.impact.reason === "terrain-hit") {
        sounds.push("combat.explosion");
      }
      if (event.damage.length > 0 || event.impact.reason === "player-hit") {
        sounds.push("combat.hit");
      }
      if (event.eliminations.length > 0) {
        sounds.push("combat.death");
      }
      return sounds;
    }
    default:
      return [];
  }
}
