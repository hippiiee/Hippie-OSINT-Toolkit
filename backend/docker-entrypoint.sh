#!/bin/sh
set -eu

if [ -n "${GHUNT_CREDS_DATA:-}" ]; then
    mkdir -p /root/.malfrats/ghunt
    printf '%s' "$GHUNT_CREDS_DATA" > /root/.malfrats/ghunt/creds.m
    chmod 600 /root/.malfrats/ghunt/creds.m
fi

exec "$@"
