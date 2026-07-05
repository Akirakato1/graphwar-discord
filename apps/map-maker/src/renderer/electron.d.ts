export {};

declare global {
  interface Window {
    graphwarMapMaker?: {
      saveMap(payload: { defaultPath: string; contents: string }): Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}
