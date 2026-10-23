# 安装与升级

[← 返回文档目录](../index.md)

## 系统要求

- 设备已 root，且已安装 [Magisk](https://github.com/topjohnwu/Magisk) / [KernelSU](https://github.com/tiann/KernelSU) / [APatch](https://github.com/bmax121/APatch) 之一
- 模块提供 arm64 与 armv7 两个版本，一般推荐 **arm64**：性能更优，且与大多数现代设备兼容

## 安装步骤

1. 前往本仓库的 [Release](https://github.com/zFlqwovo/AdGuardHomeForRoot/releases/latest) 页面下载对应架构的 zip 文件
2. 打开 **设置 -> 网络和互联网 -> 高级 -> 私人 DNS**，将其关闭（原因见 [常见问题](faq.md)）
3. 在 root 管理器中安装模块，完成后重启设备
4. 模块启动成功后，可访问 <http://127.0.0.1:3000> 进入 [AdGuardHome 后台](configuration.md#1-adguardhome-后台)，默认账号和密码均为 `root`；建议首次登录后在模块 Web UI 的“密码计算”页修改

## 升级

在 root 管理器中直接安装新版本 zip 覆盖安装即可。本 fork **总是保留**用户配置：

- `/data/adb/agh/settings.conf`
- `/data/adb/agh/bin/AdGuardHome.yaml`

新增的配置键会在下次启动时由 `scripts/base.sh` 自动补默认值，不会覆盖你已经设置的值。

升级时安装脚本会先撤销 iptables 重定向规则、再停止 AdGuardHome，因此即使 zip 损坏或安装中断，
设备也不会断网；安装完成后需要重启设备才会重新启用过滤。

> 本 fork 不提供“音量键选择是否保留配置”，也不会创建 `.bak` 备份。如需恢复默认配置，请在升级前手动删除上述两个文件。
> 与上游的完整差异见 [本 fork 的差异](fork.md)。

## 卸载

在 root 管理器中移除模块时，卸载脚本会先停止 AdGuardHome、撤销 iptables 规则，然后删除 `/data/adb/agh`
（**包含 AdGuardHome 配置、拦截规则与全部日志**）。如需保留，请在卸载前自行备份该目录。

## 端口总览

| 端口 | 用途 | 说明 |
| --- | --- | --- |
| `53` | 系统 DNS | 由 iptables 规则重定向到 AdGuardHome，仅在 `enable_iptables=true` 时生效 |
| `5591` | AdGuardHome DNS 监听端口 | 定义于 `AdGuardHome.yaml` 的 `dns.port`，须与 `settings.conf` 的 `redir_port` 保持一致 |
| `3000` | AdGuardHome 后台 | 定义于 `AdGuardHome.yaml` 的 `http.address` |

其中 `5591` 与 `3000` 默认只监听 `127.0.0.1`，即仅本机可访问，不会暴露到局域网。
