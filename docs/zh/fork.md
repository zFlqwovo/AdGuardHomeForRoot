# 本 fork 与上游的差异

[← 返回文档目录](../index.md)

本仓库是 [twoone-3/AdGuardHomeForRoot](https://github.com/twoone-3/AdGuardHomeForRoot) 的衍生版本。
上游功能全部保留；下列改动是本 fork 刻意维护的，同步上游时会保留。

## 1. DNS 上游：FAK-DNS.txt

`src/bin/AdGuardHome.yaml` 默认不使用内联 `upstream_dns`，而是：

```yaml
dns:
  upstream_dns:
    - '# https://dns.alidns.com/dns-query'
  upstream_dns_file: /data/adb/agh/bin/data/FAK-DNS.txt
```

`FAK-DNS.txt` 在构建时由 [`build.sh`](../../build.sh) 从
[`zFlqwovo/FAK-DNS`](https://github.com/zFlqwovo/FAK-DNS) 下载并打进 zip（约 4 MB），内容大致是：

- 2 条全局上游（其中一条是第三方 Cloudflare Gateway）；
- 约 11 万条 `[/域名/]quic://dns.alidns.com` 域名规则。

升级模块会用 zip 内的版本覆盖这个文件。你可以：

- 直接编辑 `/data/adb/agh/bin/AdGuardHome.yaml` 里的 `upstream_dns` / `upstream_dns_file`；
- 或把 `upstream_dns_file` 置空（`""`），改为内联 `upstream_dns`。

注意：

- 该文件是第三方内容，构建时没有校验和；请自行评估是否信任其中的上游。
- **文件缺失时 AdGuard Home 会以 `[fatal] ... reading upstream from file` 退出**，
  此时模块不会劫持 DNS：设备能上网，但没有任何过滤。
- 如果你的网络对 UDP/853 不友好（`quic://` 使用 853），建议改成 DoH（443）上游，
  或至少配置 `dns.fallback_dns`，避免主上游不可用时整个解析失败。

## 2. 升级时强制保留配置

本 fork 移除了上游“音量键选择是否保留配置”的交互，升级时**总是**保留：

- `/data/adb/agh/settings.conf`
- `/data/adb/agh/bin/AdGuardHome.yaml`

新增的 `settings.conf` 键会在下次启动时由 [`scripts/base.sh`](../../src/scripts/base.sh) 自动补默认值，
**不会覆盖你已经设置的值**。

> 例外：老用户缺失的 `block_ipv6_dns` 会补为 `false`（避免 IPv6-only 网络断网）；新安装仍为 `true`。

升级流程做了 fail-open 处理：安装脚本会先撤销 iptables 规则，再停止 AdGuardHome。
因此即使 zip 损坏、磁盘已满或安装被中断，设备也不会因为“53 端口指向一个已经死掉的监听”而断网。
代价是升级完成后需要重启设备，才会重新启用过滤。

如需恢复默认配置：在升级前手动删除上述两个文件。本 fork **不会**创建 `.bak` 备份。

## 3. 构建与发布

| 文件 | 用途 | 备注 |
| --- | --- | --- |
| `build.sh` | 本 fork 的发布脚本 | 下载最新 AGH + FAK-DNS，打 arm64 包，生成 `output/checksums.txt` |
| `.github/workflows/update.yml` | 自动发版 | 每天检查 FAK-DNS 是否变化；变化或手动触发时 bump `versionCode`、构建并发布 |
| `pack.sh`（上游） | 通用打包 | **不会下载 FAK-DNS**，用它打出的包 AGH 无法启动；请优先用 `build.sh` |
| `.github/workflows/pack.yml`（上游） | 手动 tag 构建 | 触发条件是 `[0-9]*`，但校验要求 8 位日期，且不带 FAK-DNS；不是本 fork 的发布路径 |
| `pack.ps1` | Windows 打包 | **当前整个文件被注释，不可用**；Windows 下请用 `bash build.sh`（WSL / Git Bash） |

## 4. 更新通道

- `src/module.prop` 的 `updateJson` 与 `version.json` 走 `https://gh.2719233.xyz/` 反代
  （便于访问 `raw.githubusercontent.com`）。如介意，可改成直连 GitHub。
- 本 fork 只发布 arm64 包，不再提供 armv7 构建。

## 5. 已知限制

- 默认 Web UI 账号密码仍是 `root/root`；首次登录后建议在模块 Web UI 的“密码计算”页修改。
- `block_ipv6_dns=true` 在纯 IPv6 网络（或 IPv6 DNS 优先的网络）可能导致解析失败；
  遇到断网可先设为 `false`（本 fork 尚未重做 IPv6 方案）。
- 热点 / 车机共享的 DNS 不会被劫持（规则只处理本机 OUTPUT），客户端需要手动把 DNS 指向手机。
