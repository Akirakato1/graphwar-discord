import { expect, test, type Page } from "@playwright/test";

type Player = {
  displayName: string;
  id: string;
};

const alice: Player = { id: "alice", displayName: "Alice" };
const bob: Player = { id: "bob", displayName: "Bob" };

function idFor(testTitle: string, label: string): string {
  const safeTitle = testTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `e2e-${label}-${safeTitle.slice(0, 28)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function openLocalMenu(page: Page, player: Player, guildId: string): Promise<void> {
  await page.goto(`/?guild=${guildId}&user=${player.id}`);
  await expect(page.getByRole("heading", { name: "Graphwar" })).toBeVisible();
  await expect(page.locator(".main-menu-cardless")).toBeVisible();
  await expect(page.locator(".main-menu-heading")).toContainText("Graphwar");
  await expect(page.getByRole("button", { name: "Create Lobby" })).toBeVisible();
}

async function createLobby(
  page: Page,
  lobbyName: string,
  alias: string,
  options: {
    damagePerHit?: number;
    friendlyFire?: boolean;
    maxFunctionLength?: number;
    mapSizePreset?: "small" | "standard" | "large" | "huge";
    uniqueFunctionHits?: boolean;
  } = {}
): Promise<void> {
  await page.getByRole("button", { name: "Create Lobby" }).click();
  await page.getByLabel("Lobby name").fill(lobbyName);
  await page.getByLabel("Alias").fill(alias);
  if (options.damagePerHit !== undefined) {
    await page.getByLabel("Damage").fill(String(options.damagePerHit));
  }
  if (options.uniqueFunctionHits !== undefined) {
    await page.getByLabel("Unique function hits").setChecked(options.uniqueFunctionHits);
  }
  if (options.friendlyFire !== undefined) {
    await page.getByLabel("Friendly fire").setChecked(options.friendlyFire);
  }
  if (options.maxFunctionLength !== undefined) {
    await page.getByLabel("Max function length").fill(String(options.maxFunctionLength));
  }
  if (options.mapSizePreset !== undefined) {
    const mapSizeField = page.getByLabel("Map size");
    await expect(mapSizeField).toHaveValue(/small|standard|large|huge/i);
    await mapSizeField.selectOption(options.mapSizePreset);
  }
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: lobbyName })).toBeVisible();
}

function lobbyRow(page: Page, lobbyName: string) {
  return page.locator(".lobby-row").filter({ hasText: lobbyName });
}

async function joinLobby(
  page: Page,
  lobbyName: string,
  alias: string,
  slot: "player" | "spectator" = "player",
  expectedView: "setup" | "game" = "setup"
): Promise<void> {
  await page.getByRole("button", { name: "Join Lobby" }).click();
  const row = lobbyRow(page, lobbyName);
  await expect(row).toBeVisible();
  await page.getByLabel("Alias").fill(alias);
  await row.getByRole("button", { name: slot === "spectator" ? "Spectate" : "Join As Player" }).click();
  if (expectedView === "game") {
    await expect(page.getByTestId("game-canvas")).toBeVisible();
    return;
  }
  await expect(page.getByRole("heading", { name: lobbyName })).toBeVisible();
}

async function expectSetupShowsPlayers(pages: Page[]): Promise<void> {
  for (const page of pages) {
    await expect(page.getByTestId("setup-player-alice")).toContainText("Alice");
    await expect(page.getByTestId("setup-player-bob")).toContainText("Bob");
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

async function fireMiss(page: Page): Promise<void> {
  await page.getByLabel("Aim east").click();
  await page.getByLabel("Function Shot").fill("-x");
  await page.getByRole("button", { name: "Fire" }).click();
  await expect.poll(() => canvasPathPoints(page)).toBeGreaterThan(0);
  await expect.poll(() => canvasPathPoints(page), { timeout: 5_000 }).toBe(0);
}

async function expectShotControlsAbsent(page: Page): Promise<void> {
  await expect(page.getByLabel("Function Shot")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fire" })).toHaveCount(0);
  await expect(page.getByLabel("Aim west")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Function snippet palette" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Insert .+ function|Insert .+ template|Insert .+ variable|Insert .+ constant|Insert .+ operator|Insert parentheses/ })).toHaveCount(0);
}

async function expectMenuCreateJoinNoScroll(page: Page, player: Player, guildId: string): Promise<void> {
  await openLocalMenu(page, player, guildId);
  await expectNoPageScroll(page);

  await page.getByRole("button", { name: "Create Lobby" }).click();
  await expect(page.getByRole("heading", { name: "Create Lobby" })).toBeVisible();
  await expectNoPageScroll(page);
  await page.getByRole("button", { name: "Back" }).click();

  await page.getByRole("button", { name: "Join Lobby" }).click();
  await expect(page.getByRole("heading", { name: "Join Lobby" })).toBeVisible();
  await expectNoPageScroll(page);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Graphwar" })).toBeVisible();
}

async function joinPopulatedLobbyWithoutScroll(page: Page, lobbyName: string, alias: string): Promise<void> {
  await page.getByRole("button", { name: "Join Lobby" }).click();
  await expect(page.getByRole("heading", { name: "Join Lobby" })).toBeVisible();
  const row = lobbyRow(page, lobbyName);
  await expect(row).toBeVisible();
  await expectNoPageScroll(page);
  await expect(row.getByRole("button", { name: "Join As Player" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Spectate" })).toBeVisible();
  await expectNoPageScroll(page);
  await page.getByLabel("Alias").fill(alias);
  await row.getByRole("button", { name: "Join As Player" }).click();
  await expect(page.getByRole("heading", { name: lobbyName })).toBeVisible();
}

test("two local players can start a match and advance turns with a function shot", async ({ browser }, testInfo) => {
  const guildId = idFor(testInfo.title, "guild");
  const lobbyName = idFor(testInfo.title, "lobby");
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const spectatorContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  const spectatorPage = await spectatorContext.newPage();

  try {
    await openLocalMenu(alicePage, alice, guildId);
    await createLobby(alicePage, lobbyName, "Alice");

    await openLocalMenu(bobPage, bob, guildId);
    await bobPage.getByRole("button", { name: "Join Lobby" }).click();
    const bobLobbyRow = lobbyRow(bobPage, lobbyName);
    await expect(bobLobbyRow).toBeVisible();
    await bobPage.getByLabel("Alias").fill("Alice");
    await bobLobbyRow.getByRole("button", { name: "Join As Player" }).click();
    await expect(bobPage.getByLabel("Alias")).toHaveAttribute("aria-invalid", "true");
    await expect(bobPage.getByText("Alias is already taken.")).toBeVisible();
    await bobPage.getByLabel("Alias").fill("Bob");
    await expect(bobPage.getByLabel("Alias")).not.toHaveAttribute("aria-invalid", "true");
    await bobLobbyRow.getByRole("button", { name: "Join As Player" }).click();
    await expect(bobPage.getByRole("heading", { name: lobbyName })).toBeVisible();
    await expectSetupShowsPlayers([alicePage, bobPage]);

    await bobPage.getByRole("region", { name: "Spectators" }).getByRole("button", { name: "Join Spectator" }).click();
    await expect(alicePage.getByRole("region", { name: "Spectators" })).toContainText("Bob");
    await alicePage.getByRole("button", { name: "Auto Assign" }).click();
    await expect(alicePage.getByRole("region", { name: "Team B" })).toContainText("Bob");

    await alicePage.getByRole("button", { name: "Start Match" }).click();

    await expect(alicePage.getByTestId("active-turn")).toContainText(/Alice|Bob|Your Turn/);
    await expect(bobPage.getByTestId("active-turn")).toContainText(/Alice|Bob|Your Turn/);

    await openLocalMenu(spectatorPage, { id: "charlie", displayName: "Charlie" }, guildId);
    await joinLobby(spectatorPage, lobbyName, "Charlie", "spectator", "game");
    await expect(spectatorPage.getByTestId("game-canvas")).toBeVisible();
    await expect(spectatorPage.getByText("Spectating")).toBeVisible();
    await expectShotControlsAbsent(spectatorPage);

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
    await spectatorContext.close();
  }
});

test("player damage appears after the shot playback reaches impact", async ({ browser }, testInfo) => {
  const guildId = idFor(testInfo.title, "guild");
  const lobbyName = idFor(testInfo.title, "lobby");
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  try {
    await openLocalMenu(alicePage, alice, guildId);
    await createLobby(alicePage, lobbyName, "Alice", { maxFunctionLength: 100 });
    await openLocalMenu(bobPage, bob, guildId);
    await joinLobby(bobPage, lobbyName, "Bob");
    await expectSetupShowsPlayers([alicePage, bobPage]);

    await alicePage.getByRole("button", { name: "Start Match" }).click();
    await expect(alicePage.getByTestId("active-turn")).toContainText("Your Turn");
    await expect(bobPage.getByTestId("own-hp")).toContainText("100");

    await alicePage.getByLabel("Function Shot").fill("0.05x(36-x)");
    await alicePage.getByRole("button", { name: "Fire" }).click();

    await expect.poll(() => canvasPathPoints(alicePage)).toBeGreaterThan(0);
    await expect(bobPage.getByTestId("own-hp")).toContainText("100");

    await expect.poll(() => canvasPathPoints(alicePage), { timeout: 5_000 }).toBe(0);
    await expect(bobPage.getByTestId("own-hp")).toContainText("65");
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test("create-lobby damage settings apply and duplicate function hits are rejected", async ({ browser }, testInfo) => {
  const guildId = idFor(testInfo.title, "guild");
  const lobbyName = idFor(testInfo.title, "lobby");
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  try {
    await openLocalMenu(alicePage, alice, guildId);
    await createLobby(alicePage, lobbyName, "Alice", { damagePerHit: 50, maxFunctionLength: 100 });
    await expect(alicePage.getByLabel("Match rules")).toContainText("Damage 50");
    await expect(alicePage.getByLabel("Match rules")).toContainText("Unique hits On");

    await openLocalMenu(bobPage, bob, guildId);
    await joinLobby(bobPage, lobbyName, "Bob");
    await expectSetupShowsPlayers([alicePage, bobPage]);

    await alicePage.getByRole("button", { name: "Start Match" }).click();
    await expect(alicePage.getByTestId("active-turn")).toContainText("Your Turn");
    await expect(bobPage.getByTestId("own-hp")).toContainText("100");

    const hitExpression = "0.05x(36-x)";
    await alicePage.getByLabel("Function Shot").fill(hitExpression);
    await alicePage.getByRole("button", { name: "Fire" }).click();

    await expect.poll(() => canvasPathPoints(alicePage)).toBeGreaterThan(0);
    await expect(bobPage.getByTestId("own-hp")).toContainText("100");
    await expect.poll(() => canvasPathPoints(alicePage), { timeout: 5_000 }).toBe(0);
    await expect(bobPage.getByTestId("own-hp")).toContainText("50");

    await fireMiss(bobPage);
    await expect(alicePage.getByTestId("active-turn")).toContainText("Your Turn");

    await alicePage.getByLabel("Function Shot").fill(hitExpression);
    await alicePage.getByRole("button", { name: "Fire" }).click();

    await expect(alicePage.getByText("That function already hit this target. Try a different function.")).toBeVisible();
    await expect(alicePage.getByTestId("active-turn")).toContainText("Your Turn");
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test("final killing shot plays before the winner dialog returns to menu", async ({ browser }, testInfo) => {
  const guildId = idFor(testInfo.title, "guild");
  const lobbyName = idFor(testInfo.title, "lobby");
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  try {
    await openLocalMenu(alicePage, alice, guildId);
    await createLobby(alicePage, lobbyName, "Alice", { maxFunctionLength: 100, uniqueFunctionHits: false });
    await openLocalMenu(bobPage, bob, guildId);
    await joinLobby(bobPage, lobbyName, "Bob");
    await expectSetupShowsPlayers([alicePage, bobPage]);

    await alicePage.getByRole("button", { name: "Start Match" }).click();
    await expect(alicePage.getByTestId("active-turn")).toContainText("Your Turn");
    await expect(bobPage.getByTestId("own-hp")).toContainText("100");

    for (const hpAfter of ["65", "30"]) {
      await alicePage.getByLabel("Function Shot").fill("0.05x(36-x)");
      await alicePage.getByRole("button", { name: "Fire" }).click();
      await expect.poll(() => canvasPathPoints(alicePage)).toBeGreaterThan(0);
      await expect.poll(() => canvasPathPoints(alicePage), { timeout: 5_000 }).toBe(0);
      await expect(bobPage.getByTestId("own-hp")).toContainText(hpAfter);
      await fireMiss(bobPage);
    }

    await alicePage.getByLabel("Function Shot").fill("0.05x(36-x)");
    await alicePage.getByRole("button", { name: "Fire" }).click();

    await expect.poll(() => canvasPathPoints(alicePage)).toBeGreaterThan(0);
    await expect(alicePage.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => canvasPathPoints(alicePage), { timeout: 5_000 }).toBe(0);
    await expect(alicePage.getByRole("dialog")).toContainText("Team A wins");

    await alicePage.getByRole("button", { name: "Return to Menu" }).click();
    await expect(alicePage.getByRole("heading", { name: "Graphwar" })).toBeVisible();
    await expect(alicePage.getByRole("button", { name: "Create Lobby" })).toBeVisible();
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
    const guildId = `${idFor(testInfo.title, "guild")}-${viewport.width}`;
    const lobbyName = `${idFor(testInfo.title, "lobby")}-${viewport.width}`;
    const aliceContext = await browser.newContext({ viewport });
    const bobContext = await browser.newContext({ viewport });
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      await expectMenuCreateJoinNoScroll(alicePage, alice, guildId);
      await createLobby(alicePage, lobbyName, "Alice", { mapSizePreset: "large" });
      await openLocalMenu(bobPage, bob, guildId);
      await joinPopulatedLobbyWithoutScroll(bobPage, lobbyName, "Bob");
      await expectSetupShowsPlayers([alicePage, bobPage]);

      await expectNoPageScroll(alicePage);
      await expectNoPageScroll(bobPage);

      await alicePage.getByRole("button", { name: "Start Match" }).click();
      await expect(alicePage.getByTestId("active-turn")).toContainText(/Alice|Bob|Your Turn/);
      await expect(bobPage.getByTestId("active-turn")).toContainText(/Alice|Bob|Your Turn/);

      for (const page of [alicePage, bobPage]) {
        const canvas = page.getByTestId("game-canvas");
        await expect(canvas).toHaveAttribute("data-rendered", "true");
        await expect(canvas).toHaveAttribute("data-camera-enabled", "true");
        await expect(canvas).toHaveAttribute("data-world-bounds", "-37.5,37.5,-22.5,22.5");
      }

      await expectNoPageScroll(alicePage);
      await expectNoPageScroll(bobPage);
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  }
});
