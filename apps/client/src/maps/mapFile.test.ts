import { describe, expect, it } from "vitest";
import { parseCustomMapFileText } from "./mapFile";

const validMap = {
  format: "graphwar-map",
  version: 1,
  name: "Imported Arena",
  terrain: {
    blobs: [
      {
        id: "center",
        outer: [
          { x: -2, y: -1 },
          { x: 2, y: -1 },
          { x: 0, y: 2 }
        ],
        holes: []
      }
    ]
  },
  spawnPoints: Array.from({ length: 10 }, (_, index) => ({
    id: `spawn-${index}`,
    position: { x: index, y: 0 }
  })),
  teamSpawnPointIds: {
    "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
    "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
  }
};

describe("parseCustomMapFileText", () => {
  it("parses and validates graphwar custom map JSON", () => {
    expect(parseCustomMapFileText(JSON.stringify(validMap)).name).toBe("Imported Arena");
  });

  it("reports invalid JSON with readable file import text", () => {
    expect(() => parseCustomMapFileText("{")).toThrow("Custom map file must be valid JSON.");
  });
});
