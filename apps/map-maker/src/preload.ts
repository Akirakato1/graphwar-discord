import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("graphwarMapMaker", {
  saveMap: (payload: { defaultPath: string; contents: string }) =>
    ipcRenderer.invoke("graphwar-map-maker:save-map", payload) as Promise<{ canceled: boolean; filePath?: string }>
});
