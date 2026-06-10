#!/bin/sh
# Advertise `claw.local` on the LAN via mDNS / Bonjour so any device resolves it
# to this machine, *in addition* to the machine's native Bonjour name (gym.local).
#
# Run by the LaunchDaemon com.clawconsole.mdns.plist (RunAtLoad + KeepAlive).
# dns-sd -P runs in the foreground and holds the registration open for as long as
# the process lives; launchd restarts it if it ever exits. See infra/README.md.
set -eu

# Wait for a LAN IP — at boot the network may not be up yet.
IP=""
while [ -z "$IP" ]; do
  IP=$(ipconfig getifaddr en1 2>/dev/null || true)
  [ -z "$IP" ] && IP=$(ipconfig getifaddr en0 2>/dev/null || true)
  [ -z "$IP" ] && sleep 2
done

# -P registers a proxy: a _http._tcp service record AND, crucially, the
# `claw.local` address record (A/AAAA) pointing at this machine's LAN IP.
exec /usr/bin/dns-sd -P claw _http._tcp local 80 claw.local "$IP"
