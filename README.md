# SecureTunnel — VPN MVP

The smallest functional product that proves: register/login → pick a server →
one click → real WireGuard tunnel → traffic encrypted, IP changed.

## Architecture

```
desktop/   Electron + React. Login/dashboard UI. Generates the client's
           WireGuard keypair locally (private key never leaves the device),
           writes a wg-quick config, and brings the tunnel up/down.

server/    Two Node/Express processes:
  src/index.ts        Central API — accounts (SQLite), the 3-location
                       server catalog, session bookkeeping, IP allocation.
                       Never touches a WireGuard interface itself.
  src/wg/agentServer.ts  wg-agent — a tiny privileged helper that runs ON
                       each real VPN box and is the only thing that ever
                       runs `wg`. The central API calls it over HTTPS with
                       a shared secret to add/remove a peer.
```

This split (control plane vs. per-node agent) is the standard shape used by
real commercial VPN backends, and it's what lets the central API run
anywhere while the privileged `wg` commands stay confined to the boxes that
actually need them.

## Running it locally (UI + accounts, without a real tunnel)

```
cd server && cp .env.example .env && npm install && npm run dev
cd desktop && npm install && npm run dev:electron
```

You can register, log in, and browse the 3 server locations. Clicking
**Connect** will fail at the network call to the (placeholder)
`vpn-*.example.com` endpoints in `server/src/config/servers.json` — that's
expected until you provision real servers (next section).

## Provisioning a real WireGuard server (per location)

Repeat this for each location you want live (we ship 3: US East, EU West,
Asia Pacific). A $5/mo VPS (DigitalOcean, Hetzner, Vultr, etc.) per region
is enough for an MVP.

1. **Spin up an Ubuntu 22.04+ box**, note its public IP.

2. **Install WireGuard:**
   ```
   apt update && apt install -y wireguard
   ```

3. **Generate the server's own keypair:**
   ```
   wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
   chmod 600 /etc/wireguard/server_private.key
   ```

4. **Create `/etc/wireguard/wg0.conf`:**
   ```
   [Interface]
   PrivateKey = <contents of server_private.key>
   Address = 10.7.0.1/24      # match subnetCidr for this location
   ListenPort = 51820
   PostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
   PostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
   ```
   (Adjust `eth0` to the box's actual internet-facing interface, and enable
   IP forwarding: `sysctl -w net.ipv4.ip_forward=1` and persist it in
   `/etc/sysctl.conf`.)

5. **Bring the interface up and enable it on boot:**
   ```
   wg-quick up wg0
   systemctl enable wg-quick@wg0
   ```

6. **Deploy `wg-agent` onto the same box** (it needs to run as a user that
   can execute `wg set`, typically root via systemd):
   ```
   # copy the server/ directory to the box, then:
   cd server && npm install && npm run build
   AGENT_SHARED_SECRET=<same secret as central API> AGENT_PORT=5000 \
     WG_INTERFACE=wg0 node dist/wg/agentServer.js
   ```
   Put this behind TLS — either terminate TLS with Caddy/nginx in front of
   port 5000, or only expose port 5000 on a private network the central API
   reaches over WireGuard/VPC peering. Don't expose the shared-secret API
   over plain HTTP on the public internet.

7. **Open firewall ports:** UDP 51820 (WireGuard) publicly; TCP 5000
   (wg-agent) only to the central API's IP.

8. **Update `server/src/config/servers.json`** for that location:
   - `endpointHost` → the box's public IP or DNS name
   - `serverPublicKey` → contents of `server_public.key`
   - `agentUrl` → `https://<box>:5000` (or your reverse-proxy URL)

Once all 3 entries point at real boxes with `wg-agent` running, the
Connect button performs a real WireGuard handshake: the client generates
its own keypair, the central API registers the public half as a peer via
wg-agent, and `wg-quick up` brings the tunnel up locally.

## Known MVP limitations (intentional)

- One active tunnel per user; connecting elsewhere drops the previous one.
- Client private keys are not persisted across desktop-app restarts — a
  restart always reconciles to "disconnected" rather than resuming a
  stale tunnel.
- Linux-only privilege escalation path for `wg-quick` (`pkexec`). macOS/
  Windows need an equivalent (e.g. a signed helper or the official
  WireGuard NetworkExtension/service) — out of scope for this MVP.
- No kill switch, split tunneling, ad/malware blocking, dedicated IPs, or
  usage analytics, by design.
