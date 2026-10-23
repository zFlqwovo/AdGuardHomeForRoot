# Installation and Upgrade

[← Back to documentation index](../index.md)

## Requirements

- A rooted device with [Magisk](https://github.com/topjohnwu/Magisk) / [KernelSU](https://github.com/tiann/KernelSU) / [APatch](https://github.com/bmax121/APatch) installed
- Only the **arm64** build is provided

## Installation

1. Download the arm64 zip from this repository's [Release](https://github.com/zFlqwovo/AdGuardHomeForRoot/releases/latest) page
2. Open **Settings -> Network & Internet -> Advanced -> Private DNS** and turn it off (see [FAQ](faq.md))
3. Install the module in your root manager and reboot the device
4. Once the module is running, open <http://127.0.0.1:3000> to access the [AdGuardHome panel](configuration.md#1-adguardhome-panel); the default username and password are both `root` — change them on the module web UI's "Password" tab after the first login

## Upgrade

Install the new zip over the existing module in your root manager. This fork **always** keeps your configuration:

- `/data/adb/agh/settings.conf`
- `/data/adb/agh/bin/AdGuardHome.yaml`

Keys added by a newer version are backfilled on the next start by `scripts/base.sh`; values you have set are never overwritten.

The installer removes the iptables redirect rules before stopping AdGuardHome, so even a broken zip or an
interrupted install cannot take DNS down. A reboot is required to re-enable filtering after the upgrade.

> This fork has no "volume key: keep or discard config" prompt and does not create `.bak` files.
> To reset the configuration, delete the two files above before upgrading.
> See [Differences from upstream](fork.md) for the full list.

## Uninstall

Removing the module in your root manager first stops AdGuardHome and removes the iptables rules, then deletes
`/data/adb/agh` (**including the AdGuardHome configuration, filter rules and all logs**). Back it up first if you want to keep them.

## Ports

| Port | Purpose | Notes |
| --- | --- | --- |
| `53` | System DNS | Redirected to AdGuardHome by the iptables rules, only when `enable_iptables=true` |
| `5591` | AdGuardHome DNS listener | Defined by `dns.port` in `AdGuardHome.yaml`; must match `redir_port` in `settings.conf` |
| `3000` | AdGuardHome panel | Defined by `http.address` in `AdGuardHome.yaml` |

`5591` and `3000` listen on `127.0.0.1` only by default, so they are not exposed to the local network.
