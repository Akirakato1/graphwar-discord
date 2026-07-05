import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

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

ipcMain.handle("graphwar-map-maker:save-map", async (_event, payload: { defaultPath: string; contents: string }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.defaultPath,
    filters: [
      {
        name: "Graphwar Map",
        extensions: ["graphwar-map.json", "json"]
      }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await writeFile(result.filePath, payload.contents, "utf8");
  return { canceled: false, filePath: result.filePath };
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
