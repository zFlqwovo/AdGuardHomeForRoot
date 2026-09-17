. /data/adb/agh/settings.conf
. /data/adb/agh/scripts/base.sh

# An upgrade keeps the user's existing settings.conf, so a key added to that
# file after the user installed is simply missing here and arrives empty.
startup_timeout="${startup_timeout:-120}"

move_to_system_cgroup() {
  echo $$ > /sys/fs/cgroup/cgroup.procs 2>/dev/null
  [ -f /dev/memcg/system/cgroup.procs ] && echo $$ > /dev/memcg/system/cgroup.procs 2>/dev/null
  [ -f /dev/cpuctl/system/cgroup.procs ] && echo $$ > /dev/cpuctl/system/cgroup.procs 2>/dev/null
  [ -f /dev/cpuset/system-background/cgroup.procs ] && echo $$ > /dev/cpuset/system-background/cgroup.procs 2>/dev/null
  [ -f /dev/blkio/cgroup.procs ] && echo $$ > /dev/blkio/cgroup.procs 2>/dev/null
}

move_to_system_cgroup

# Whether AdGuardHome is actually accepting DNS queries on $redir_port.
# Parses /proc/net/udp{,6} directly so it works without netstat/ss.
is_dns_listening() {
  local port_hex f
  port_hex=$(printf '%04X' "$redir_port")
  for f in /proc/net/udp /proc/net/udp6; do
    [ -r "$f" ] || continue
    awk -v pat=":$port_hex\$" 'NR > 1 && $2 ~ pat { found = 1 } END { exit !found }' "$f" && return 0
  done
  return 1
}

# A live PID only proves the process spawned. The DNS listener comes up much
# later, after filter lists are loaded and upstreams are probed -- tens of
# seconds on a slow device or a slow network. Redirecting port 53 during that
# window blackholes every DNS query on the device, so Android's connectivity
# check fails and the network gets flagged as "no internet"; apps that honour
# that flag (browsers, Play Store) then refuse to use it until the network is
# re-validated by hand, e.g. by toggling airplane mode.
wait_for_dns_ready() {
  local waited=0
  while [ "$waited" -lt "$startup_timeout" ]; do
    is_dns_listening && return 0
    # stop waiting if the process died instead of sitting out the full timeout
    kill -0 "$adg_pid" 2>/dev/null || return 1
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

start_adguardhome() {
  # check if AdGuardHome is already running
  if [ -f "$PID_FILE" ] && ps | grep -w "$adg_pid" | grep -q "AdGuardHome"; then
    log "AdGuardHome is already running" "AdGuardHome 已经在运行"
    exit 0
  fi

  # to fix https://github.com/AdguardTeam/AdGuardHome/issues/7002
  export SSL_CERT_DIR="/system/etc/security/cacerts/"
  # set timezone
  export TZ="$timezone"

  # backup old log and overwrite new log
  if [ -f "$AGH_DIR/bin.log" ]; then
    mv "$AGH_DIR/bin.log" "$AGH_DIR/bin.log.bak"
  fi

  # run binary
  busybox setuidgid "$adg_user:$adg_group" "$BIN_DIR/AdGuardHome" >"$AGH_DIR/bin.log" 2>&1 &
  adg_pid=$!

  # check if AdGuardHome started successfully
  if ps | grep -w "$adg_pid" | grep -q "AdGuardHome"; then
    echo "$adg_pid" >"$PID_FILE"
    # check if iptables is enabled
    if [ "$enable_iptables" = true ]; then
      # never hijack port 53 before the resolver can answer on it
      if wait_for_dns_ready; then
        log "DNS listener is up on port $redir_port" "DNS 监听已就绪，端口 $redir_port"
      else
        log "😭 DNS listener did not come up within ${startup_timeout}s, skipping iptables to keep the device online" \
          "😭 DNS 监听在 ${startup_timeout} 秒内未就绪，跳过 iptables 以保持设备联网"
        update_description "🟡 Running [PID: $adg_pid] (iptables: SKIPPED, listener timeout)" \
          "🟡 运行中 [PID: $adg_pid] (iptables: 已跳过，监听超时)"
        return 0
      fi
      if $SCRIPT_DIR/iptables.sh enable; then
        log "🟢 AdGuardHome is running [PID: $adg_pid] (iptables: enabled)" "🟢 AdGuardHome 运行中 [PID: $adg_pid] (iptables: 已启用)"
        update_description "🟢 Running [PID: $adg_pid] (iptables: ON)" "🟢 运行中 [PID: $adg_pid] (iptables: 开启)"
      else
        log "😭 Error occurred applying iptables" "😭 应用 iptables 规则时出错"
        update_description "🔴 Error applying iptables" "🔴 应用 iptables 出错"
        $SCRIPT_DIR/iptables.sh disable
        exit 1
      fi
    else
      log "🟢 AdGuardHome is running [PID: $adg_pid] (iptables: disabled)" "🟢 AdGuardHome 运行中 [PID: $adg_pid] (iptables: 已禁用)"
      update_description "🟢 Running [PID: $adg_pid] (iptables: OFF)" "🟢 运行中 [PID: $adg_pid] (iptables: 关闭)"
    fi
  else
    log "😭 Error occurred, check logs for details" "😭 出现错误，请检查日志以获取详细信息"
    update_description "🔴 Error occurred" "🔴 启动过程出现错误"
    $SCRIPT_DIR/debug.sh
    exit 1
  fi
}

stop_adguardhome() {
  $SCRIPT_DIR/iptables.sh disable
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    kill $pid || kill -9 $pid
    rm "$PID_FILE"
    log "🔴 AdGuardHome stopped [PID: $pid]" "🔴 AdGuardHome 已停止 [PID: $pid]"
  else
    pkill -f "AdGuardHome" || pkill -9 -f "AdGuardHome"
    log "🔴 AdGuardHome force stopped" "🔴 AdGuardHome 强制停止"
  fi
  update_description "🔴 Stopped" "🔴 已停止"
}

toggle_adguardhome() {
  if [ -f "$PID_FILE" ] && ps | grep -w "$(cat $PID_FILE)" | grep -q "AdGuardHome"; then
    stop_adguardhome
  else
    start_adguardhome
  fi
}

case "$1" in
start)
  start_adguardhome
  ;;
stop)
  stop_adguardhome
  ;;
toggle)
  toggle_adguardhome
  ;;
*)
  echo "Usage: $0 {start|stop|toggle}"
  exit 1
  ;;
esac