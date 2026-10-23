# Changelog

## 2026-10-23 修复 / Fixes

- 修复 `disable` 文件热切换：toybox `inotifyd` 不接受 `:d,n` 中的逗号（`bad mask ','`），watcher 开机即退；改为 `:dn`
- 升级/卸载改为 fail-open：先撤销 iptables 规则再停止核心，升级中途失败不再导致断网
- iptables 启用时先清理本模块旧链，再按当前 settings 重建（修复改端口 / 切换 IPv6 模式后的规则残留）
- `settings.conf` 新增键在启动时自动补默认值（`block_ipv6_dns` 迁移值为 `false`），不覆盖用户已设置的值
- 自动发版仅构建并发布 arm64（移除 armv7 构建）
- Auto-release builds and publishes arm64 only
- 文档补充 fork 专属说明（FAK-DNS、强制保留配置、pack.sh / pack.ps1 现状），并修正被上游文档覆盖的 3 处不符

## 2026-10-23 同步上游 / Sync with upstream

- 合并上游 `twoone-3/AdGuardHomeForRoot`（至 `a75d347`）：WebUI 密码计算、pack.sh、pack.yml 复用、文档拆分
- Merge upstream `twoone-3/AdGuardHomeForRoot` (up to `a75d347`): WebUI password generator, pack.sh, pack.yml reuse, docs split
- 保留本 fork 的自动发版、FAK-DNS 上游文件、日期版本号与升级保留配置策略
- Keep this fork's auto-release, FAK-DNS upstream file, date-based versioning and keep-config-on-upgrade policy

## 2026-10-16（上游 / upstream）

- 新增 Web UI “密码计算”分页：在本地把明文密码算成 AdGuardHome.yaml 所需的 bcrypt 哈希，可一键复制或双击确认直接写回配置文件（自动备份为 .bak，写入后需重启核心）
- Add password generator tab in Web UI: compute the bcrypt hash locally, copy it or write it back to AdGuardHome.yaml with double-confirm (.bak backup, restart the core to take effect)
- 新增 pack.sh（bash 版打包脚本），GitHub workflow 复用同一脚本打包
- Add pack.sh and reuse it in the GitHub workflow for packaging
- 更新文档
- Update docs

## 2026-10-22（本 fork / this fork）

- 同步 AdGuard Home v0.107.76
- Sync with AdGuard Home v0.107.76
- 重写 WebUI 配置界面
- Rewrite WebUI configuration page
- 更新了默认配置文件 AdGuardHome.yaml
- Updated default configuration file AdGuardHome.yaml
- 恢复了 version.json
- Restored version.json
