import { expect, test, type Page } from "@playwright/test";

type Player = {
  displayName: string;
  id: string;
};

const alice: Player = { id: "alice", displayName: "Alice" };
const bob: Player = { id: "bob", displayName: "Bob" };

const customMap = {
  format: "graphwar-map",
  version: 1,
  name: "E2E Custom Arena",
  terrain: {
    blobs: [
      {
        id: "e2e-platform",
        outer: [
          { x: -4, y: -2 },
          { x: 4, y: -2 },
          { x: 4, y: 2 },
          { x: -4, y: 2 }
        ],
        holes: []
      }
    ]
  },
  spawnPoints: Array.from({ length: 10 }, (_, index) => ({
    id: `spawn-${index}`,
    position: {
      x: index < 5 ? -16 : 16,
      y: -8 + (index % 5) * 4
    }
  })),
  teamSpawnPointIds: {
    "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
    "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
  }
};

function idFor(testTitle: string, label: string): string {
  const safeTitle = testTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `e2e-${label}-${safeTitle.slice(0, 28)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function openLocalMenu(page: Page, player: Player, guildId: string): Promise<void> {
  await page.goto(`/?guild=${guildId}&user=${player.id}`);
  await expect(page.getByRole("heading", { name: "Graphwar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Custom Maps" })).toBeVisible();
}

test("imports a guild custom map and starts a two-client match with it", async ({ browser }, testInfo) => {
  const guildId = idFor(testInfo.title, "guild");
  const lobbyName = idFor(testInfo.title, "lobby");
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  try {
    await openLocalMenu(alicePage, alice, guildId);
    await alicePage.getByRole("button", { name: "Custom Maps" }).click();
    await alicePage.getByLabel("Custom map file").setInputFiles({
      name: "e2e-custom-arena.graphwar-map.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(customMap))
    });
    await expect(alicePage.getByText("Custom map saved.")).toBeVisible();
    await expect(alicePage.getByText("E2E Custom Arena")).toBeVisible();
    await alicePage.getByRole("button", { name: "Back" }).click();

    await alicePage.getByRole("button", { name: "Create Lobby" }).click();
    await alicePage.getByLabel("Lobby name").fill(lobbyName);
    await alicePage.getByLabel("Alias").fill("Alice");
    await alicePage.getByLabel("Map").selectOption({ label: "E2E Custom Arena" });
    await alicePage.getByRole("button", { name: "Create" }).click();
    await expect(alicePage.getByRole("heading", { name: lobbyName })).toBeVisible();

    await openLocalMenu(bobPage, bob, guildId);
    await bobPage.getByRole("button", { name: "Join Lobby" }).click();
    await bobPage.getByRole("button", { name: lobbyName }).click();
    await bobPage.getByLabel("Alias").fill("Bob");
    await bobPage.getByRole("button", { name: "Join As Player" }).click();
    await expect(bobPage.getByRole("heading", { name: lobbyName })).toBeVisible();

    await alicePage.getByRole("button", { name: "Start Match" }).click();

    await expect(alicePage.getByTestId("game-canvas")).toBeVisible();
    await expect(bobPage.getByTestId("game-canvas")).toBeVisible();
    await expect(alicePage.getByTestId("own-hp")).toContainText("100 HP");
    await expect(bobPage.getByTestId("own-hp")).toContainText("100 HP");
    await expect(alicePage.getByTestId("game-canvas")).toHaveAttribute("data-rendered", "true");
    await expect(alicePage.getByTestId("game-canvas")).toHaveAttribute("data-terrain-ids", /e2e-platform/);
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});
