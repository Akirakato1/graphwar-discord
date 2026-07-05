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

async function expectNoPageScroll(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: document.documentElement.clientHeight,
        bodyHeight: document.body.scrollHeight
      }))
    )
    .toMatchObject({
      documentHeight: expect.any(Number),
      viewportHeight: expect.any(Number),
      bodyHeight: expect.any(Number)
    });

  const metrics = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: document.documentElement.clientHeight,
    bodyHeight: document.body.scrollHeight
  }));
  expect(Math.max(metrics.documentHeight, metrics.bodyHeight)).toBeLessThanOrEqual(metrics.viewportHeight + 1);
}

async function canvasPathPoints(page: Page): Promise<number> {
  const rawValue = await page.getByTestId("game-canvas").getAttribute("data-path-points");
  return Number(rawValue ?? 0);
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

    await activePage.getByLabel("Aim west").click();
    await activePage.getByLabel("Function Shot").fill("-1*abs(x)");
    await activePage.getByRole("button", { name: "Fire" }).click();

    for (const page of [alicePage, bobPage]) {
      const canvas = page.getByTestId("game-canvas");
      await expect(canvas).toHaveAttribute("data-rendered", "true");
      await expect.poll(() => canvasPathPoints(page)).toBeGreaterThan(0);
    }

    await expect(activePage.getByTestId("active-turn")).toContainText(`${expectedNextPlayer}'s Turn`);
    await expect(waitingPage.getByTestId("active-turn")).toContainText("Your Turn");

    for (const page of [alicePage, bobPage]) {
      await expect.poll(() => canvasPathPoints(page), { timeout: 5_000 }).toBe(0);
    }
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test("local lobby and gameplay fit Discord 16:9 viewports without page scrolling", async ({ browser }, testInfo) => {
  const viewports = [
    { width: 1280, height: 720 },
    { width: 640, height: 360 }
  ];

  for (const viewport of viewports) {
    const roomId = `${roomIdFor(testInfo.title)}-${viewport.width}`;
    const aliceContext = await browser.newContext({ viewport });
    const bobContext = await browser.newContext({ viewport });
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      await joinLocalRoom(alicePage, roomId, alice);
      await joinLocalRoom(bobPage, roomId, bob);
      await expectBothPagesShowPlayers([alicePage, bobPage]);

      await expectNoPageScroll(alicePage);
      await expectNoPageScroll(bobPage);

      await alicePage.getByRole("button", { name: "Start Match" }).click();
      await expect(alicePage.getByTestId("active-turn")).toContainText(/Alice|Bob|Your Turn/);
      await expect(bobPage.getByTestId("active-turn")).toContainText(/Alice|Bob|Your Turn/);

      await expectNoPageScroll(alicePage);
      await expectNoPageScroll(bobPage);
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  }
});
