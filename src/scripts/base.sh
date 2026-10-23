# add busybox to PATH
[ -d "/data/adb/magisk" ] && export PATH="/data/adb/magisk:$PATH"
[ -d "/data/adb/ksu/bin" ] && export PATH="/data/adb/ksu/bin:$PATH"
[ -d "/data/adb/ap/bin" ] && export PATH="/data/adb/ap/bin:$PATH"

# most of the users are Chinese, so set default language to Chinese
language="zh"

# try to get the system language
locale=$(getprop persist.sys.locale || getprop ro.product.locale || getprop persist.sys.language)

# if the system language is English, set language to English
if echo "$locale" | grep -qi "en"; then
  language="en"
fi

function log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  local str
  [ "$language" = "en" ] && str="$timestamp $1" || str="$timestamp $2"
  echo "$str" | tee -a "$AGH_DIR/history.log"
}

function update_description() {
  local description
  [ "$language" = "en" ] && description="$1" || description="$2"
  local module_id
  module_id=$(grep "^id=" "$MOD_PATH/module.prop" | cut -d'=' -f2)
  # use ksu api if available, otherwise fallback to ap api, and finally fallback to sed
  if [ -x /data/adb/ksud ]; then
    MODULE_ID="$module_id" /data/adb/ksud module config set override.description "$description"
  elif [ -x /data/adb/apd ]; then
    MODULE_ID="$module_id" /data/adb/apd module config set override.description "$description"
  else
    sed -i "/^description=/c\description=$description" "$MOD_PATH/module.prop"
  fi
}

SETTINGS_FILE="$AGH_DIR/settings.conf"

setting_default() {
  [ -f "$SETTINGS_FILE" ] || return 0
  local current
  current=$(sed -n "s/^$1=//p" "$SETTINGS_FILE" 2>/dev/null | tail -n 1)
  [ -n "$current" ] && return 0
  if grep -q "^$1=" "$SETTINGS_FILE" 2>/dev/null; then
    sed -i "s|^$1=.*|$1=$2|" "$SETTINGS_FILE" 2>/dev/null
  else
    printf '%s=%s\n' "$1" "$2" >>"$SETTINGS_FILE"
  fi
  log "settings.conf: filled default $1=$2" "settings.conf: 已补充默认值 $1=$2"
}

setting_default enable_iptables true
setting_default block_ipv6_dns false
setting_default redir_port 5591
setting_default startup_timeout 120
setting_default adg_user root
setting_default adg_group net_raw
setting_default timezone Asia/Shanghai

enable_iptables="${enable_iptables:-true}"
block_ipv6_dns="${block_ipv6_dns:-false}"
redir_port="${redir_port:-5591}"
startup_timeout="${startup_timeout:-120}"
adg_user="${adg_user:-root}"
adg_group="${adg_group:-net_raw}"
timezone="${timezone:-Asia/Shanghai}"
