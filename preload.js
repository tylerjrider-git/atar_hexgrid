const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  exportGrid: (gridData) => ipcRenderer.send("export-grid", gridData),
  runAStarStep: (gridData, startId, endId) => ipcRenderer.invoke("run-astar-step", { gridData, startId, endId }),
});
