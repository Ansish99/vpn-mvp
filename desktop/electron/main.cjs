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
 * wg-quick needs root to create a network interface. We use `sudo -n`
 * against a scoped NOPASSWD sudoers rule for just the wg-quick binary
 * (see README) — this avoids depending on a graphical polkit agent or on
 * password prompts surviving however the app's stdio happens to be wired
 * up by whatever launched it (a real problem with pkexec's text fallback
 * under tools like `concurrently`). macOS/Windows need an equivalent
 * privileged helper — out of scope for this MVP.
 */
function runPrivileged(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("sudo", ["-n", ...args], { stdio: "inherit" });
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
  // Linux only: sync openresolv with systemd-resolved before bringing the
  // interface up; without this wg-quick fails with "resolvconf: signature
  // mismatch". macOS has no resolvconf — wg-quick handles DNS itself there.
  if (process.platform === "linux") {
    await runPrivileged(["resolvconf", "-u"]);
  }
  // Tear down any stale interface left over from a previous session.
  await runPrivileged(["wg-quick", "down", confPath]).catch(() => {});
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
