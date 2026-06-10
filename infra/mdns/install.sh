#!/bin/sh
# Generate this checkout's mDNS LaunchDaemon plist and install it.
#
# The plist must embed an absolute path to advertise-claw-local.sh, which is
# machine-specific — so the real plist is gitignored and generated here from
# com.clawconsole.mdns.plist.template. Run from anywhere:
#
#     sh infra/mdns/install.sh
#
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
TEMPLATE="$HERE/com.clawconsole.mdns.plist.template"
PLIST="$HERE/com.clawconsole.mdns.plist"
DEST="/Library/LaunchDaemons/com.clawconsole.mdns.plist"

sed "s#__SCRIPT_PATH__#$HERE/advertise-claw-local.sh#g" "$TEMPLATE" > "$PLIST"
echo "Generated $PLIST"

sudo cp "$PLIST" "$DEST"
sudo launchctl load -w "$DEST"
echo "Installed and loaded com.clawconsole.mdns"
