# Differences from upstream

[← Back to documentation index](../index.md)

This repository is a fork of [twoone-3/AdGuardHomeForRoot](https://github.com/twoone-3/AdGuardHomeForRoot).
All upstream features are kept; the changes below are maintained intentionally and are preserved when syncing upstream.

## 1. DNS upstream: FAK-DNS.txt

`src/bin/AdGuardHome.yaml` does not use inline `upstream_dns` by default:

```yaml
dns:
  upstream_dns:
    - '# https://dns.alidns.com/dns-query'
  upstream_dns_file: /data/adb/agh/bin/data/FAK-DNS.txt
```

`FAK-DNS.txt` is downloaded at build time by [`build.sh`](../../build.sh) from
[`zFlqwovo/FAK-DNS`](https://github.com/zFlqwovo/FAK-DNS) and packed into the zip (~4 MB). It contains:

- 2 global upstreams (one of them is a third-party Cloudflare Gateway);
- about 110k `[/domain/]quic://dns.alidns.com` domain rules.

Upgrading the module replaces this file with the copy from the zip. You can either:

- edit `upstream_dns` / `upstream_dns_file` in `/data/adb/agh/bin/AdGuardHome.yaml`; or
- set `upstream_dns_file` to `""` and use inline `upstream_dns` instead.

Caveats:

- The file is third-party content and is not checksum-verified at build time; decide for yourself whether you trust its upstreams.
- **If the file is missing, AdGuard Home exits with `[fatal] ... reading upstream from file`.** The module then does not hijack DNS: the device stays online but is unfiltered.
- If your network handles UDP/853 poorly (`quic://` uses 853), prefer a DoH (443) upstream, or at least configure `dns.fallback_dns` so a dead primary does not break all resolution.

## 2. Configuration is always kept on upgrade

This fork removed upstream's "volume key: keep or discard config" prompt. On upgrade it **always** keeps:

- `/data/adb/agh/settings.conf`
- `/data/adb/agh/bin/AdGuardHome.yaml`

Keys added to `settings.conf` by a newer version are backfilled on the next start by
[`scripts/base.sh`](../../src/scripts/base.sh); values you have set are **never** overwritten.

> Exception: a missing `block_ipv6_dns` is backfilled as `false` (to avoid breaking IPv6-only networks); fresh installs still use `true`.

The upgrade path is fail-open: the installer removes the iptables rules before stopping AdGuardHome.
Even if the zip is broken, the disk is full, or the install is interrupted, the device will not lose DNS
because port 53 points at a listener that no longer exists. The trade-off is that a reboot is required to
re-enable filtering after an upgrade.

To reset the configuration, delete the two files above before upgrading. This fork does **not** create `.bak` files.

## 3. Build and release

| File | Purpose | Notes |
| --- | --- | --- |
| `build.sh` | this fork's release script | downloads the latest AGH + FAK-DNS, builds arm64/armv7 zips and `output/checksums.txt` |
| `.github/workflows/update.yml` | automated release | checks FAK-DNS daily; on change (or manual dispatch) bumps `versionCode`, builds and releases |
| `pack.sh` (upstream) | generic packaging | **does not download FAK-DNS**; the resulting module's AGH will not start. Prefer `build.sh` |
| `.github/workflows/pack.yml` (upstream) | tag-based build | triggered by `[0-9]*`, but validates an 8-digit date and does not include FAK-DNS; not this fork's release path |
| `pack.ps1` | Windows packaging | **the whole file is commented out and unusable**; on Windows use `bash build.sh` (WSL / Git Bash) |

## 4. Update channel

- `updateJson` in `src/module.prop` and `version.json` go through the `https://gh.2719233.xyz/` proxy
  (to make `raw.githubusercontent.com` reachable). Change them to direct GitHub URLs if you prefer.
- `zipUrl` in `version.json` **always points to the arm64 zip**. armv7 users must download
  `AdGuardHomeForRoot_armv7.zip` manually instead of using the in-manager updater.

## 5. Known limitations

- The default web UI credentials are still `root/root`; change them on the module web UI's "Password" tab after the first login.
- `block_ipv6_dns=true` can break resolution on IPv6-only (or IPv6-first) networks; set it to `false` if you lose DNS
  (this fork has not reworked the IPv6 design yet).
- DNS for hotspot / car head-unit clients is not hijacked (the rules only cover local OUTPUT); point those clients at the phone manually.
