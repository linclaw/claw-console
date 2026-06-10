# Local claw-console infrastructure — `http://claw.local`

Make the console reachable from any device on the LAN at a clean hostname
(`http://claw.local`) instead of an IP and port.

```
            ┌──────────────── your Mac (LAN, via mDNS) ─────────────────┐
 phone /    │                                                           │
 PC on  ──► │  nginx :80 ──► Vite dev server 127.0.0.1:5174 ──┐         │
 the LAN    │  (claw.local)        (claw-console, via pm2)     │ /ws,/api │
            │                                                  └─► gateway│
            │                                          127.0.0.1:18789    │
            └───────────────────────────────────────────────────────────┘
```

Three independent pieces make this work:

1. **Name → IP (mDNS).** `claw.local` is advertised LAN-wide over mDNS / Bonjour
   by a LaunchDaemon ([`mdns/`](mdns/)). No router config, no per-device hosts
   files — Apple devices and most modern OSes resolve it automatically. This is
   the same mechanism that makes the machine answer to its own `gym.local` name;
   `claw.local` is simply advertised on top of it.
2. **Clean port (nginx).** nginx on :80 reverse-proxies to the Vite dev server
   on `5174`, routing by `Host` header (`server_name claw.local`).
   Config: [`nginx/claw.local.conf`](nginx/claw.local.conf).
3. **App process (pm2).** The Vite dev server runs under pm2 so it stays up.
   Config: [`../ecosystem.config.cjs`](../ecosystem.config.cjs).

The app talks to the OpenClaw gateway over a **relative** path
(`ws://<host>/ws`), so the single `claw.local` origin serves the UI and proxies
the gateway through Vite — no per-device config.

> **Why a different port (5174)?** The `home-gym` dev server already owns Vite's
> default `5173` on this machine. claw-console uses `5174` (set in
> `vite.config.ts`, `strictPort: true`) so the two never collide. nginx routes
> `gym.local` → 5173 and `claw.local` → 5174 by hostname, both on :80.

---

## 1. Advertise `claw.local` over mDNS (LaunchDaemon)

```sh
sh infra/mdns/install.sh    # generates this checkout's plist, then installs it (sudo)
```

`install.sh` fills
[`com.clawconsole.mdns.plist.template`](mdns/com.clawconsole.mdns.plist.template)
with this checkout's absolute path to `advertise-claw-local.sh` — the resulting
plist is machine-specific, so it's generated and **gitignored**, not committed —
then copies it into `/Library/LaunchDaemons/` and loads it. The daemon runs
[`mdns/advertise-claw-local.sh`](mdns/advertise-claw-local.sh), which detects the
LAN IP and holds open a `dns-sd -P` registration for the `claw.local` address
record. `KeepAlive` restarts it on crash; `RunAtLoad` starts it at boot.

Manage it:

```sh
sudo launchctl unload /Library/LaunchDaemons/com.clawconsole.mdns.plist   # stop
sudo launchctl kickstart -k system/com.clawconsole.mdns                   # restart
tail -f /tmp/claw-mdns.log                                                # logs
```

> The plist embeds an absolute path, so it's generated (gitignored), not
> committed. If you move this repo, re-run `install.sh`.

## 2. Start nginx on :80

The site config is symlinked into Homebrew's nginx from this repo:

```sh
# one-time link (re-run if you move the repo):
ln -sf "$PWD/infra/nginx/claw.local.conf" /opt/homebrew/etc/nginx/servers/claw.local.conf

nginx -t                          # validate (no sudo, no bind)
sudo brew services start nginx    # run on :80 and auto-start at login
```

After editing `claw.local.conf`, reload without dropping connections:

```sh
nginx -t && sudo nginx -s reload
```

> nginx already serves `gym.local` on this machine from the home-gym repo. Both
> sites coexist on :80; nginx picks by `server_name`. Each site's config defines
> its own uniquely-named `map $http_upgrade ...` variable so the shared
> `include servers/*;` never hits a duplicate-`map` error.

## 3. Run the app under pm2

Requires a global pm2 (`npm i -g pm2`).

```sh
npm start      # pm2 start ecosystem.config.cjs   (Vite dev server on :5174)
npm run logs   # pm2 logs claw-console
npm stop       # pm2 delete ecosystem.config.cjs
```

Survive reboots:

```sh
pm2 save
pm2 startup    # prints a sudo command — run it once
```

The app reads gateway connection settings (`VITE_GATEWAY_*`) from `.env`
(gitignored); see [`../.env.example`](../.env.example).

---

## Verify

```sh
ping claw.local                      # resolves to this Mac's LAN IP
curl -I http://claw.local            # HTTP/1.1 200, content-type text/html
```

Then open `http://claw.local` from any device on the same LAN.

## Gotchas

- **Keep the app process running** (`npm start` / pm2). nginx only proxies.
- **HMR** connects straight to `:5174` (Vite `host: true`), so keep that port
  reachable on the LAN for live-reload; the app itself works over `claw.local`
  even if 5174 is closed.
- **Vite `allowedHosts`** already includes `claw.local` (see `vite.config.ts`);
  without it Vite returns a "Blocked request" page for the proxied hostname.
- **Browser "Secure DNS" / DoH** does not affect `.local` (mDNS is resolved by
  the OS, not the browser's DNS), so this is immune to the DoH issues that bite
  router-based local DNS.
- **DHCP IP changes.** The mDNS advert re-detects the IP each time the daemon
  (re)starts. If the LAN IP changes while it's running, restart the daemon
  (step 1) or pin the IP with a DHCP reservation in the router.
- **Port 80 already in use?** `sudo lsof -nP -iTCP:80 -sTCP:LISTEN`.
