import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("graphwarMapMaker", {
  chooseMapFile: () =>
    ipcRenderer.invoke("graphwar-map-maker:choose-map-file") as Promise<
      { canceled: true } | { canceled: false; contents: string; filePath: string }
    >,
  deleteMap: (payload: { filePath: string }) =>
    ipcRenderer.invoke("graphwar-map-maker:delete-map", payload) as Promise<{ deleted: boolean }>,
  getMapsDirectory: () =>
    ipcRenderer.invoke("graphwar-map-maker:get-maps-directory") as Promise<{ directory: string }>,
  listMaps: () =>
    ipcRenderer.invoke("graphwar-map-maker:list-maps") as Promise<
      Array<{ filePath: string; name: string; updatedAt?: string }>
    >,
  openMapsFolder: () =>
    ipcRenderer.invoke("graphwar-map-maker:open-maps-folder") as Promise<{
      directory: string;
      error?: string;
      opened: boolean;
    }>,
  readMap: (payload: { filePath: string }) =>
    ipcRenderer.invoke("graphwar-map-maker:read-map", payload) as Promise<{ contents: string; filePath: string }>,
  renameMap: (payload: { filePath: string; nextName: string }) =>
    ipcRenderer.invoke("graphwar-map-maker:rename-map", payload) as Promise<{ filePath: string; name: string }>,
  saveMap: (payload: { contents: string; filePath?: string; mapName: string }) =>
    ipcRenderer.invoke("graphwar-map-maker:save-map", payload) as Promise<{ filePath: string }>
});
