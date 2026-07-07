import { describe, expect, it, vi } from "vitest";
import { createMainWindowOptions, hideApplicationMenu } from "./mainWindowOptions";

describe("mainWindowOptions", () => {
  it("hides Electron menu chrome on the map maker window", () => {
    const options = createMainWindowOptions("C:/graphwar/map-maker");

    expect(options.autoHideMenuBar).toBe(true);
  });

  it("removes the native application menu", () => {
    const menuApi = {
      setApplicationMenu: vi.fn()
    };

    hideApplicationMenu(menuApi);

    expect(menuApi.setApplicationMenu).toHaveBeenCalledWith(null);
  });
});
