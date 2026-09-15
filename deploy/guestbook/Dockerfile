# syntax=docker/dockerfile:1
#
# The guestbook service. Build context is this directory
# (see deploy/docker-compose.yml). Standard library only, so there is no
# requirements file and nothing for Dependabot to bump except the base.
FROM python:3.13-alpine

# Same reasoning as the web image: the tag may lag Alpine's fixes.
RUN apk upgrade --no-cache

RUN adduser -D -H guestbook && mkdir -p /data && chown guestbook /data
COPY server.py /srv/server.py
USER guestbook
VOLUME /data
ENV GUESTBOOK_DATA=/data/guestbook.json PYTHONUNBUFFERED=1

HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

EXPOSE 8080
CMD ["python3", "/srv/server.py"]
