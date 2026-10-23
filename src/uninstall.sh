#!/system/bin/sh

AGH_DIR="/data/adb/agh"
SCRIPT_DIR="$AGH_DIR/scripts"

[ -f "$SCRIPT_DIR/iptables.sh" ] && sh "$SCRIPT_DIR/iptables.sh" disable >/dev/null 2>&1
pkill -x AdGuardHome 2>/dev/null || pkill -f "/AdGuardHome$" 2>/dev/null || true

[ -d "$AGH_DIR" ] && rm -rf "$AGH_DIR"
