import type { BrowserWindowConstructorOptions } from "electron";
import { join } from "node:path";

export type ApplicationMenuApi = {
  setApplicationMenu(menu: unknown): void;
};

export function createMainWindowOptions(appPath: string): BrowserWindowConstructorOptions {
  return {
    autoHideMenuBar: true,
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: "Graphwar Map Maker",
    backgroundColor: "#12151b",
    webPreferences: {
      preload: join(appPath, "dist/electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
}

export function hideApplicationMenu(menuApi: ApplicationMenuApi) {
  menuApi.setApplicationMenu(null);
}
