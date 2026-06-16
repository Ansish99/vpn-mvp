const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFile, spawn } = require("node:child_process");
const https = require("node:https");
const { generateKeyPair } = require("./wgKeys.cjs");

const WG_INTERFACE_NAME = "wgvpn0";
const confPath = path.join(os.tmpdir(), `${WG_INTERFACE_NAME}.conf`);

function buildConfig({ privateKey, assignedIp, dns, serverPublicKey, endpointHost, endpointPort }) {
  return [
    "[Interface]",
    `PrivateKey = ${privateKey}`,
    `Address = ${assignedIp}/32`,
    dns ? `DNS = ${dns}` : null,
    "",
    "[Peer]",
    `PublicKey = ${serverPublicKey}`,
    `Endpoint = ${endpointHost}:${endpointPort}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * wg-quick needs root to create a network interface. We shell out via
 * pkexec so Linux desktops show a native auth prompt instead of requiring
 * the whole app to run as root. macOS/Windows need an equivalent privileged
 * helper (see README) — out of scope for this MVP.
 *
 * stdio is inherited (not piped) so that when no graphical polkit agent is
 * running, pkexec's text-based password fallback can actually read from the
 * terminal this app was launched from instead of failing instantly against
 * a disconnected pipe.
 */
function runPrivileged(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("pkexec", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${args.join(" ")} exited with code ${code}`));
    });
  });
}

function fetchPublicIp() {
  return new Promise((resolve, reject) => {
    https
      .get("https://api.ipify.org?format=json", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).ip);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

ipcMain.handle("wg:generateKeyPair", () => generateKeyPair());

ipcMain.handle("wg:connect", async (_event, tunnelConfig) => {
  const conf = buildConfig(tunnelConfig);
  fs.writeFileSync(confPath, conf, { mode: 0o600 });
  await runPrivileged(["wg-quick", "up", confPath]);
  return { ok: true };
});

ipcMain.handle("wg:disconnect", async () => {
  if (fs.existsSync(confPath)) {
    await runPrivileged(["wg-quick", "down", confPath]);
    fs.unlinkSync(confPath);
  }
  return { ok: true };
});

ipcMain.handle("system:publicIp", () => fetchPublicIp());

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
