# syntax=docker/dockerfile:1
#
# Build context is the repository root (see deploy/docker-compose.yml).

# Kept in step with NODE_VERSION in .github/workflows/ci.yml, so the bundle CI
# gated is built by the same toolchain the box builds it with.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


# The current STABLE branch, pinned to the minor. A minor tag is rebuilt for
# base-image fixes only while its branch is maintained — 1.27 went quiet in
# April 2025 and this file said 1.27 until September 2026. Two things stop that
# recurring: Dependabot (.github/dependabot.yml, `docker` ecosystem) opens a PR
# when the next minor exists, and cve-watch.yml scans whatever this line names
# every Monday, so a CVE on a stale tag is at least reported.
FROM nginx:1.31-alpine AS runtime

# The commit this image was built from. Served at /health so a deploy can be
# verified from outside the box (guide section 7).
ARG GIT_SHA=unknown

# Patch the base's OS packages. This is the standard answer to "the package is
# fixed in Alpine but the image tag has not been rebuilt yet" — on 2026-09-14
# nginx:1.30-alpine still carried libuuid 2.42.1-r0 against seven HIGH advisories
# fixed in 2.42.3-r0, and there was no newer tag for Dependabot to bump to.
#
# Placed BELOW `ARG GIT_SHA` on purpose. The ARG changes every commit, so this
# layer is rebuilt on every deploy and picks up whatever Alpine has shipped
# since. Above the ARG it would cache until the base digest moved, which is the
# same staleness this line exists to fix.
#
# The costs, both real: an image is no longer exactly its pinned base, and a
# broken Alpine mirror now fails a deploy. Accepted — `--pull` in auto_deploy.sh
# already means a given commit does not rebuild bit-for-bit.
RUN apk upgrade --no-cache

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.inc /etc/nginx/conf.d/security-headers.inc
RUN sed -i "s|__GIT_SHA__|${GIT_SHA}|g" /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

# The only health check definition — docker-compose.yml inherits it. Defining
# it in both places meant compose silently overrode this one.
#
# -O /dev/null, not -O -: the probe only cares about the exit status, and piping
# the body back would put a copy of it in `docker inspect`'s health log on every
# single check.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

EXPOSE 80
