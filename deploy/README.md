# Deploying funOS

funOS is a static SPA: one nginx container, no database, no secrets. It follows
the shared-VPS conventions — no published ports, one route file in
`/opt/traefik/dynamic/`, everything named `funos-*`.

| | |
|---|---|
| Host | `187.127.82.45` (`ssh root@187.127.82.45`) |
| App directory | `/opt/funos/` |
| Hostname | `khirokhito.tech` (the apex; Oqu has been moved off it) |
| Container | `funos-web`, alias `funos-web` on the `proxy` network |
| Route file | `/opt/traefik/dynamic/funos.yml` (source: `deploy/funos.yml`) |
| Health | `https://khirokhito.tech/health` → `{"status":"ok","version":"<sha>"}` |
| Box needs | `docker`, `git`, `curl`, `jq` |

## What runs where

- **GitHub Actions** (`.github/workflows/ci.yml`) — actionlint and shellcheck,
  `tsc -b`, eslint, the Vite build, a gzipped bundle-size guard, gitleaks, and a
  real build of `deploy/Dockerfile` with a smoke test against the running
  container. Nothing in CI touches the box and no SSH key lives in the repository.
- **The box deploys itself.** `funos-deploy.timer` runs `auto_deploy.sh` every
  ~90s; it watches `origin/main` and deploys when it moves. Merging to main is
  deploying.
- **The gate lives on the box, not in the job graph.** This is the one real
  difference from Tazabar, which pushes a deploy from a CI job gated on `needs:`.
  A pull deployer cannot be gated that way — the timer does not read the workflow
  — so `auto_deploy.sh` asks the GitHub API for the commit's **`ci.yml` run** and
  refuses to even check out a commit whose run is not green. Only that one
  workflow counts; `cve-watch.yml` and `verify-deploy.yml` never block a deploy.
  Unauthenticated, because the repo is public: there is no token on the server.
- **A refused commit is retried every 30 minutes**, not every tick, and recorded
  in `/opt/funos/.refused`. Re-running CI from the Actions UI and getting green
  is enough to un-refuse it; so is pushing a new commit.
- **CI closes the loop.** `verify-deploy.yml` runs when a `ci.yml` run on main
  completes green, and polls `/health` until it reports that commit. That is
  detection, not prevention — it catches the deploy that never happened (stopped
  timer, box offline, build that dies on 2 vCPU). Skipped until the repository
  variable `DEPLOY_HEALTH_URL` is set.
- **`cve-watch.yml`** scans `package-lock.json` and the nginx base image with
  Trivy every Monday and on any change to either, and fails with a written
  summary if a *fixable* CRITICAL/HIGH lands. `.github/dependabot.yml` opens the
  PR that fixes it.

## Before the first deploy: check the names are free

funOS takes the apex, `khirokhito.tech`. The deployment guide still lists that as
Oqu's — stale. Checked on the box on 2026-09-14, before installing: the apex
appears in no route file. Oqu answers on the bare IP (``Host(`187.127.82.45`)``),
and the four subdomains in use are `arc.`, `taza.`, `tender.` and `s3.`.

Names are global on this box and a collision is silent, not an error: two routers
matching the same host means Traefik picks by priority and the loser disappears
with nothing in any log. So confirm before installing, the way the guide's
checklist does:

```bash
ls /opt/                                  # taken directories
ls /opt/traefik/dynamic/                  # taken route files
grep -rh "Host(" /opt/traefik/dynamic/    # taken hostnames
docker ps --format '{{.Names}}'           # taken container names
```

If something unexpected already routes the apex, change the `rule` in
`deploy/funos.yml` to a free subdomain, commit it, and add the matching A record.
Nothing else in this directory needs to change.

`www.khirokhito.tech` is not claimed by this route file. If you want it to
resolve, add a second router for it and its own A record — otherwise it 404s.

## First-time install

```bash
ssh root@187.127.82.45

# 0. jq — a command-line JSON parser. auto_deploy.sh asks the GitHub API whether
#    the commit's CI checks passed, and that answer comes back as JSON; jq is
#    what reads it. Without jq the deployer cannot get a verdict and will never
#    deploy. Ubuntu does not ship it by default.
apt-get update && apt-get install -y jq

# 1. Clone (public repo, so no deploy key needed)
mkdir -p /opt/funos && cd /opt/funos
git clone https://github.com/Takhirzhon/funOS.git .

# 2. DNS: A record for the chosen hostname -> 187.127.82.45, and let it resolve
#    before the first request. Let's Encrypt verifies over port 80.
dig +short khirokhito.tech

# 3. Bring the stack up
export GIT_SHA=$(git rev-parse HEAD)
docker compose -f deploy/docker-compose.yml up -d --build

# 4. Publish the route. Dropping the file in is enough: the proxy runs with
#    --providers.file.watch=true and picked this up in under 8 seconds, with a
#    certificate, on 2026-09-14. Do NOT force-recreate traefik here "to be
#    sure" - it is the shared proxy, and restarting it to install a new app
#    interrupts the four that were already running.
install -m 644 deploy/funos.yml /opt/traefik/dynamic/funos.yml

# 5. Verify. A 200 over HTTP/2 means the certificate issued; there is no need
#    to read the Traefik log unless it does not.
curl -sI https://khirokhito.tech | head -1
curl -s https://khirokhito.tech/health

# 6. Record what is live, so the first timer tick does not redeploy it
git rev-parse HEAD > /opt/funos/.deployed_sha
```

## Enable automatic deploys

```bash
install -m 644 /opt/funos/deploy/funos-deploy.service /etc/systemd/system/
install -m 644 /opt/funos/deploy/funos-deploy.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now funos-deploy.timer

systemctl list-timers funos-deploy.timer
journalctl -u funos-deploy -f
```

### Tell CI where to look

The `verify-deploy` job needs to know the site's URL to confirm a deploy landed.
That URL is not hardcoded in the workflow, because before the box exists there is
nothing to poll and the job would fail on every push for a reason nobody can fix.
So it reads a **repository variable** — a plain, non-secret key/value pair stored
on the repo, readable in a workflow as `${{ vars.NAME }}`.

GitHub → your repo → **Settings** → **Secrets and variables** → **Actions** →
**Variables** tab → *New repository variable*:

```
Name:  DEPLOY_HEALTH_URL
Value: https://khirokhito.tech/health
```

Not a *secret* — a health URL is public and secrets are write-only, so you could
never read it back to check. Until this exists the job prints "skipping deploy
verification" and passes; once it exists, a push to main that the box fails to
deploy turns the pipeline red.

Set on 2026-09-14, once `/health` answered. `verify-deploy` is live from that
point on, so a red one means the box did not take the commit — not that the
commit is bad.

## Day to day

```bash
DC="docker compose -f /opt/funos/deploy/docker-compose.yml"
$DC ps
$DC logs -f web
systemctl start funos-deploy.service        # deploy now, do not wait for the tick
cat /opt/funos/.deployed_sha                # what is live
git -C /opt/funos rev-parse origin/main     # what should be live
cat /opt/funos/.refused                     # "<sha> <epoch>" if the last attempt was refused
rm /opt/funos/.refused                      # retry a refused commit now instead of in 30 min
```

`auto_deploy.sh` runs `git reset --hard`, so **never hand-edit files in
`/opt/funos`** — the next tick discards them. Change the repo and merge.

### Deploying a commit CI refuses

There is no override flag, deliberately. If a build must go out while CI is red,
fix or revert on `main` — or, knowing exactly what you are skipping, build it by
hand and record it so the timer does not undo you:

```bash
cd /opt/funos && git fetch origin main && git reset --hard origin/main
export GIT_SHA=$(git rev-parse HEAD)
docker compose -f deploy/docker-compose.yml up -d --build
git rev-parse HEAD > .deployed_sha
```

This is also the path if `ci_verdict` in `auto_deploy.sh` itself has a bug that
refuses everything: the box asks CI *before* it checks out a commit, so the old
script decides whether the fix gets checked out. One manual reset, and the new
script takes over from the next tick.

## Troubleshooting

| Symptom | Cause |
|---|---|
| 404 on the hostname | `Host()` typo, invalid YAML in `funos.yml`, or Traefik never reloaded it — force-recreate traefik |
| 502 Bad Gateway | `url:` in `funos.yml` does not match the network alias, or the port is not the container-internal `80` |
| 503 Service Unavailable | `funos-web` is not on the `proxy` network, or it is down |
| Certificate never issues | A record missing, or port 80 unreachable for the ACME challenge |
| Intermittent wrong app | another project answers to the same alias on `proxy` |
| Deep link 404s, `/` works | nginx SPA fallback broken — check `try_files` in `deploy/nginx.conf` |
| Change is not live | `cat .deployed_sha` vs `git rev-parse origin/main`, then `cat .refused` and `journalctl -u funos-deploy -n 50` |
| `ci: run in_progress` for 40 min, then failure | a job in `ci.yml` is hanging or waiting on something. Only `ci.yml` is consulted, so a new workflow cannot cause this — look at the run the log links |
| `CI failed ... refusing` | working as intended. The site stays on the previous commit; the log links the run. Retried every 30 min; re-run CI green, push a fix, or `rm .refused` to retry now |
| `changes only Markdown - no CI run expected` | the range since the last deploy is docs-only, so `paths-ignore` skipped CI and the box deployed without waiting. Expected |
| `WARNING: no CI run ... not docs-only` | a code commit with no `ci.yml` run after 5 min. Actions outage, or the workflow did not trigger. It deployed anyway — go and look |
| `ci: no answer from github` repeatedly | DNS/egress from the box, or the unauthenticated API limit (60/hr per IP, shared with every other project here). The deployer makes one request per tick while waiting and none while refused; if something else on the box is hammering the API, that is where to look |
| Deployer does nothing, `journalctl` shows a bash syntax error | should not happen — CI runs `bash -n` and shellcheck on `deploy/*.sh`, and the box only checks out green commits. If it did: `git -C /opt/funos reset --hard <last good sha>` and find out how the commit got past CI |

## Notes

- There is no `.env` and no `.env.example`: funOS is a static bundle with no
  server-side configuration and nothing secret to inject. If that changes, add
  `deploy/.env` (gitignored) plus a committed `deploy/.env.example`, and wire it
  in with `env_file:`.
- There is no database, so nothing here needs a backup or a private network. The
  only stateful thing funOS has is Notepad's `localStorage`, which lives in the
  visitor's browser.
- `deploy/Dockerfile` builds from the repository root as context, which is why CI
  passes `context: .` with `file: deploy/Dockerfile`.
- The Node major in `deploy/Dockerfile` and `NODE_VERSION` in `ci.yml` must stay
  in step, or the bundle CI gated is not the bundle the box ships. Dependabot
  is told to leave the Node major alone for this reason; the nginx minor it
  bumps freely.
- Actions in `.github/workflows/` are pinned to commit SHAs with a `# vX.Y.Z`
  comment. Keep the comment when editing — it is what Dependabot reads.
