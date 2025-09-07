const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

// // Handle A* step request from renderer
ipcMain.handle("run-astar-step", async (event, { gridData, startId, endId }) => {
  
  return new Promise((resolve, reject) => {
    const child = spawn("./astar"); 

    let output = "";
    child.stdout.on("data", (data) => (output += data.toString()));
    child.stderr.on("data", (data) => console.error(data.toString()));

    child.on("close", () => {
      try {
        console.log("AStar Output: '{}'", output);
        const result = JSON.parse(output);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    child.stdin.write(JSON.stringify({ gridData, startId, endId }) + "\n");
    child.stdin.end();
  });
});
