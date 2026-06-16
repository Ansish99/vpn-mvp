export interface WgKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface TunnelConfig {
  privateKey: string;
  assignedIp: string;
  dns: string;
  serverPublicKey: string;
  endpointHost: string;
  endpointPort: number;
}

declare global {
  interface Window {
    vpn: {
      generateKeyPair: () => Promise<WgKeyPair>;
      connect: (tunnelConfig: TunnelConfig) => Promise<{ ok: true }>;
      disconnect: () => Promise<{ ok: true }>;
      getPublicIp: () => Promise<string>;
    };
  }
}
