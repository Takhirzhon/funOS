#!/usr/bin/env bash
#
# Pull-based deployer for funOS. Run by funos-deploy.timer every ~90 seconds.
# Watches origin/main; when it moves and CI is green, rebuilds the stack and
# publishes routes. Merging to main is deploying.
#
#   journalctl -u funos-deploy -n 50 --no-pager
#
# Requires: docker, git, curl, jq.
#
# Five things in here are deliberate (deployment guide, section 7):
#
#   1. Progress is tracked in .deployed_sha, written only after a deploy fully
#      succeeds. Comparing against HEAD instead means a failed build still
#      leaves HEAD at the remote, every later tick concludes "nothing to do",
#      and prod serves stale containers with nothing red anywhere.
#   2. The body is a function. This script `git reset`s the file it is running
#      from and bash reads scripts incrementally; `deploy() { ... }; deploy`
#      forces bash to parse the whole thing up front.
#   3. It re-execs if the reset changed this file. Otherwise the running process
#      keeps executing the pre-reset text and a newly added step is skipped on
#      exactly the deploy that introduces it.
#   4. The CI verdict comes BEFORE `git reset --hard`, so the box never checks
#      out a commit CI has not passed. That is what protects this file: CI runs
#      `bash -n` and shellcheck on it, so a deploy script that cannot parse is
#      never green and never reaches the disk. (The old order — reset first,
#      then ask — meant a syntax error re-exec'd itself, failed, and every
#      later tick ran the broken file from disk before it could fetch a fix.)
#      The cost is that a runtime bug in ci_verdict itself is not self-healing,
#      because the OLD ci_verdict decides whether the fix gets checked out.
#      That is the manual path in deploy/README.md, "Deploying a commit CI
#      refuses", and it is a one-off `git reset` over SSH rather than a wedge.
#   5. A refused commit is remembered in .refused and retried every 30 minutes,
#      not every 90 seconds. Without that, one red build meant a failed unit
#      and an API request every tick until main moved — 40 requests an hour
#      out of the 60 the whole box shares unauthenticated — and, for a build
#      that fails on the box, a full docker build every 90s on the 2 vCPU that
#      serve the live site. 30 minutes because CI can be re-run by hand from
#      the Actions UI and turn green without a new commit.
set -euo pipefail

APP_DIR="${FUNOS_APP_DIR:-/opt/funos}"
SELF="$APP_DIR/deploy/auto_deploy.sh"
SHA_FILE="$APP_DIR/.deployed_sha"
COMPOSE_FILE="$APP_DIR/deploy/docker-compose.yml"
ROUTE_SRC="$APP_DIR/deploy/funos.yml"
ROUTE_DST="/opt/traefik/dynamic/funos.yml"
TRAEFIK_COMPOSE="/opt/traefik/docker-compose.yml"

REPO_SLUG="${FUNOS_REPO:-Takhirzhon/funOS}"
# The workflow whose run is the gate. Only this workflow counts: CVE Watch, the
# deploy verifier and anything added later never block a deploy by accident.
CI_WORKFLOW="ci.yml"
# "<sha> <epoch first seen>". Untracked, so `git reset --hard` leaves it alone.
CI_STATE_FILE="$APP_DIR/.ci_wait"
CI_NO_RUN_GRACE=300       # 5 min with no CI run at all -> this commit has no CI
CI_PENDING_TIMEOUT=2400   # 40 min stuck in-progress -> call it a failure, loudly
# "<sha> <epoch refused>". See point 5 above.
REFUSED_FILE="$APP_DIR/.refused"
REFUSED_RETRY=1800

log() { printf '[funos-deploy] %s\n' "$*"; }
hash_of() { sha1sum "$1" 2>/dev/null | cut -d' ' -f1 || true; }
is_epoch() { case "${1:-}" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }

# Record a refusal so the next REFUSED_RETRY seconds of ticks stay quiet.
refuse() {
    local sha="$1"; shift
    printf '%s %s\n' "$sha" "$(date +%s)" > "$REFUSED_FILE"
    log "ERROR: $* - refusing ${sha:0:12}. Retrying in $((REFUSED_RETRY / 60)) min, or sooner if main moves."
}

# Does the range deployed..target touch only Markdown? Then ci.yml's
# `paths-ignore: **.md` skipped it and no run will ever appear — no need to wait
# out the grace period, and no API request needed to know it. Answered from the
# local clone, which has both commits after the fetch.
docs_only() {
    local from="$1" to="$2" files
    [ "$from" != "none" ] || return 1
    files="$(git diff --name-only "$from" "$to" 2>/dev/null)" || return 1
    [ -n "$files" ] || return 1
    ! printf '%s\n' "$files" | grep -qv '\.md$'
}

# Ask GitHub whether the CI workflow passed for the commit. The repository is
# public, so this is unauthenticated — no token on the box.
#
# EXACTLY ONE request per tick. An earlier version polled every 15s inside this
# function until CI finished, which is ~60 requests during one slow run — and the
# unauthenticated limit is 60/hour per IP, shared with everything else on this
# box. It would have rate-limited itself out of ever getting a verdict, and
# because `curl -f` turns 403 into an empty body, the symptom would have been
# "github unreachable" on a perfectly reachable GitHub. The 90s timer is the
# retry loop; this function only answers "what is known right now".
#
# It asks for the WORKFLOW RUN of ci.yml, not the commit's check-runs. Check-runs
# are every job of every workflow that touched the commit — including the
# scheduled CVE scan, which attaches to whatever is HEAD on Monday morning, and
# the deploy verifier, which waits on this script and had to be excluded by
# name. One run of one named workflow has none of that.
#
# How long a commit has been waiting is tracked in a file rather than a loop
# counter, since each tick is a fresh process.
#
# Exit codes, all four of which matter:
#   0  green             -> deploy
#   1  failed, or stuck   -> refuse, loudly; nothing reaches the site
#   2  no CI run          -> deploy anyway. Immediately if the range is docs-only
#                            (see docs_only); after CI_NO_RUN_GRACE otherwise,
#                            with a warning, because a README edit must not
#                            wedge the deployer and neither must an Actions
#                            outage — but the warning is the audit trail.
#   3  no verdict yet     -> say nothing, retry on the next tick. Covers both
#                            "still running" and "could not reach GitHub":
#                            neither is a red build, and neither is a green light.
ci_verdict() {
    local sha="$1" deployed="$2"
    local api="https://api.github.com/repos/${REPO_SLUG}/actions/workflows/${CI_WORKFLOW}/runs?head_sha=${sha}&per_page=10"
    local json run status conclusion url
    local seen_sha seen_at first_seen now waited

    # Checked here rather than at the top of the file so it is reported once per
    # actual deploy attempt, not every 90 seconds forever. Refusing (1) rather
    # than proceeding: a missing parser must not silently become "no gate".
    if ! command -v jq >/dev/null 2>&1; then
        log "ERROR: jq is not installed - cannot read CI status. Run: apt-get install -y jq"
        return 1
    fi

    now="$(date +%s)"
    first_seen=""
    if [ -f "$CI_STATE_FILE" ]; then
        read -r seen_sha seen_at < "$CI_STATE_FILE" || true
        # A half-written or hand-edited state file must not take the deployer
        # down with an arithmetic error below. Anything non-numeric is treated
        # as "never seen", which costs one extra grace period at worst.
        if [ "${seen_sha:-}" = "$sha" ] && is_epoch "${seen_at:-}"; then
            first_seen="$seen_at"
        fi
    fi
    if [ -z "$first_seen" ]; then
        first_seen="$now"
        printf '%s %s\n' "$sha" "$now" > "$CI_STATE_FILE"
    fi
    waited=$(( now - first_seen ))

    json="$(curl -fsSL --max-time 15 \
        -H 'Accept: application/vnd.github+json' \
        -H 'X-GitHub-Api-Version: 2022-11-28' \
        "$api" 2>/dev/null || true)"

    if [ -z "$json" ]; then
        # Unreachable GitHub is not a green light. `-f` also makes 403 (rate
        # limit) and 404 (commit not visible yet) land here, which is the right
        # place for all three: wait and ask again.
        log "ci: no answer from github (${waited}s waiting) - retrying next tick"
        return 3
    fi

    # Newest run for this exact commit, from a push or a manual re-run. A
    # pull_request run can share the head_sha after a fast-forward merge, but
    # it tested a merge commit, not this tree, so it does not count.
    run="$(printf '%s' "$json" | jq -c '[.workflow_runs[]? | select(.event == "push" or .event == "workflow_dispatch")] | sort_by(.created_at) | last // empty')"

    if [ -z "$run" ]; then
        if docs_only "$deployed" "$sha"; then
            log "ci: ${deployed:0:12}..${sha:0:12} changes only Markdown - no CI run expected"
            return 2
        fi
        if [ "$waited" -ge "$CI_NO_RUN_GRACE" ]; then
            log "ci: WARNING: no CI run for ${sha:0:12} after ${waited}s and the range is not docs-only - Actions outage, or the workflow did not trigger"
            return 2
        fi
        log "ci: no run reported yet (${waited}s of ${CI_NO_RUN_GRACE}s grace)"
        return 3
    fi

    status="$(    printf '%s' "$run" | jq -r '.status')"
    conclusion="$(printf '%s' "$run" | jq -r '.conclusion // ""')"
    url="$(       printf '%s' "$run" | jq -r '.html_url')"

    if [ "$status" != "completed" ]; then
        if [ "$waited" -ge "$CI_PENDING_TIMEOUT" ]; then
            log "ci: run still ${status} after ${waited}s - treating as failed  ${url}"
            return 1
        fi
        log "ci: run ${status} (${waited}s)  ${url}"
        return 3
    fi

    # skipped and neutral count as passing: a run whose jobs were all excluded
    # by an `if:` is not a failure.
    case "$conclusion" in
        success|skipped|neutral)
            log "ci: green (${conclusion})  ${url}"
            return 0 ;;
        *)
            log "ci: FAILED -> ${conclusion}  ${url}"
            return 1 ;;
    esac
}

deploy() {
    cd "$APP_DIR"

    # --- trivial region: find out whether there is anything to do -----------
    git fetch --quiet origin main
    target="$(git rev-parse origin/main)"
    deployed="$(cat "$SHA_FILE" 2>/dev/null || echo none)"

    if [ "$target" = "$deployed" ]; then
        exit 0
    fi

    if [ -f "$REFUSED_FILE" ]; then
        read -r refused_sha refused_at < "$REFUSED_FILE" || true
        if [ "${refused_sha:-}" = "$target" ] && is_epoch "${refused_at:-}" \
           && [ $(( $(date +%s) - refused_at )) -lt "$REFUSED_RETRY" ]; then
            exit 0
        fi
    fi
    # --- end trivial region -------------------------------------------------

    log "deploying ${deployed:0:12} -> ${target:0:12}"

    # The gate. With a push-based pipeline this is the CI job graph; with a pull
    # deployer the graph gates nothing here, so the box has to ask — and it asks
    # before touching the working tree (point 4 above).
    set +e
    ci_verdict "$target" "$deployed"
    verdict=$?
    set -e
    case "$verdict" in
        0) ;;
        1) refuse "$target" "CI failed. Site stays on ${deployed:0:12}"
           return 1 ;;
        2) log "WARNING: no CI run for ${target:0:12} - deploying without a verdict" ;;
        3) exit 0 ;;
        *) log "ERROR: unexpected verdict $verdict"; return 1 ;;
    esac

    self_before="$(hash_of "$SELF")"
    git reset --hard "$target"
    self_after="$(hash_of "$SELF")"

    if [ "$self_before" != "$self_after" ] && [ "${FUNOS_REEXEC:-0}" != "1" ]; then
        log "deploy script changed in $target - re-execing the new one"
        FUNOS_REEXEC=1 exec bash "$SELF"
    fi

    export GIT_SHA="$target"
    docker compose -f "$COMPOSE_FILE" build --pull
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

    # Smoke test inside the container, over the compose network rather than
    # through Traefik, so this answers only "is the new container serving the
    # commit we just built" and does not also depend on routing or a
    # certificate. CI ran the same assertion against the same Dockerfile; what
    # it could not see is whether the container the BOX started is the right one.
    #
    # Detection, not rollback: `up -d` has already replaced the old container by
    # the time this runs. If it fails, the site is serving whatever the new
    # container does until a fix lands or the retry succeeds.
    healthy=0
    for attempt in $(seq 1 20); do
        body="$(docker compose -f "$COMPOSE_FILE" exec -T web \
            wget -q -O - http://127.0.0.1/health 2>/dev/null || true)"
        case "$body" in
            *"$target"*) log "health ok: $body"; healthy=1; break ;;
        esac
        log "health not ready (attempt ${attempt}/20): ${body:-no response}"
        sleep 3
    done

    if [ "$healthy" -ne 1 ]; then
        docker compose -f "$COMPOSE_FILE" logs --tail=50 web || true
        refuse "$target" "funos-web never reported the new commit on /health; .deployed_sha stays at ${deployed:0:12}"
        return 1
    fi

    # Routes go up only once the container behind them is known to answer.
    # Publishing earlier is how the first deploy of a new app serves 503 instead
    # of 404 while its image builds — Traefik would have a route pointing at a
    # container that does not exist yet.
    #
    # Traefik watches this directory but misses some inode swaps, so the reload
    # is forced rather than assumed — and only when the file actually changed,
    # since force-recreating the shared proxy briefly interrupts every other app
    # on the box.
    routes_before="$(hash_of "$ROUTE_DST")"
    install -m 644 "$ROUTE_SRC" "$ROUTE_DST"
    routes_after="$(hash_of "$ROUTE_DST")"
    if [ "$routes_before" != "$routes_after" ]; then
        log "routes changed - reloading traefik"
        docker compose -f "$TRAEFIK_COMPOSE" up -d --force-recreate traefik </dev/null
    fi

    echo "$target" > "$SHA_FILE"
    rm -f "$REFUSED_FILE"
    # Two caches, two prunes. `image prune` drops the previous funos-web:latest
    # once it is dangling; `builder prune` drops BuildKit's layer cache, which
    # `image prune` never touches and which otherwise grows by one npm tree per
    # deploy until the disk is full.
    docker image prune -f --filter "until=168h" > /dev/null || true
    docker builder prune -f --filter "until=168h" > /dev/null || true
    log "deployed $target"
}

deploy
