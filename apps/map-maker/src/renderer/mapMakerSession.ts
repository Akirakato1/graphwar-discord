export type ReturnToMainMenuReset = {
  cameraBounds: null;
  clipboard: null;
  currentFile: null;
  drag: null;
  message: "Ready";
  state: null;
  tool: "select";
};

export function createReturnToMainMenuReset(): ReturnToMainMenuReset {
  return {
    cameraBounds: null,
    clipboard: null,
    currentFile: null,
    drag: null,
    message: "Ready",
    state: null,
    tool: "select"
  };
}
