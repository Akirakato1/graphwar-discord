import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("graphwarMapMaker", {
  deleteMap: (payload: { filePath: string }) =>
    ipcRenderer.invoke("graphwar-map-maker:delete-map", payload) as Promise<{ deleted: boolean }>,
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
