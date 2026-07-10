import { describe, expect, it } from "vitest";
import type { ServerEvent } from "@graphwar/shared";
import { soundIdsForServerEvent } from "./eventSounds";

describe("soundIdsForServerEvent", () => {
  it("maps gameplay events to semantic sound effects", () => {
    const baseEvent = { roomId: "room-1" };

    expect(soundIdsForServerEvent({ ...baseEvent, type: "match-started" } as ServerEvent)).toEqual(["match.start"]);
    expect(soundIdsForServerEvent({ ...baseEvent, type: "match-ended" } as ServerEvent)).toEqual(["match.end"]);
    expect(
      soundIdsForServerEvent({
        ...baseEvent,
        type: "shot-resolved",
        damage: [{ playerId: "bob", amount: 35, hpAfter: 65 }],
        eliminations: [],
        impact: { reason: "player-hit" }
      } as unknown as ServerEvent)
    ).toEqual(["combat.hit"]);
    expect(
      soundIdsForServerEvent({
        ...baseEvent,
        type: "shot-resolved",
        damage: [],
        eliminations: ["bob"],
        impact: { reason: "terrain-hit" }
      } as unknown as ServerEvent)
    ).toEqual(["combat.explosion", "combat.death"]);
  });
});
