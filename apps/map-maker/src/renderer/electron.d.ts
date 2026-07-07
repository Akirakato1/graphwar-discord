export {};

declare global {
  interface Window {
    graphwarMapMaker?: {
      deleteMap(payload: { filePath: string }): Promise<{ deleted: boolean }>;
      listMaps(): Promise<Array<{ filePath: string; name: string; updatedAt?: string }>>;
      openMapsFolder(): Promise<{ directory: string; error?: string; opened: boolean }>;
      readMap(payload: { filePath: string }): Promise<{ contents: string; filePath: string }>;
      renameMap(payload: { filePath: string; nextName: string }): Promise<{ filePath: string; name: string }>;
      saveMap(payload: { contents: string; filePath?: string; mapName: string }): Promise<{ filePath: string }>;
    };
  }
}
