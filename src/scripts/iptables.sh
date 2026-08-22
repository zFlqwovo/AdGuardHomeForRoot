. /data/adb/agh/settings.conf
. /data/adb/agh/scripts/base.sh

iptables_w="iptables -w 64"
ip6tables_w="ip6tables -w 64"

check_ipv6_nat_support() {
  if ! $ip6tables_w -t nat -L >/dev/null 2>&1; then
    # IPv6 NAT is not supported, we cannot use REDIRECT target
    return 1
  fi

  local redirect_ok=false
  if $ip6tables_w -t nat -A PREROUTING -p tcp --dport 65534 -j REDIRECT --to-port 65534 >/dev/null 2>&1; then
    redirect_ok=true
    $ip6tables_w -t nat -D PREROUTING -p tcp --dport 65534 -j REDIRECT --to-port 65534 >/dev/null 2>&1
  fi

  if $redirect_ok; then
    # IPv6 NAT is supported, we can use REDIRECT target
    return 0
  else
    # IPv6 NAT is not supported, we cannot use REDIRECT target
    return 1
  fi
}

enable_iptables_chain() {
  local iptables_cmd=$1
  local chain_name=$2

  if $iptables_cmd -t nat -L $chain_name >/dev/null 2>&1; then
    log "$chain_name chain already exists" "$chain_name 链已经存在"
    if ! $iptables_cmd -t nat -C OUTPUT -j $chain_name >/dev/null 2>&1; then
      $iptables_cmd -t nat -I OUTPUT -j $chain_name
    fi
    return 0
  fi

  log "Creating $chain_name chain and adding rules" "创建 $chain_name 链并添加规则"
  $iptables_cmd -t nat -N $chain_name || return 1
  $iptables_cmd -t nat -A $chain_name -m owner --uid-owner $adg_user --gid-owner $adg_group -j RETURN || return 1

  for subnet in $ignore_dest_list; do
    if ! $iptables_cmd -t nat -A $chain_name -d $subnet -j RETURN >/dev/null 2>&1; then
      log "Warning: Failed to add bypass for $subnet (DNS resolution likely failed)" "警告：无法为 $subnet 添加绕过规则（可能由于 DNS 解析失败）"
    fi
  done

  for subnet in $ignore_src_list; do
    if ! $iptables_cmd -t nat -A $chain_name -s $subnet -j RETURN >/dev/null 2>&1; then
      log "Warning: Failed to add bypass for source $subnet" "警告：无法为源 $subnet 添加绕过规则"
    fi
  done

  $iptables_cmd -t nat -A $chain_name -p udp --dport 53 -j REDIRECT --to-ports $redir_port || return 1
  $iptables_cmd -t nat -A $chain_name -p tcp --dport 53 -j REDIRECT --to-ports $redir_port || return 1
  $iptables_cmd -t nat -I OUTPUT -j $chain_name || return 1

  log "Applied iptables rules successfully" "成功应用 iptables 规则"
}

disable_iptables_chain() {
  local iptables_cmd=$1
  local chain_name=$2

  log "Deleting $chain_name chain and rules" "删除 $chain_name 链及规则"
  $iptables_cmd -t nat -D OUTPUT -j $chain_name >/dev/null 2>&1
  $iptables_cmd -t nat -F $chain_name >/dev/null 2>&1
  $iptables_cmd -t nat -X $chain_name >/dev/null 2>&1
  return 0
}

add_block_ipv6_dns() {
  if $ip6tables_w -t filter -L ADGUARD_BLOCK_DNS >/dev/null 2>&1; then
    log "ADGUARD_BLOCK_DNS chain already exists" "ADGUARD_BLOCK_DNS 链已经存在"
    if ! $ip6tables_w -t filter -C OUTPUT -j ADGUARD_BLOCK_DNS >/dev/null 2>&1; then
      $ip6tables_w -t filter -I OUTPUT -j ADGUARD_BLOCK_DNS
    fi
    return 0
  fi

  log "Creating ADGUARD_BLOCK_DNS chain and adding rules" "创建 ADGUARD_BLOCK_DNS 链并添加规则"
  $ip6tables_w -t filter -N ADGUARD_BLOCK_DNS || return 1
  $ip6tables_w -t filter -A ADGUARD_BLOCK_DNS -p udp --dport 53 -j DROP || return 1
  $ip6tables_w -t filter -A ADGUARD_BLOCK_DNS -p tcp --dport 53 -j DROP || return 1
  $ip6tables_w -t filter -I OUTPUT -j ADGUARD_BLOCK_DNS || return 1

  log "Applied ipv6 iptables rules successfully" "成功应用 ipv6 iptables 规则"
}

del_block_ipv6_dns() {
  log "Deleting ADGUARD_BLOCK_DNS chain and rules" "删除 ADGUARD_BLOCK_DNS 链及规则"
  $ip6tables_w -t filter -D OUTPUT -j ADGUARD_BLOCK_DNS >/dev/null 2>&1
  $ip6tables_w -t filter -F ADGUARD_BLOCK_DNS >/dev/null 2>&1
  $ip6tables_w -t filter -X ADGUARD_BLOCK_DNS >/dev/null 2>&1
  return 0
}

enable_ipv6_iptables() {
  if ! check_ipv6_nat_support; then
    log "IPv6 NAT is not supported, skipping IPv6 DNS hijack" "IPv6 NAT 不支持，跳过 IPv6 DNS 劫持"
    return 0
  fi

  enable_iptables_chain "$ip6tables_w" "ADGUARD_REDIRECT_DNS6"
}

disable_ipv6_iptables() {
  if ! check_ipv6_nat_support; then
    log "IPv6 NAT is not supported, skipping IPv6 DNS hijack cleanup" "IPv6 NAT 不支持，跳过 IPv6 DNS 劫持清理"
    return 0
  fi

  disable_iptables_chain "$ip6tables_w" "ADGUARD_REDIRECT_DNS6"
}

case "$1" in
enable)
  log "Enabling iptables and ipv6 DNS blocking if configured" "启用 iptables 和 ipv6 DNS 阻断（如果已配置）"
  enable_iptables_chain "$iptables_w" "ADGUARD_REDIRECT_DNS" || exit 1

  if [ "$block_ipv6_dns" = true ]; then
    log "IPv6 DNS mode: block (DROP IPv6 DNS traffic)" "IPv6 DNS 模式: block (丢弃 IPv6 DNS 流量)"
    add_block_ipv6_dns || exit 1
  else
    log "IPv6 DNS mode: hijack (NAT REDIRECT to AdGuard Home)" "IPv6 DNS 模式: hijack (劫持 IPv6 到 AdGuard Home)"
    enable_ipv6_iptables || exit 1
  fi
  ;;
disable)
  log "Disabling iptables and ipv6 DNS blocking" "禁用 iptables 和 ipv6 DNS 阻断"
  disable_iptables_chain "$iptables_w" "ADGUARD_REDIRECT_DNS" || exit 1

  del_block_ipv6_dns || exit 1
  disable_ipv6_iptables || exit 1
  ;;
*)
  echo "Usage: $0 {enable|disable}"
  exit 1
  ;;
esac