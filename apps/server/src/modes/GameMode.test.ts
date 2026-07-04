import { describe, expect, it } from "vitest";
import { FreeForAllMode } from "./FreeForAllMode";
import { TeamVersusMode } from "./TeamVersusMode";

const players = ["alice", "bob", "charlie"].map((id) => ({ id, displayName: id }));

describe("game modes", () => {
  it("team mode builds two teams and alternates turn order", () => {
    const mode = new TeamVersusMode();
    const teams = mode.buildTeams(players);
    const order = mode.createTurnOrder([
      { id: "alice", teamId: "team-a", alive: true },
      { id: "bob", teamId: "team-b", alive: true },
      { id: "charlie", teamId: "team-a", alive: true }
    ]);

    expect(teams).toEqual([
      { id: "team-a", playerIds: ["alice", "charlie"] },
      { id: "team-b", playerIds: ["bob"] }
    ]);
    expect(order).toEqual(["alice", "bob", "charlie"]);
  });

  it("free-for-all makes each player their own team", () => {
    const mode = new FreeForAllMode();
    const teams = mode.buildTeams(players);

    expect(teams).toEqual([
      { id: "player-alice", playerIds: ["alice"] },
      { id: "player-bob", playerIds: ["bob"] },
      { id: "player-charlie", playerIds: ["charlie"] }
    ]);
  });

  it("team mode reports victory for all players on the only living team", () => {
    const mode = new TeamVersusMode();

    expect(
      mode.isVictory([
        { id: "alice", teamId: "team-a", alive: true },
        { id: "bob", teamId: "team-b", alive: false },
        { id: "charlie", teamId: "team-a", alive: true }
      ])
    ).toEqual({ ended: true, winnerIds: ["alice", "charlie"] });
  });

  it("team mode credits eliminated teammates on the winning team", () => {
    const mode = new TeamVersusMode();

    expect(
      mode.isVictory([
        { id: "alice", teamId: "team-a", alive: true },
        { id: "bob", teamId: "team-b", alive: false },
        { id: "charlie", teamId: "team-a", alive: false }
      ])
    ).toEqual({ ended: true, winnerIds: ["alice", "charlie"] });
  });

  it("team mode does not report victory when no players are alive", () => {
    const mode = new TeamVersusMode();

    expect(
      mode.isVictory([
        { id: "alice", teamId: "team-a", alive: false },
        { id: "bob", teamId: "team-b", alive: false }
      ])
    ).toEqual({ ended: false, winnerIds: [] });
  });

  it("free-for-all reports victory only when one player remains", () => {
    const mode = new FreeForAllMode();

    expect(
      mode.isVictory([
        { id: "alice", teamId: "player-alice", alive: false },
        { id: "bob", teamId: "player-bob", alive: true },
        { id: "charlie", teamId: "player-charlie", alive: false }
      ])
    ).toEqual({ ended: true, winnerIds: ["bob"] });
  });
});
