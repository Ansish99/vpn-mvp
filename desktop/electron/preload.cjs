const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vpn", {
  generateKeyPair: () => ipcRenderer.invoke("wg:generateKeyPair"),
  connect: (tunnelConfig) => ipcRenderer.invoke("wg:connect", tunnelConfig),
  disconnect: () => ipcRenderer.invoke("wg:disconnect"),
  getPublicIp: () => ipcRenderer.invoke("system:publicIp"),
});
