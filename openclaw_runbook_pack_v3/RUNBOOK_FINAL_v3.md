# OpenClaw + Antfarm Runbook (Droplet)

**Operator:** `root`  
**Goal:** One set of commands to (1) see what’s running, (2) restart safely, (3) tail logs, (4) prove “green” after any change or reboot.

This runbook is grounded in your captured host inventory (Ubuntu 24.04.3, OpenClaw 2026.1.30, Antfarm wrapper paths, ports). fileciteturn0file0L1-L14

---

## What’s running (pinned)

### OpenClaw Gateway
- Managed by OpenClaw’s gateway service (systemd-backed).
- Binds to **127.0.0.1:18789**. fileciteturn0file0L11-L14
- Canonical commands:
  - `openclaw gateway status` fileciteturn0file0L11-L12
  - `openclaw gateway logs` fileciteturn0file0L11-L12
  - `openclaw gateway restart` (this is the correct restart command)

### Antfarm Dashboard
- Node process listening on **0.0.0.0:3333**. fileciteturn0file0L9-L10
- Antfarm CLI supports:
  - `antfarm dashboard status` fileciteturn0file0L5-L6
  - `antfarm dashboard start --port 3333`
  - `antfarm dashboard stop`
- State/logs live in: `~/.openclaw/antfarm/` (includes `dashboard.log`, `dashboard.pid`). fileciteturn0file0L8-L10

### Nginx
- Listening on **0.0.0.0:8443**. fileciteturn0file0L10-L10  
- You want to “get to nginx” eventually for clean access. For **fastest + safest now**, we keep dashboard access via **SSH tunnel** and treat nginx as optional until routing is confirmed.

---

## Directory map (pinned)

### SmartFunds operational directory
- `/root/smartfunds/`
  - `bin/` wrappers (`antfarm`, `git-auth`) fileciteturn0file0L5-L7
  - `secrets/` (includes `github.env`, `git-askpass.sh`) fileciteturn0file0L6-L8
  - `workspaces/` (repo clones) fileciteturn0file0L7-L8

### Antfarm state
- `/root/.openclaw/antfarm/`
  - `antfarm.db` (+ wal/shm)
  - `dashboard.log`, `dashboard.pid`
  - `events.jsonl` fileciteturn0file0L8-L10

---

## The only day-to-day commands you should use

This runbook comes with a helper command: **`openclawrb`**.

### 1) Status
```bash
openclawrb status
```

### 2) Restart (gateway + dashboard)
```bash
openclawrb restart
```

### 3) Logs
```bash
openclawrb logs
```

### 4) Ports
```bash
openclawrb ports
```

### 5) Smoke test (“green/red”)
```bash
openclawrb smoke
```

---

## Fastest access method (right now): SSH tunnel to dashboard

Because the dashboard currently binds to `*:3333` fileciteturn0file0L9-L10, the **fastest + safest** thing is to treat it as local and access it via tunnel:

From your laptop:
```bash
ssh -L 3333:127.0.0.1:3333 root@<DROPLET_IP>
```

Then open in your local browser:
- `http://127.0.0.1:3333`

This avoids nginx config work while you’re still stabilizing the system.

---

## “Green” definition (opinionated defaults)

After any restart, you are **green** when all 3 are true:

1) Gateway status is OK:
```bash
openclaw gateway status
```
Look for RPC probe OK and listening on `127.0.0.1:18789`. fileciteturn0file0L11-L14

2) Dashboard is running:
```bash
antfarm dashboard status
```
(via the wrapper is best; see next section) fileciteturn0file0L5-L7

3) Dashboard port responds:
```bash
curl -sS -I http://127.0.0.1:3333/ | head
```

`openclawrb smoke` checks these automatically (HTTP status may be 200/302/401/404 depending on the dashboard app — any “real” HTTP code is acceptable, “000” is not).

---

## Canonical execution rules (to prevent “fix 1 thing, break 3”)

### Rule 1 — Always use the Antfarm wrapper
Use:
- `/root/smartfunds/bin/antfarm` fileciteturn0file0L5-L7

Why: it exports `ANT_FARM_WORKSPACE=/root/smartfunds/workspaces` and sources GitHub credentials from `/root/smartfunds/secrets/github.env`. fileciteturn0file0L5-L7

### Rule 2 — One change per cycle
No refactors. No “while I’m here.”  
Cycle is always:
```bash
openclawrb status
# make one change
openclawrb restart
openclawrb smoke
```

### Rule 3 — Trust ports, not memory
When confused about “3000 vs 3333 vs ???”:
```bash
openclawrb ports
```

---

## Logs (where to look first)

### Gateway logs
```bash
openclaw gateway logs
```

### Dashboard logs
```bash
tail -n 250 /root/.openclaw/antfarm/dashboard.log
```
fileciteturn0file0L8-L10

---

## Nginx plan (later, once stable)

You said you want to “get to nginx.” Here’s the lowest-risk progression:

### Phase A (now): SSH tunnel
No nginx changes required.

### Phase B: nginx reverse proxy to dashboard (recommended)
Once you decide what hostname/URL you want, set nginx to proxy:
- `https://<your-domain>:8443/` → `http://127.0.0.1:3333/`

**When you’re ready**, paste the nginx site config you’re using (file path and contents), and we’ll add:
- exact config block
- `nginx -t` verification
- reload command
- optional basic auth

### Should nginx be restarted by default?
**No (default).** Restarting nginx can disrupt access and isn’t required for normal OpenClaw/Antfarm operations.
If you want a “full restart including nginx”, use:
```bash
sudo systemctl restart nginx
```

---

## Troubleshooting

### If `openclawrb smoke` fails
1) Check status + ports:
```bash
openclawrb status
openclawrb ports
```

2) Pull logs:
```bash
openclawrb logs
```

3) If dashboard is down:
```bash
/root/smartfunds/bin/antfarm dashboard status
/root/smartfunds/bin/antfarm dashboard start --port 3333
```

### If gateway is down
```bash
openclaw gateway status
openclaw gateway restart
openclaw gateway logs
```

---

## Appendix: Verified versions (for future debugging)
Ubuntu 24.04.3, Node v22.22.0, Python 3.12.3, OpenClaw 2026.1.30. fileciteturn0file0L2-L5
