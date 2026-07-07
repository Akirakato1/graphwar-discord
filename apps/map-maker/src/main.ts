import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

type SaveMapPayload = {
  contents: string;
  filePath?: string;
  mapName: string;
};

type SavedMapSummary = {
  filePath: string;
  name: string;
  updatedAt?: string;
};

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: "Graphwar Map Maker",
    backgroundColor: "#12151b",
    webPreferences: {
      preload: join(app.getAppPath(), "dist/electron/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await window.loadFile(join(app.getAppPath(), "dist/renderer/index.html"));
}

ipcMain.handle("graphwar-map-maker:list-maps", async () => listSavedMaps());

ipcMain.handle("graphwar-map-maker:get-maps-directory", async () => ({
  directory: await savedMapsDirectory()
}));

ipcMain.handle("graphwar-map-maker:choose-map-file", async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: "Graphwar map JSON", extensions: ["json"] }],
    properties: ["openFile"],
    title: "Import Graphwar Map"
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  return {
    canceled: false,
    contents: await readFile(filePath, "utf8"),
    filePath
  };
});

ipcMain.handle("graphwar-map-maker:read-map", async (_event, payload: { filePath: string }) => ({
  contents: await readFile(payload.filePath, "utf8"),
  filePath: payload.filePath
}));

ipcMain.handle("graphwar-map-maker:save-map", async (_event, payload: SaveMapPayload) => {
  const filePath = payload.filePath ?? (await uniqueMapFilePath(payload.mapName));
  await writeFile(filePath, payload.contents, "utf8");
  return { filePath };
});

ipcMain.handle("graphwar-map-maker:rename-map", async (_event, payload: { filePath: string; nextName: string }) => {
  const contents = await readFile(payload.filePath, "utf8");
  const parsed = JSON.parse(contents) as { name?: string };
  parsed.name = payload.nextName.trim();
  const nextFilePath = await uniqueMapFilePath(payload.nextName, payload.filePath);
  await writeFile(nextFilePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  if (nextFilePath !== payload.filePath) {
    await unlink(payload.filePath);
  }
  return { filePath: nextFilePath, name: parsed.name };
});

ipcMain.handle("graphwar-map-maker:delete-map", async (_event, payload: { filePath: string }) => {
  await unlink(payload.filePath);
  return { deleted: true };
});

ipcMain.handle("graphwar-map-maker:open-maps-folder", async () => {
  const directory = await savedMapsDirectory();
  const error = await shell.openPath(directory);
  return { opened: error.length === 0, error: error || undefined, directory };
});

app.whenReady().then(() => {
  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

async function savedMapsDirectory(): Promise<string> {
  const directory = join(app.getPath("documents"), "Graphwar Maps");
  await mkdir(directory, { recursive: true });
  return directory;
}

async function listSavedMaps(): Promise<SavedMapSummary[]> {
  const directory = await savedMapsDirectory();
  const entries = await readdir(directory);
  const summaries: SavedMapSummary[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".graphwar-map.json") && !entry.endsWith(".json")) {
      continue;
    }

    const filePath = join(directory, entry);
    try {
      const [contents, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
      const parsed = JSON.parse(contents) as { name?: unknown };
      if (typeof parsed.name !== "string" || parsed.name.trim().length === 0) {
        continue;
      }
      summaries.push({
        filePath,
        name: parsed.name,
        updatedAt: fileStat.mtime.toISOString()
      });
    } catch {
      // Ignore files in the saved-map folder that are not valid JSON map files.
    }
  }

  return summaries.sort((left, right) => left.name.localeCompare(right.name));
}

async function uniqueMapFilePath(mapName: string, existingFilePath?: string): Promise<string> {
  const directory = await savedMapsDirectory();
  const baseName = slugify(mapName);
  let index = 1;
  let candidate = join(directory, `${baseName}.graphwar-map.json`);

  while (existsSync(candidate) && candidate !== existingFilePath) {
    index += 1;
    candidate = join(directory, `${baseName}-${index}.graphwar-map.json`);
  }

  return candidate;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "map";
}
