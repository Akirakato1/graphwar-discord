import { expect, test, type Page } from "@playwright/test";

type Player = {
  displayName: string;
  id: string;
};

const alice: Player = { id: "alice", displayName: "Alice" };
const bob: Player = { id: "bob", displayName: "Bob" };

function roomIdFor(testTitle: string): string {
  const safeTitle = testTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `e2e-${safeTitle}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function joinLocalRoom(page: Page, roomId: string, player: Player): Promise<void> {
  await page.goto(`/?room=${roomId}&mockPlayer=${player.id}&displayName=${encodeURIComponent(player.displayName)}`);
  await expect(page.getByRole("heading", { name: "Connected" })).toBeVisible();
  await expect(page.getByTestId(`player-${player.id}`)).toContainText(player.displayName);
}

async function expectBothPagesShowPlayers(pages: Page[]): Promise<void> {
  for (const page of pages) {
    await expect(page.getByTestId("player-alice")).toContainText("Alice");
    await expect(page.getByTestId("player-bob")).toContainText("Bob");
  }
}

async function activeTurnText(page: Page): Promise<string> {
  return (await page.getByTestId("active-turn").textContent()) ?? "";
}

test("two local players can start a match and advance turns with a function shot", async ({ browser }, testInfo) => {
  const roomId = roomIdFor(testInfo.title);
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  try {
    await joinLocalRoom(alicePage, roomId, alice);
    await joinLocalRoom(bobPage, roomId, bob);
    await expectBothPagesShowPlayers([alicePage, bobPage]);

    await alicePage.getByRole("button", { name: "Start Match" }).click();

    await expect(alicePage.getByTestId("active-turn")).toContainText(/Alice|Bob|Your Turn/);
    await expect(bobPage.getByTestId("active-turn")).toContainText(/Alice|Bob|Your Turn/);

    const aliceTurn = await activeTurnText(alicePage);
    const activePage = aliceTurn.includes("Your Turn") ? alicePage : bobPage;
    const waitingPage = activePage === alicePage ? bobPage : alicePage;
    const expectedNextPlayer = activePage === alicePage ? "Bob" : "Alice";

    await activePage.getByLabel("Function Shot").fill("0");
    await activePage.getByRole("button", { name: "Fire" }).click();

    await expect(activePage.getByTestId("active-turn")).toContainText(`${expectedNextPlayer}'s Turn`);
    await expect(waitingPage.getByTestId("active-turn")).toContainText("Your Turn");

    for (const page of [alicePage, bobPage]) {
      const canvas = page.getByTestId("game-canvas");
      await expect(canvas).toHaveAttribute("data-rendered", "true");
      await expect
        .poll(async () => Number((await canvas.getAttribute("data-path-points")) ?? "0"))
        .toBeGreaterThan(0);
    }
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});
