# 开发与打包

[← 返回文档目录](../index.md)

面向开发者的说明。普通用户请从[文档目录](../index.md)开始阅读。

## 目录结构

```text
.
├── src/                  # 模块源码（打包时映射到 ZIP 根目录）
│   ├── bin/              # AdGuardHome.yaml 与其它运行所需文件
│   ├── scripts/          # tool.sh / iptables.sh / inotify.sh / debug.sh / base.sh
│   ├── webroot/          # 模块管理页 (Web UI)
│   ├── customize.sh      # 安装脚本（升级时强制保留配置，先撤规则再停核心）
│   ├── service.sh        # 开机启动
│   ├── action.sh         # root 管理器 action 按钮
│   ├── uninstall.sh      # 卸载脚本（先停核心/撤规则，再删除数据）
│   ├── settings.conf     # 模块配置
│   ├── module.prop       # 模块信息
│   └── META-INF/         # 安装器
├── docs/                 # 用户文档（index.md 为索引，zh/ 与 en/ 分别为中英文）
├── cache/                # 打包缓存（已被 .gitignore 忽略）
├── output/               # 打包产物（build.sh 生成）
├── build.sh              # 本 fork 的发布脚本（会额外下载 FAK-DNS.txt）
├── pack.sh               # 上游的通用打包脚本（不下载 FAK-DNS）
├── pack.ps1              # 当前为注释状态，不可用
├── version.json          # 版本与更新信息
└── changelog.md          # 当前版本的更新说明（同时作为 Release 正文）
```

## 本地打包

本 fork 的发布脚本是 `build.sh`：

```shell
./build.sh
```

它会：

1. 下载 FAK-DNS 规则到 `src/bin/data/FAK-DNS.txt`；
2. 下载最新 AdGuardHome（arm64）；
3. 打包 `output/AdGuardHomeForRoot_arm64.zip`；
4. 生成 `output/checksums.txt`。

需要 `curl`、`tar`、`zip`。注意 `src/bin/data/FAK-DNS.txt` 是构建产物，不会提交到仓库。

`pack.sh`（上游）也可以打包，但它**不会**下载 FAK-DNS.txt；产物里的 AGH 会因 `upstream_dns_file`
缺失而启动失败。除非你手动把 FAK-DNS 放进 `src/bin/data/`，否则请用 `build.sh`。

`pack.ps1` 目前整个文件被注释，不能使用；Windows 下请在 WSL / Git Bash 中运行 `bash build.sh`。

> 维护提示：在 `settings.conf` 中新增键时，请同时在 `scripts/base.sh` 的 `setting_default` 列表里加一行，
> 这样老用户升级后会自动补上默认值。

## CI 与发版

本 fork 的自动发版是 [`update.yml`](../../.github/workflows/update.yml)：

1. 每天 23:00 UTC（北京时间 07:00）检查 FAK-DNS 的 SHA256 是否变化；
2. 有变化（或手动 `workflow_dispatch`）时：`versionCode + 1`、`version=YYYYMMDD`；
3. 调用 `build.sh` 构建，提交 `.upstream_hash` / `module.prop` / `version.json`；
4. 创建形如 `20261023_v146` 的 Release，附两个 zip 与 `checksums.txt`。

`pack.yml`（上游）只在手动推送 `[0-9]*` tag 时运行，且校验 tag 必须是 8 位日期、调用 `pack.sh`（不带 FAK-DNS）；
它不是本 fork 的发布路径。

手动发版时请同步更新：

- `version.json`：`versionCode` 递增，`version` 使用 `YYYYMMDD`
- `src/module.prop`：`version` 与 `versionCode`
- `changelog.md`：仅保留**当前版本**的变更，中英各一段

## 提交规范

仓库使用 [Conventional Commits](https://www.conventionalcommits.org/)，常用前缀：`feat`、`fix`、`docs`、`chore`、`ci`、`refactor`。
